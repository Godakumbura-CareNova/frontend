import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CalendarPlus, Lock, Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import ProfileSection from './ProfileSection';
import { formatSlotTime, parseUtcDate } from './AvailabilityBadge';
import {
  addMyAvailability,
  deleteMyAvailabilitySlot,
  getMyAvailability,
  updateMyAvailabilitySlot,
} from '../../services/doctorService';
import {
  AVAILABILITY_MERIDIEM_OPTIONS,
  AVAILABILITY_SLOT_OPTIONS,
  combineLocalDateTime,
  countAvailabilitySlots,
  findConflictingSlot,
  mapServerValidationErrors,
  to24HourTime,
  toAvailabilityRequest,
  toAvailabilitySlotUpdateRequest,
  typedTimeError,
  validateAvailabilityForm,
  validateAvailabilitySlotEdit,
} from '../../utils/doctorValidation';

// The doctor types the hour and minutes and picks AM / PM; the validator and the API work in 24-hour time.
const emptyForm = () => ({
  date: '',
  startHour: '',
  startMinute: '',
  startMeridiem: 'AM',
  endHour: '',
  endMinute: '',
  endMeridiem: 'AM',
  slotDurationMinutes: '20',
});

const toTimeForm = (form) => ({
  date: form.date,
  startTime: to24HourTime(form.startHour, form.startMinute, form.startMeridiem),
  endTime: to24HourTime(form.endHour, form.endMinute, form.endMeridiem),
  slotDurationMinutes: form.slotDurationMinutes,
});

// Runs the form validator, then replaces its generic "invalid time" with what exactly is wrong in the typed hour / minutes.
const validateTimes = (form, validate) => {
  const { errors } = validate(toTimeForm(form));
  const startProblem = typedTimeError(form.startHour, form.startMinute);
  const endProblem = typedTimeError(form.endHour, form.endMinute);
  if (startProblem) errors.startTime = startProblem;
  if (endProblem) errors.endTime = endProblem;
  return { isValid: Object.keys(errors).length === 0, errors };
};

const pad = (value) => String(value).padStart(2, '0');

const todayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Prefills the edit form from a slot, in the doctor's local zone.
const slotToEditForm = (slot) => {
  const start = parseUtcDate(slot.startUtc);
  const end = parseUtcDate(slot.endUtc);
  return {
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startHour: String(start.getHours() % 12 || 12),
    startMinute: pad(start.getMinutes()),
    startMeridiem: start.getHours() < 12 ? 'AM' : 'PM',
    endHour: String(end.getHours() % 12 || 12),
    endMinute: pad(end.getMinutes()),
    endMeridiem: end.getHours() < 12 ? 'AM' : 'PM',
  };
};

const formatTimeOnly = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
};

const formatDayHeading = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
};

const sortByStart = (slots) => [...slots].sort((a, b) => parseUtcDate(a.startUtc) - parseUtcDate(b.startUtc));

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

const conflictMessage = (slot) =>
  `This time overlaps your existing slot on ${formatSlotTime(slot.startUtc)} – ${formatTimeOnly(slot.endUtc)}. Choose another time, or edit or remove that slot first.`;

// The API reports StartUtc / EndUtc; the form shows those errors under the From / To pickers.
const toFormFieldErrors = (serverErrors) => {
  const mapped = mapServerValidationErrors(serverErrors);
  const { startUtc, endUtc, ...rest } = mapped;
  return { ...rest, ...(startUtc && { startTime: startUtc }), ...(endUtc && { endTime: endUtc }) };
};

const describeError = (error, fallback) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (status === 400) {
    return { message: serverMessage || 'Please check the availability details.', fieldErrors: toFormFieldErrors(error?.response?.data?.errors), retryable: false };
  }
  if (status === 404) return { message: serverMessage || 'That slot no longer exists.', fieldErrors: {}, retryable: false, gone: true };
  if (status === 409) return { message: serverMessage || 'This change clashes with your existing availability.', fieldErrors: {}, retryable: false };
  if (status === 401) return { message: 'Your session has expired. Please sign in again to manage your availability.', fieldErrors: {}, retryable: false };
  if (status === 403) return { message: 'You are not authorized to manage consultation availability. Only doctors can change these slots.', fieldErrors: {}, retryable: false };
  if (!error?.response) return { message: 'We could not reach the doctor service. Check your connection and try again.', fieldErrors: {}, retryable: true };
  return { message: serverMessage || fallback, fieldErrors: {}, retryable: true };
};

// The hour, minute and AM/PM inputs all report against one error key ("startTime" / "endTime").
const errorKeyFor = (name) =>
  (/^(start|end)(Hour|Minute|Meridiem)$/.test(name) ? `${name.replace(/(Hour|Minute|Meridiem)$/, '')}Time` : name);

const clearError = (setter, key) => setter((current) => {
  if (!current[key] && !current.conflict) return current;
  const next = { ...current };
  delete next[key];
  delete next.conflict;
  return next;
});

/**
 * Doctor-side consultation availability: lists upcoming slots and lets the doctor publish a window
 * (split into slots), edit an open slot's time, or withdraw it. Changes save immediately; nothing here is
 * part of the profile edit form. `hasProfile` gates adding, since slots hang off the professional profile.
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

  const [editingSlot, setEditingSlot] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editError, setEditError] = useState(null);

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
    clearError(setErrors, errorKeyFor(name));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
    clearError(setEditErrors, errorKeyFor(name));
  };

  const cancelEdit = () => {
    setEditingSlot(null);
    setEditForm(null);
    setEditErrors({});
    setEditError(null);
  };

  const openForm = () => {
    cancelEdit();
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

  const startEdit = (slot) => {
    closeForm();
    setEditingSlot(slot);
    setEditForm(slotToEditForm(slot));
    setEditErrors({});
    setEditError(null);
  };

  const submit = (event) => {
    event.preventDefault();
    setSaveError(null);

    const times = toTimeForm(form);
    const validation = validateTimes(form, validateAvailabilityForm);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const conflict = findConflictingSlot(combineLocalDateTime(times.date, times.startTime), combineLocalDateTime(times.date, times.endTime), slots);
    if (conflict) {
      setErrors({ conflict: conflictMessage(conflict) });
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
      setSlots((current) => sortByStart([...current, ...added]));
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

  const saveEdit = async (event) => {
    event?.preventDefault();
    if (!editingSlot || !editForm) return;
    setEditError(null);

    const times = toTimeForm(editForm);
    const validation = validateTimes(editForm, validateAvailabilitySlotEdit);
    if (!validation.isValid) {
      setEditErrors(validation.errors);
      return;
    }

    const conflict = findConflictingSlot(
      combineLocalDateTime(times.date, times.startTime),
      combineLocalDateTime(times.date, times.endTime),
      slots,
      editingSlot.id,
    );
    if (conflict) {
      setEditErrors({ conflict: conflictMessage(conflict) });
      return;
    }

    setEditErrors({});
    setSaving(true);
    try {
      const updated = await updateMyAvailabilitySlot(editingSlot.id, toAvailabilitySlotUpdateRequest(times));
      setSlots((current) => sortByStart(current.map((slot) => (slot.id === editingSlot.id ? { ...slot, ...updated } : slot))));
      showToast('Consultation slot updated.');
      cancelEdit();
    } catch (error) {
      const described = describeError(error, 'Failed to update this slot. Your previous time is unchanged.');
      if (Object.keys(described.fieldErrors).length > 0) setEditErrors(described.fieldErrors);
      if (described.gone) {
        // Someone (or another tab) already removed it; drop it here too so the schedule stays truthful.
        setSlots((current) => current.filter((slot) => slot.id !== editingSlot.id));
        cancelEdit();
        setSaveError(described);
      } else {
        setEditError({ ...described, retry: described.retryable ? saveEdit : undefined });
      }
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
      if (editingSlot?.id === slot.id) cancelEdit();
      showToast('Slot removed.', 'danger');
    } catch (error) {
      const described = describeError(error, 'Failed to remove the slot.');
      setSaveError({ ...described, retry: () => setPendingRemoval(slot) });
    } finally {
      setSaving(false);
    }
  };

  const renderFieldError = (errs, key) => (errs[key] ? <span className="field-error" role="alert">{errs[key]}</span> : null);

  const renderConflict = (errs) => (errs.conflict ? (
    <div className="dp-conflict-warning" role="alert">
      <AlertTriangle size={15} aria-hidden="true" />
      <span>{errs.conflict}</span>
    </div>
  ) : null);

  // Hour and minutes are typed so a wrong entry is caught by validation; AM / PM is chosen so the half of the day is never in doubt.
  const renderTimeField = ({ legend, prefix, errorKey, values, errs, onChange }) => {
    const invalid = Boolean(errs[errorKey] || errs.conflict);
    const inputClass = `form-input dp-time-number${invalid ? ' has-error' : ''}`;
    return (
      <fieldset className="dp-time-field">
        <legend className="form-label">{legend}</legend>
        <div className="dp-time-inputs">
          <input
            className={inputClass}
            name={`${prefix}Hour`}
            type="text"
            inputMode="numeric"
            maxLength={2}
            autoComplete="off"
            placeholder="hh"
            aria-label={`${legend} hour`}
            aria-invalid={invalid}
            value={values[`${prefix}Hour`]}
            onChange={onChange}
          />
          <span className="dp-time-separator" aria-hidden="true">:</span>
          <input
            className={inputClass}
            name={`${prefix}Minute`}
            type="text"
            inputMode="numeric"
            maxLength={2}
            autoComplete="off"
            placeholder="mm"
            aria-label={`${legend} minutes`}
            aria-invalid={invalid}
            value={values[`${prefix}Minute`]}
            onChange={onChange}
          />
          <select
            className={`form-select${invalid ? ' has-error' : ''}`}
            name={`${prefix}Meridiem`}
            aria-label={`${legend} AM or PM`}
            value={values[`${prefix}Meridiem`]}
            onChange={onChange}
          >
            {AVAILABILITY_MERIDIEM_OPTIONS.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </div>
        {renderFieldError(errs, errorKey)}
      </fieldset>
    );
  };

  const renderDateField = (id, values, errs, onChange) => (
    <div className="dp-editor-field">
      <label className="form-label" htmlFor={id}>Date</label>
      <input
        id={id}
        name="date"
        type="date"
        min={todayInputValue()}
        className={`form-input${errs.date ? ' has-error' : ''}`}
        value={values.date}
        onChange={onChange}
      />
      {renderFieldError(errs, 'date')}
    </div>
  );

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
              {renderDateField('availability-date', form, errors, handleChange)}
              {renderTimeField({ legend: 'From', prefix: 'start', errorKey: 'startTime', values: form, errs: errors, onChange: handleChange })}
              {renderTimeField({ legend: 'To', prefix: 'end', errorKey: 'endTime', values: form, errs: errors, onChange: handleChange })}
              <div className="dp-editor-field">
                <label className="form-label" htmlFor="availability-duration">Slot length</label>
                <select id="availability-duration" name="slotDurationMinutes" className={`form-select${errors.slotDurationMinutes ? ' has-error' : ''}`} value={form.slotDurationMinutes} onChange={handleChange}>
                  {AVAILABILITY_SLOT_OPTIONS.map((minutes) => (
                    <option key={minutes} value={String(minutes)}>{minutes} minutes</option>
                  ))}
                </select>
                {renderFieldError(errors, 'slotDurationMinutes')}
              </div>
            </div>
            {renderConflict(errors)}
            <p className="dp-field-hint">The window is split into consecutive slots of the chosen length. Type the hour (1 to 12) and minutes (00 to 59), then choose AM or PM. Times are in your local time zone.</p>
            <div className="dp-actions dp-availability-actions">
              <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-green" disabled={saving}>
                <CalendarPlus size={16} /> {saving ? 'Publishing...' : 'Publish Slots'}
              </button>
            </div>
          </form>
        )}

        {editingSlot && editForm && (
          <form className="dp-availability-form" onSubmit={saveEdit} noValidate aria-label="Edit consultation slot">
            <p className="dp-edit-title">
              Editing slot <strong>{formatSlotTime(editingSlot.startUtc)} – {formatTimeOnly(editingSlot.endUtc)}</strong>
            </p>
            {editError && (
              <div className="alert alert-error" role="alert">
                <span>{editError.message}</span>
                {editError.retry && (
                  <button type="button" className="dp-retry-btn" onClick={editError.retry} disabled={saving}>
                    <RefreshCw size={13} /> Retry
                  </button>
                )}
              </div>
            )}
            <div className="dp-form-grid dp-form-grid-3">
              {renderDateField('availability-edit-date', editForm, editErrors, handleEditChange)}
              {renderTimeField({ legend: 'New start', prefix: 'start', errorKey: 'startTime', values: editForm, errs: editErrors, onChange: handleEditChange })}
              {renderTimeField({ legend: 'New end', prefix: 'end', errorKey: 'endTime', values: editForm, errs: editErrors, onChange: handleEditChange })}
            </div>
            {renderConflict(editErrors)}
            <p className="dp-field-hint">Type the hour (1 to 12) and minutes (00 to 59), then choose AM or PM. Times are in your local time zone. Patients see the new time as soon as you save.</p>
            <div className="dp-actions dp-availability-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-green" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
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
                    <li key={slot.id} className={`dp-slot${slot.isBooked ? ' dp-slot-booked' : ''}${editingSlot?.id === slot.id ? ' dp-slot-editing' : ''}`}>
                      <span className="dp-slot-time">
                        {formatTimeOnly(slot.startUtc)} – {formatTimeOnly(slot.endUtc)}
                      </span>
                      {slot.isBooked ? (
                        <span className="dp-slot-status" title="A patient has booked this slot, so it cannot be edited or removed">
                          <Lock size={12} aria-hidden="true" /> Booked
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="dp-slot-edit"
                            onClick={() => startEdit(slot)}
                            disabled={disabled || saving}
                            aria-label={`Edit slot ${formatSlotTime(slot.startUtc)}`}
                            title="Edit this slot"
                          >
                            <Pencil size={13} />
                          </button>
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
                        </>
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
