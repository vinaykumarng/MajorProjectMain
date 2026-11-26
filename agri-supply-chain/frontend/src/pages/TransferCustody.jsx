import { useState } from 'react';
import TxStatus from '../components/TxStatus.jsx';
import { getDemoParticipants, displayName } from '../utils/formatters.js';

export default function TransferCustody({ contract, account, isConnected, isWrongNetwork }) {
  const [form, setForm] = useState({ batchId: '', toAddress: '', notes: '' });
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);
  const [loading, setLoading] = useState(false);

  const recipients = getDemoParticipants().filter(
    (p) => !account || p.address.toLowerCase() !== account.toLowerCase()
  );

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setTxStatus('pending');
    setTxHash(null);
    setTxError(null);

    try {
      const tx = await contract.transferCustody(
        form.batchId.trim(),
        form.toAddress.trim(),
        form.notes.trim()
      );
      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus('success');
      setForm({ batchId: '', toAddress: '', notes: '' });
    } catch (err) {
      setTxStatus('error');
      setTxError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">🔄 Transfer Custody</h1>
        </div>
        <div className="alert alert-warning">
          <span className="alert-icon">🔌</span>
          Please connect your MetaMask wallet to continue.
        </div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">🔄 Transfer Custody</h1>
        </div>
        <div className="alert alert-warning">
          <span className="alert-icon">⚠️</span>
          Please switch MetaMask to <strong>Localhost 8545</strong> (Chain ID 31337).
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">🔄 Transfer Custody</h1>
        <p className="page-subtitle">
          Transfer a batch to the next authorized participant in the supply chain.
          The contract validates that the role sequence is correct.
        </p>
      </div>

      {/* Valid transitions info */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">📋</span> Allowed Transfers</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            ['🌾 Farmer', '⚙️ Processor'],
            ['⚙️ Processor', '🚛 Distributor'],
            ['🚛 Distributor', '🏪 Retailer'],
          ].map(([from, to], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56,189,248,0.06)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)' }}>
              <span style={{ fontWeight: 600 }}>{from}</span>
              <span style={{ color: '#475569' }}>→</span>
              <span style={{ fontWeight: 600 }}>{to}</span>
            </div>
          ))}
        </div>
        <p className="text-muted text-sm mt-1">
          The contract will reject any transfer that does not follow this sequence.
        </p>
      </div>

      <div className="card">
        <div className="card-title"><span className="icon">📦</span> Transfer Form</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="tf-batchId">Batch ID *</label>
            <input
              id="tf-batchId"
              name="batchId"
              className="form-input"
              placeholder="e.g., RICE-2026-001"
              value={form.batchId}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tf-toAddress">Recipient *</label>
            <select
              id="tf-toAddress"
              name="toAddress"
              className="form-input"
              value={form.toAddress}
              onChange={handleChange}
              required
            >
              <option value="">Select next participant…</option>
              {recipients.map((p) => (
                <option key={p.address} value={p.address}>
                  {p.icon} {p.label} — {p.role}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Demo accounts by name (still real wallet addresses under the hood).
              {form.toAddress ? ` Selected: ${displayName(form.toAddress)}` : ''}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tf-notes">Handoff Notes (optional)</label>
            <textarea
              id="tf-notes"
              name="notes"
              className="form-textarea"
              placeholder="Location, condition, processing details, delivery notes…"
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          <TxStatus status={txStatus} txHash={txHash} error={txError} />

          {txStatus === 'success' && (
            <div className="alert alert-success mt-2">
              <span className="alert-icon">✅</span>
              Custody transferred on-chain! Use <strong>Trace Product</strong> to verify the updated history.
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg mt-2" disabled={loading}>
            {loading ? (
              <><span className="spinner" />Submitting to Blockchain…</>
            ) : (
              '🔄 Transfer Custody On-Chain'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
