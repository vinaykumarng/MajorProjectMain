import { useMemo, useState } from 'react';
import { qrSvg, tracePath } from '../utils/traceShare.js';

export default function TraceShare({ batchId }) {
  const [message, setMessage] = useState('');
  const origin = import.meta.env.VITE_PUBLIC_TRACE_ORIGIN || window.location.origin;
  const url = new URL(tracePath(batchId), origin).href;
  const qr = useMemo(() => {
    try { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg(url)); }
    catch { return null; }
  }, [url]);
  const localOnly = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Trace link copied.');
    } catch {
      setMessage('Select and copy the trace link below.');
    }
  }

  return (
    <section className="card mb-2 trace-share">
      {qr && <img src={qr} width="152" height="152" alt="QR code for this batch’s trace page" />}
      <div>
        <h2 className="card-title">Share with customers</h2>
        <p className="text-sm">Customers can scan this code to view the batch and its custody history.</p>
        {localOnly && <p className="text-sm trace-share-note">This link opens on this computer only. Open the app using its LAN address or public URL to create a link for a phone.</p>}
        {!qr && <p className="text-sm">This link is too long for the QR encoder. Share the link directly.</p>}
        <label className="form-label mt-1" htmlFor="customer-trace-link">Customer trace link</label>
        <input id="customer-trace-link" className="form-input" readOnly value={url} onFocus={e => e.currentTarget.select()} />
        <div className="trace-share-actions mt-1">
          <button className="btn btn-outline" type="button" onClick={copyLink}>Copy trace link</button>
          {qr && <a className="btn btn-primary" href={qr} download="batch-trace-qr.svg">Download QR code</a>}
        </div>
        <p aria-live="polite" className="text-sm">{message}</p>
      </div>
    </section>
  );
}
