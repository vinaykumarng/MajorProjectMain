import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tracePath } from '../utils/traceShare.js';
import TxStatus from '../components/TxStatus.jsx';
import { displayName, shortAddress } from '../utils/formatters.js';
import { api } from '../utils/api.js';
import { onboardingRequest } from '../utils/onboarding.js';
import { Role, RoleNames } from '../utils/roles.js';

const nextRoles = {
  [Role.FARMER]: Role.PROCESSOR,
  [Role.PROCESSOR]: Role.DISTRIBUTOR,
  [Role.DISTRIBUTOR]: Role.RETAILER,
};

export default function TransferCustody({ contract, account, isConnected, isWrongNetwork }) {
  const [form, setForm] = useState({ batchId: '', toAddress: '', notes: '' });
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [directory, setDirectory] = useState(null);
  const [manual, setManual] = useState(false);
  const [custody, setCustody] = useState(null);

  useEffect(() => {
    if (!contract || !account || isWrongNetwork) return;
    const controller = new AbortController();
    async function loadDirectory() {
      try {
        const participant = await contract.getParticipant(account);
        const role = participant.isAuthorized ? nextRoles[Number(participant.role)] : undefined;
        const recipients = role ? await onboardingRequest('/directory?role=' + role, { signal: controller.signal }) : [];
        if (!controller.signal.aborted) setDirectory({ role, recipients });
      } catch {
        if (!controller.signal.aborted) setDirectory({ unavailable: true });
      }
    }
    loadDirectory();
    return () => controller.abort();
  }, [account, contract, isWrongNetwork]);

  useEffect(() => {
    if (!account || isWrongNetwork) return;
    let cancelled = false;
    api.getBatches({ custodian: account, limit: 100 })
      .then(batches => { if (!cancelled) setCustody({ batches }); })
      .catch(() => { if (!cancelled) setCustody({ unavailable: true }); });
    return () => { cancelled = true; };
  }, [account, isWrongNetwork, txStatus]);

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

      <section className="card mb-2">
        <h2 className="card-title">Batches in your custody</h2>
        <p className="text-sm text-muted">This list reflects the last blockchain sync. You can also enter a batch ID below.</p>
        {!custody && <p>Loading batches…</p>}
        {custody?.unavailable && <p>The indexed batch list is unavailable.</p>}
        {custody?.batches?.length === 0 && <p>No batches are currently indexed for this wallet.</p>}
        {custody?.batches?.length > 0 && (
          <ul className="mt-1">
            {custody.batches.map(batch => (
              <li key={batch.batchId}>
                {batch.currentStage === 'WITH_RETAILER' && (
                  <Link className="btn btn-outline mt-1" to={tracePath(batch.batchId)}>
                    Share trace for {batch.batchId}
                  </Link>
                )}
                {batch.currentStage !== 'WITH_RETAILER' && (
                <button type="button" className="btn btn-outline mt-1" disabled={loading}
                  onClick={() => setForm(prev => ({ ...prev, batchId: batch.batchId }))}>
                  {batch.batchId} · {batch.productName}
                </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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
            {manual ? (
              <input id="tf-toAddress" name="toAddress" className="form-input" placeholder="0x…"
                value={form.toAddress} onChange={handleChange} required />
            ) : (
              <select id="tf-toAddress" name="toAddress" className="form-select"
                value={form.toAddress} onChange={handleChange} required>
                <option value="">{directory?.role ? 'Select an authorized ' + RoleNames[directory.role] : 'Select a recipient'}</option>
                {directory?.recipients?.map(participant => (
                  <option key={participant.address} value={participant.address}>
                    {participant.name || displayName(participant.address)} · {shortAddress(participant.address)}
                  </option>
                ))}
              </select>
            )}
            {directory?.unavailable && <p className="text-sm text-muted">The recipient directory is unavailable.</p>}
            {directory && !directory.unavailable && !directory.recipients.length &&
              <p className="text-sm text-muted">No eligible recipients found for this wallet.</p>}
            <button type="button" className="btn btn-outline mt-1" disabled={loading} onClick={() => {
              setManual(!manual);
              setForm(prev => ({ ...prev, toAddress: '' }));
            }}>{manual ? 'Choose from directory' : 'Enter wallet address'}</button>
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
