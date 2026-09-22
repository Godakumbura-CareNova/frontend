import React from 'react';
import { Trash2 } from 'lucide-react';
import { DOCTOR_PROFILE_MIN_YEAR } from '../../utils/doctorValidation';

export const PRESENT_OPTION = 'present';

const yearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= DOCTOR_PROFILE_MIN_YEAR; year -= 1) years.push(String(year));
  return years;
};

/**
 * Editable rows for a list of qualifications / experience / other entries.
 *
 * `fields` describes the two text columns, e.g. [{ name: 'degree', label: 'Degree' }, { name: 'institution', label: 'Institution' }].
 * `optionalField` adds a full-width optional text input under the row.
 * `prefix` matches the validation error keys ("qualifications[0].degree").
 * End year offers a "Present" choice, stored in form state as an empty string (sent to the API as null).
 */
const CredentialListEditor = ({
  items,
  fields,
  prefix,
  errors = {},
  itemLabel,
  emptyMessage,
  onChange,
  onRemove,
  optionalField = null,
}) => {
  if (!items || items.length === 0) {
    return <p className="dp-empty">{emptyMessage}</p>;
  }

  const years = yearOptions();

  return (
    <div className="dp-editor-list">
      {items.map((item, index) => {
        const key = `${prefix}[${index}]`;
        const rowLabel = `${itemLabel} ${index + 1}`;
        const renderError = (field) =>
          errors[`${key}.${field}`] ? (
            <span className="field-error" role="alert">{errors[`${key}.${field}`]}</span>
          ) : null;
        const endYearValue = item.endYear === '' || item.endYear === null || item.endYear === undefined ? PRESENT_OPTION : String(item.endYear);

        return (
          <fieldset key={item.key ?? index} className="dp-editor-row">
            <legend className="dp-editor-legend">{rowLabel}</legend>
            <div className="dp-editor-grid">
              {fields.map((field) => (
                <div key={field.name} className="dp-editor-field">
                  <label className="form-label" htmlFor={`${key}.${field.name}`}>{field.label}</label>
                  <input
                    id={`${key}.${field.name}`}
                    className={`form-input${errors[`${key}.${field.name}`] ? ' has-error' : ''}`}
                    value={item[field.name] ?? ''}
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    onChange={(event) => onChange(index, field.name, event.target.value)}
                  />
                  {renderError(field.name)}
                </div>
              ))}
              <div className="dp-editor-field dp-editor-year">
                <label className="form-label" htmlFor={`${key}.startYear`}>Start year</label>
                <select
                  id={`${key}.startYear`}
                  className={`form-select${errors[`${key}.startYear`] ? ' has-error' : ''}`}
                  value={item.startYear ?? ''}
                  onChange={(event) => onChange(index, 'startYear', event.target.value)}
                >
                  <option value="">Year</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                {renderError('startYear')}
              </div>
              <div className="dp-editor-field dp-editor-year">
                <label className="form-label" htmlFor={`${key}.endYear`}>End year</label>
                <select
                  id={`${key}.endYear`}
                  className={`form-select${errors[`${key}.endYear`] ? ' has-error' : ''}`}
                  value={endYearValue}
                  onChange={(event) => onChange(index, 'endYear', event.target.value === PRESENT_OPTION ? '' : event.target.value)}
                >
                  <option value={PRESENT_OPTION}>Present</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                {renderError('endYear')}
              </div>
              <button
                type="button"
                className="dp-remove-btn"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${rowLabel}`}
                title={`Remove ${rowLabel}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {optionalField && (
              <div className="dp-editor-field dp-editor-optional">
                <label className="form-label" htmlFor={`${key}.${optionalField.name}`}>{optionalField.label}</label>
                <input
                  id={`${key}.${optionalField.name}`}
                  className={`form-input${errors[`${key}.${optionalField.name}`] ? ' has-error' : ''}`}
                  value={item[optionalField.name] ?? ''}
                  placeholder={optionalField.placeholder}
                  maxLength={optionalField.maxLength}
                  onChange={(event) => onChange(index, optionalField.name, event.target.value)}
                />
                {renderError(optionalField.name)}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
};

export default CredentialListEditor;
