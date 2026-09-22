import React from 'react';
import { Calendar, Trash2 } from 'lucide-react';

export const formatYearRange = (startYear, endYear) =>
  `${startYear} - ${endYear === null || endYear === undefined || endYear === '' ? 'Present' : endYear}`;

/**
 * Read-only rows for qualifications / experience entries.
 * `titleKey` and `subtitleKey` pick which fields of each item are shown.
 * When `onRemove` is given, each row gets a delete button (called with the row index).
 */
const CredentialList = ({ items, titleKey, subtitleKey, noteKey = null, emptyMessage, itemLabel = 'entry', onRemove = null, disabled = false }) => {
  if (!items || items.length === 0) {
    return <p className="dp-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="dp-credential-list">
      {items.map((item, index) => (
        <li key={item.id ?? index} className="dp-credential-row">
          <div className="dp-credential-text">
            <span className="dp-credential-title">{item[titleKey]}</span>
            <span className="dp-credential-subtitle">{item[subtitleKey]}</span>
            {noteKey && item[noteKey] && <span className="dp-credential-note">{item[noteKey]}</span>}
          </div>
          <div className="dp-credential-side">
            <span className="dp-credential-years">
              <Calendar size={13} aria-hidden="true" />
              {formatYearRange(item.startYear, item.endYear)}
            </span>
            {onRemove && (
              <button
                type="button"
                className="dp-remove-btn dp-remove-btn-sm"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Remove ${itemLabel} ${index + 1}`}
                title={`Remove ${itemLabel}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default CredentialList;
