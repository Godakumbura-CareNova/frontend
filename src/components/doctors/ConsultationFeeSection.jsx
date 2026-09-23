import React, { useState } from 'react';
import { HandCoins, Pencil, RefreshCw, Save, Trash2 } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import ProfileSection from './ProfileSection';
import { CONSULTATION_FEE_CURRENCY, formatConsultationFee } from '../../utils/consultationFee';
import { mapServerValidationErrors, validateConsultationFee } from '../../utils/doctorValidation';

const toFeeText = (fee) => (fee === null || fee === undefined ? '' : String(fee));

const describeError = (error) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (status === 400) {
    return { message: serverMessage || 'Please check the consultation fee.', fieldError: mapServerValidationErrors(error?.response?.data?.errors).consultationFee, retryable: false };
  }
  if (status === 401 || status === 403) return { message: 'You are not authorized to change this consultation fee.', retryable: false };
  if (!error?.response) return { message: 'We could not reach the doctor service. Check your connection and try again.', retryable: true };
  return { message: serverMessage || 'Failed to save your consultation fee.', retryable: true };
};

/**
 * The doctor's own consultation fee, kept in its own section so it can be changed without
 * editing the whole profile. Like the other sections, entering the editor and saving are
 * both confirmed. `onSave` receives the fee text ('' meaning "not set") and persists it.
 */
const ConsultationFeeSection = ({ profile, onSave, disabled = false }) => {
  const { showToast } = useToast();
  const hasProfile = Boolean(profile);
  const savedFee = profile?.consultationFee;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => toFeeText(savedFee));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // What the last confirmed attempt tried to store, so Retry repeats that attempt rather than the current input.
  const [lastAttempt, setLastAttempt] = useState('');

  const formattedFee = formatConsultationFee(savedFee);

  const startEditing = () => {
    setShowEditConfirm(false);
    setValue(toFeeText(savedFee));
    setError('');
    setSaveError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setValue(toFeeText(savedFee));
    setError('');
    setSaveError(null);
    setEditing(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaveError(null);

    const validationError = validateConsultationFee(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setShowSaveConfirm(true);
  };

  const persist = async (feeText) => {
    setShowSaveConfirm(false);
    setShowDeleteConfirm(false);
    setLastAttempt(feeText);
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(feeText);
      setValue(feeText);
      setEditing(false);
      if (feeText.trim() === '') showToast('Consultation fee removed.', 'danger');
      else showToast('Consultation fee saved.');
    } catch (exception) {
      const described = describeError(exception);
      if (described.fieldError) setError(described.fieldError);
      setSaveError(described);
    } finally {
      setSaving(false);
    }
  };

  const sectionActions = editing ? null : (
    <div className="dp-section-actions">
      <button
        type="button"
        className="dp-add-btn"
        onClick={() => setShowEditConfirm(true)}
        disabled={disabled || saving || !hasProfile}
        title={hasProfile ? 'Change your consultation fee' : 'Create your professional profile first'}
      >
        <Pencil size={13} /> {formattedFee ? 'Edit Fee' : 'Set Fee'}
      </button>
      {formattedFee && (
        <button
          type="button"
          className="dp-add-btn dp-danger-btn"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={disabled || saving}
          title="Remove your consultation fee"
        >
          <Trash2 size={13} /> Delete Fee
        </button>
      )}
    </div>
  );

  return (
    <div className="dp-card">
      <ProfileSection icon={HandCoins} title="Consultation Fee" action={sectionActions}>
        {saveError && (
          <div className="alert alert-error" role="alert">
            <span>{saveError.message}</span>
            {saveError.retryable && (
              <button type="button" className="dp-retry-btn" onClick={() => persist(lastAttempt)} disabled={saving}>
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </div>
        )}

        {!hasProfile ? (
          <p className="dp-hint dp-availability-hint">
            Create your professional profile first; the consultation fee is shown on that profile.
          </p>
        ) : editing ? (
          <form className="dp-fee-form" onSubmit={handleSubmit} noValidate aria-label="Consultation fee">
            <div className="dp-editor-field">
              <label className="form-label" htmlFor="consultationFee">Consultation Fee ({CONSULTATION_FEE_CURRENCY})</label>
              <input
                id="consultationFee"
                name="consultationFee"
                type="text"
                inputMode="decimal"
                className={`form-input${error ? ' has-error' : ''}`}
                value={value}
                placeholder="e.g. 2500 or 2500.50"
                maxLength={12}
                onChange={(event) => { setValue(event.target.value); setError(''); }}
              />
              <span className="dp-field-hint">Charged per person, per consultation. Shown to patients on your profile and in search results.</span>
              {error && <span className="field-error" role="alert">{error}</span>}
            </div>
            <div className="dp-actions dp-availability-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-green" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Fee'}
              </button>
            </div>
          </form>
        ) : formattedFee ? (
          <div className="dp-fee">
            <span className="dp-fee-amount" data-testid="doctor-consultation-fee">{formattedFee}</span>
            <span className="dp-fee-note">per person, per consultation</span>
          </div>
        ) : (
          <p className="dp-empty">No consultation fee set. Patients will see that your fee is not specified.</p>
        )}
      </ProfileSection>

      <ConfirmDialog
        open={showEditConfirm}
        title={formattedFee ? 'Change your consultation fee?' : 'Set your consultation fee?'}
        message="Patients see this fee on your profile and in search results. Nothing is saved until you confirm your change."
        confirmLabel={formattedFee ? 'Yes, Edit' : 'Yes, Set'}
        onConfirm={startEditing}
        onCancel={() => setShowEditConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your consultation fee?"
        message="Your profile will show that your consultation fee is not specified. You can set it again at any time."
        confirmLabel="Yes, Delete"
        danger
        busy={saving}
        onConfirm={() => persist('')}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={showSaveConfirm}
        title={value.trim() === '' ? 'Remove your consultation fee?' : 'Save this consultation fee?'}
        message={
          value.trim() === ''
            ? 'Your profile will show that your consultation fee is not specified.'
            : `Patients will see ${formatConsultationFee(value)} as your consultation fee.`
        }
        confirmLabel={value.trim() === '' ? 'Yes, Remove' : 'Yes, Save'}
        busy={saving}
        onConfirm={() => persist(value)}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </div>
  );
};

export default ConsultationFeeSection;
