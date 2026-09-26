import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Clock3, FileUp, ImagePlus, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { uploadBankTransferReceipt } from '../../services/paymentService';
import {
  RECEIPT_ACCEPT, describeReceiptUploadError, formatFileSize, validateReceiptFile,
} from '../../utils/receiptValidation';

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '');

// A local preview of the chosen image; null where object URLs are unavailable (e.g. tests).
const usePreviewUrl = (file) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') { setUrl(null); return undefined; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
};

// The receipt step of a bank transfer: choose a receipt, preview it, upload it, then see it waiting for verification,
// verified or rejected. The order stays Pending after the upload; only the pharmacy's verification confirms the payment.
export default function BankTransferReceiptUpload({ orderId, paymentStatus, receipt, onUploaded }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const inputRef = useRef(null);
  const inFlight = useRef(false);
  const previewUrl = usePreviewUrl(file);
  const { showToast } = useToast();

  const clearInput = () => { if (inputRef.current) inputRef.current.value = ''; };

  const choose = (event) => {
    const next = event.target.files?.[0] || null;
    setRetryable(false); setConfirmation('');
    const problem = next ? validateReceiptFile(next) : '';
    setError(problem);
    // An invalid file is not kept, so it can never be previewed or uploaded.
    setFile(problem ? null : next);
    if (problem) clearInput();
  };

  const remove = () => { setFile(null); setError(''); setRetryable(false); clearInput(); };

  const upload = async () => {
    if (inFlight.current) return;
    const problem = validateReceiptFile(file);
    setError(problem); setRetryable(false);
    if (problem) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = (await uploadBankTransferReceipt(orderId, file)).data;
      setFile(null); clearInput();
      setConfirmation(result.message);
      showToast('Receipt uploaded. Receipt has been sent to the pharmacy for verification.');
      onUploaded?.(result);
    } catch (failure) {
      const described = describeReceiptUploadError(failure);
      setError(described.message); setRetryable(described.retryable);
    } finally {
      inFlight.current = false; setBusy(false);
    }
  };

  if (paymentStatus === 'Paid') {
    return <div className="pay-confirmed pay-receipt-state" role="status">
      <BadgeCheck size={22} aria-hidden="true" />
      <div><strong>Payment verified</strong><p>The pharmacy verified your bank transfer receipt{receipt?.fileName ? ` (${receipt.fileName})` : ''}. Your payment is confirmed.</p></div>
    </div>;
  }

  if (paymentStatus === 'ReceiptUnderVerification') {
    return <div className="pay-receipt-state pay-receipt-pending" role="status">
      <Clock3 size={22} aria-hidden="true" />
      <div>
        <strong>{confirmation ? 'Receipt uploaded successfully' : 'Receipt under verification'}</strong>
        <p>{confirmation || 'The pharmacy is verifying your receipt. Your order stays Pending and is not confirmed until the receipt is verified.'}</p>
        {receipt && <p className="pay-receipt-file">{receipt.fileName} | {formatFileSize(receipt.sizeBytes)} | Uploaded {formatDate(receipt.uploadedAtUtc)}</p>}
        <p className="pay-receipt-order-status">Order status: <span className="pay-status-pill">Pending</span></p>
      </div>
    </div>;
  }

  const rejected = paymentStatus === 'ReceiptRejected';
  return <div className="pay-receipt">
    <span className="pay-method-icon"><FileUp size={20} aria-hidden="true" /></span>
    <div className="pay-receipt-body">
      <strong>{rejected ? 'Upload a new payment receipt' : 'Upload your payment receipt'}</strong>
      {rejected && <div className="pay-receipt-rejected" role="alert">
        <XCircle size={17} aria-hidden="true" />
        <span>Your previous receipt was rejected{receipt?.rejectionReason ? `: ${receipt.rejectionReason}` : '.'} Please upload a clear receipt.</span>
      </div>}
      <p>After transferring, upload a photo or screenshot of your bank slip. JPG, JPEG or PNG, up to 5 MB.</p>

      <input ref={inputRef} id={`receipt-file-${orderId}`} className="pay-receipt-input" type="file" accept={RECEIPT_ACCEPT}
        aria-label="Payment receipt" onChange={choose} disabled={busy} />

      {file
        ? <div className="pay-receipt-preview">
          {previewUrl
            ? <img src={previewUrl} alt={`Preview of ${file.name}`} />
            : <span className="pay-receipt-thumb" aria-hidden="true"><ImagePlus size={22} /></span>}
          <div className="pay-receipt-preview-info">
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)} | Ready to upload</span>
          </div>
          <button type="button" className="pay-btn pay-btn-danger" onClick={remove} disabled={busy}>
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        </div>
        : <label htmlFor={`receipt-file-${orderId}`} className={`pay-btn pay-btn-outline pay-receipt-choose${busy ? ' disabled' : ''}`}>
          <ImagePlus size={15} aria-hidden="true" /> Choose receipt
        </label>}

      {error && <div role="alert" className="order-error pay-error">
        {error}
        {retryable && <button type="button" onClick={upload} disabled={busy}><RefreshCw size={15} /> Retry upload</button>}
      </div>}

      <div className="pay-receipt-controls">
        <button type="button" className="pay-btn pay-btn-primary" onClick={upload} disabled={busy}>
          <Upload size={14} aria-hidden="true" /> {busy ? 'Uploading...' : 'Upload receipt'}
        </button>
      </div>
      <p className="pay-muted pay-receipt-hint">Your order stays Pending until the pharmacy verifies the receipt.</p>
    </div>
  </div>;
}
