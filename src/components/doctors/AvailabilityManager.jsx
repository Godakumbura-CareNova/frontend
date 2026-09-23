import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarPlus, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import ProfileSection from './ProfileSection';
import { formatSlotTime, parseUtcDate } from './AvailabilityBadge';
import { addMyAvailability, deleteMyAvailabilitySlot, getMyAvailability } from '../../services/doctorService';
import {
  AVAILABILITY_HOUR_OPTIONS,
  AVAILABILITY_MERIDIEM_OPTIONS,
  AVAILABILITY_MINUTE_OPTIONS,
  AVAILABILITY_SLOT_OPTIONS,
  combineLocalDateTime,
  countAvailabilitySlots,
  mapServerValidationErrors,
  to24HourTime,
  toAvailabilityRequest,
  validateAvailabilityForm,
} from '../../utils/doctorValidation';

// The doctor picks hour / minute / AM-PM; the validator and the API work in 24-hour time.
const emptyForm = () => ({
  date: '',
  startHour: '',
  startMinute: '00',
  startMeridiem: 'AM',
  endHour: '',
  endMinute: '00',
  endMeridiem: 'AM',
  slotDurationMinutes: '20',
});

const toTimeForm = (form) => ({
  date: form.date,
  startTime: to24HourTime(form.startHour, form.startMinute, form.startMeridiem),
  endTime: to24HourTime(form.endHour, form.endMinute, form.endMeridiem),
  slotDurationMinutes: form.slotDurationMinutes,
});

const todayInputValue = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const formatTimeOnly = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
};

const formatDayHeading = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
};

// Groups slots by local calendar day so a week of availability reads as a schedule rather than a flat list.
const groupByDay = (slots) => {
  const groups = new Map();
  slots.forEach((slot) => {
    const date = parseUtcDate(slot.startUtc);
    const key = date ? date.toDateString() : 'unknown';
    if (!groups.has(key)) groups.set(key, { key, heading: formatDayHeading(slot.startUtc), slots: [] });
    groups.get(key).slots.push(slot);
  });
  return Array.from(groups.values());
};

const describeError = (error, fallback) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (status === 400) {
    return { message: serverMessage || 'Please check the availability details.', fieldErrors: mapServerValidationErrors(error?.response?.data?.errors), retryable: false };
  }
  if (status === 409) return { message: serverMessage || 'This change clashes with your existing availability.', fieldErrors: {}, retryable: false };
  if (status === 401 || status === 403) return { message: 'You are not authorized to manage this availability.', fieldErrors: {}, retryable: false };
  if (!error?.response) return { message: 'We could not reach the doctor service. Check your connection and try again.', fieldErrors: {}, retryable: true };
  return { message: serverMessage || fallback, fieldErrors: {}, retryable: true };
};

/**
 * Doctor-side consultation availability: lists upcoming slots and lets the doctor publish a window
 * (split into slots) or withdraw an open slot. Changes save immediately; nothing here is part of the
 * profile edit form. `hasProfile` gates adding, since slots hang off the professional profile.
 */
const AvailabilityManager = ({ hasProfile, disabled = false }) => {
  const { showToast } = useToast();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMyAvailability();
      setSlots(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(describeError(error, 'Failed to load your availability.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByDay(slots), [slots]);
  const openCount = slots.filter((slot) => !slot.isBooked).length;
  const bookedCount = slots.length - openCount;

  // What the confirmation is about to publish, described in the doctor's own words back to them.
  const plannedSlotCount = countAvailabilitySlots(toTimeForm(form));
  const plannedWindowLabel = useMemo(() => {
    const times = toTimeForm(form);
    const start = combineLocalDateTime(times.date, times.startTime);
    const end = combineLocalDateTime(times.date, times.endTime);
    if (!start || !end) return '';
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    return `${start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${start.toLocaleTimeString('en-US', timeOptions)} to ${end.toLocaleTimeString('en-US', timeOptions)}`;
  }, [form]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    // The three time selects all report against one error key ("startTime" / "endTime").
    const errorKey = /^(start|end)(Hour|Minute|Meridiem)$/.test(name) ? `${name.replace(/(Hour|Minute|Meridiem)$/, '')}Time` : name;
    setErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };

  const openForm = () => {
    setForm(emptyForm());
    setErrors({});
    setSaveError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setErrors({});
    setSaveError(null);
  };

  const submit = (event) => {
    event.preventDefault();
    setSaveError(null);

    const validation = validateAvailabilityForm(toTimeForm(form));
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setShowPublishConfirm(true);
  };

  const publish = async () => {
    setShowPublishConfirm(false);
    setSaving(true);
    try {
      const created = await addMyAvailability(toAvailabilityRequest(toTimeForm(form)));
      const added = Array.isArray(created) ? created : [];
      setSlots((current) => [...current, ...added].sort((a, b) => new Date(a.startUtc) - new Date(b.startUtc)));
      showToast(`${added.length} consultation slot${added.length === 1 ? '' : 's'} published.`);
      setShowForm(false);
      setForm(emptyForm());
    } catch (error) {
      const described = describeError(error, 'Failed to publish this availability.');
      if (Object.keys(described.fieldErrors).length > 0) setErrors(described.fieldErrors);
      setSaveError(described);
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const slot = pendingRemoval;
    setPendingRemoval(null);
    setSaving(true);
    setSaveError(null);
    try {
      await deleteMyAvailabilitySlot(slot.id);
      setSlots((current) => current.filter((item) => item.id !== slot.id));
      showToast('Slot removed.', 'danger');
    } catch (error) {
      const described = describeError(error, 'Failed to remove the slot.');
      setSaveError({ ...described, retry: () => setPendingRemoval(slot) });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key) => (errors[key] ? <span className="field-error" role="alert">{errors[key]}</span> : null);
  const inputClass = (key) => `form-input${errors[key] ? ' has-error' : ''}`;

  // Hour / minute / AM-PM, so there is no doubt about which half of the day a time belongs to.
  const timePicker = (legend, prefix, errorKey) => {
    const selectClass = `form-select${errors[errorKey] ? ' has-error' : ''}`;
    return (
      <fieldset className="dp-time-field">
        <legend className="form-label">{legend}</legend>
        <div className="dp-time-inputs">
          <select
            className={selectClass}
            name={`${prefix}Hour`}
            aria-label={`${legend} hour`}
            value={form[`${prefix}Hour`]}
            onChange={handleChange}
          >
            <option value="">Hour</option>
            {AVAILABILITY_HOUR_OPTIONS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
          </select>
          <span className="dp-time-separator" aria-hidden="true">:</span>
          <select
            className={selectClass}
            name={`${prefix}Minute`}
            aria-label={`${legend} minutes`}
            value={form[`${prefix}Minute`]}
            onChange={handleChange}
          >
            {AVAILABILITY_MINUTE_OPTIONS.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
          </select>
          <select
            className={selectClass}
            name={`${prefix}Meridiem`}
            aria-label={`${legend} AM or PM`}
            value={form[`${prefix}Meridiem`]}
            onChange={handleChange}
          >
            {AVAILABILITY_MERIDIEM_OPTIONS.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </div>
        {fieldError(errorKey)}
      </fieldset>
    );
  };

  const addButton = showForm ? null : (
    <button
      type="button"
      className="dp-add-btn"
      onClick={openForm}
      disabled={disabled || saving || loading || !hasProfile || Boolean(loadError)}
      title={hasProfile ? 'Publish a new availability window' : 'Create your professional profile first'}
    >
      <Plus size={13} /> Add Availability
    </button>
  );

  return (
    <div className="dp-card">
      <ProfileSection icon={CalendarClock} title="Consultation Availability" action={addButton}>
        {saveError && (
          <div className="alert alert-error" role="alert">
            <span>{saveError.message}</span>
            {saveError.retryable && saveError.retry && (
              <button type="button" className="dp-retry-btn" onClick={saveError.retry} disabled={saving}>
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </div>
        )}

        {!hasProfile && (
          <p className="dp-hint dp-availability-hint">
            Create your professional profile first; consultation slots are shown on that profile.
          </p>
        )}

        {showForm && (
          <form className="dp-availability-form" onSubmit={submit} noValidate aria-label="Add availability">
            <div className="dp-form-grid dp-form-grid-3">
              <div className="dp-editor-field">
                <label className="form-label" htmlFor="availability-date">Date</label>
                <input id="availability-date" name="date" type="date" min={todayInputValue()} className={inputClass('date')} value={form.date} onChange={handleChange} />
                {fieldError('date')}
              </div>
              {timePicker('From', 'start', 'startTime')}
              {timePicker('To', 'end', 'endTime')}
              <div className="dp-editor-field">
                <label className="form-label" htmlFor="availability-duration">Slot length</label>
                <select id="availability-duration" name="slotDurationMinutes" className={`form-select${errors.slotDurationMinutes ? ' has-error' : ''}`} value={form.slotDurationMinutes} onChange={handleChange}>
                  {AVAILABILITY_SLOT_OPTIONS.map((minutes) => (
                    <option key={minutes} value={String(minutes)}>{minutes} minutes</option>
                  ))}
                </select>
                {fieldError('slotDurationMinutes')}
              </div>
            </div>
            <p className="dp-field-hint">The window is split into consecutive slots of the chosen length. Times are in your local time zone.</p>
            <div className="dp-actions dp-availability-actions">
              <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-green" disabled={saving}>
                <CalendarPlus size={16} /> {saving ? 'Publishing...' : 'Publish Slots'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="dp-status">Loading your availability...</p>
        ) : loadError ? (
          <div className="alert alert-error" role="alert">
            <span>{loadError.message}</span>
            <button type="button" className="dp-retry-btn" onClick={load}><RefreshCw size={13} /> Retry</button>
          </div>
        ) : slots.length === 0 ? (
          <p className="dp-empty">
            {hasProfile ? 'No upcoming consultation slots. Use Add Availability to publish when patients can consult you.' : 'No upcoming consultation slots.'}
          </p>
        ) : (
          <div className="dp-availability">
            <p className="dp-availability-summary">
              <strong>{openCount}</strong> open slot{openCount === 1 ? '' : 's'}
              {bookedCount > 0 && <> · <strong>{bookedCount}</strong> booked</>}
            </p>
            {groups.map((group) => (
              <section key={group.key} className="dp-availability-day" aria-label={group.heading}>
                <h3 className="dp-availability-day-title">{group.heading}</h3>
                <ul className="dp-slot-list">
                  {group.slots.map((slot) => (
                    <li key={slot.id} className={`dp-slot${slot.isBooked ? ' dp-slot-booked' : ''}`}>
                      <span className="dp-slot-time">
                        {formatTimeOnly(slot.startUtc)} – {formatTimeOnly(slot.endUtc)}
                      </span>
                      {slot.isBooked ? (
                        <span className="dp-slot-status" title="A patient has booked this slot"><Lock size={12} aria-hidden="true" /> Booked</span>
                      ) : (
                        <button
                          type="button"
                          className="dp-remove-btn dp-slot-remove"
                          onClick={() => setPendingRemoval(slot)}
                          disabled={disabled || saving}
                          aria-label={`Remove slot ${formatSlotTime(slot.startUtc)}`}
                          title="Remove this slot"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </ProfileSection>

      <ConfirmDialog
        open={showPublishConfirm}
        title="Publish these consultation slots?"
        message={`${plannedSlotCount} slot${plannedSlotCount === 1 ? '' : 's'} of ${form.slotDurationMinutes} minutes will be offered to patients${plannedWindowLabel ? ` on ${plannedWindowLabel}` : ''}.`}
        confirmLabel="Yes, Publish"
        busy={saving}
        onConfirm={publish}
        onCancel={() => setShowPublishConfirm(false)}
      />

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove this consultation slot?"
        message={pendingRemoval ? `${formatSlotTime(pendingRemoval.startUtc)} will no longer be offered to patients.` : ''}
        confirmLabel="Yes, Remove"
        danger
        busy={saving}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
};

export default AvailabilityManager;
