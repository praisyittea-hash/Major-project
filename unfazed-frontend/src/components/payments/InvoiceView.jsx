import { useState } from 'react';
import api, { messageOf } from '../../api/axiosInstance.js';
export default function InvoiceView({ payment, client = api, token }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.get(`/payments/${payment._id}/invoice`, {
        responseType: 'blob',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      const url = URL.createObjectURL(data),
        link = document.createElement('a');
      link.href = url;
      link.download = `${payment.invoiceNumber || 'invoice'}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  if (!payment.invoiceNumber) return null;
  return (
    <div>
      <button className="secondary" disabled={busy} onClick={download}>
        {busy ? 'Downloading…' : 'Download invoice'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
