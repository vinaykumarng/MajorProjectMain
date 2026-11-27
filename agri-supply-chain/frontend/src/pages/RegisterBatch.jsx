import { useState } from 'react';
import TxStatus from '../components/TxStatus.jsx';
import { api } from '../utils/api.js';
import './RegisterBatch.css';

const assessmentLabels = {
  typical: 'Within demo baseline',
  review: 'Review suggested',
  insufficient_data: 'Insufficient data',
  unavailable: 'Assessment unavailable',
  invalid: 'Check your batch details',
};

export default function RegisterBatch({
  contract,
  isConnected,
  isWrongNetwork,
  isAuthorizedFarmer,
  roleStatus,
}) {
  const [form, setForm] = useState({
    batchId: '',
    productName: '',
    cropType: '',
    quantity: '',
    unit: 'kg',
    originLocation: '',
    harvestDate: '',
    notes: '',
  });
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [checking, setChecking] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const busy = checking || loading;
  const canSubmitAssessment = Boolean(assessment && assessment.status !== 'invalid');
  const quantity = Number(form.quantity);
  const harvestTimestamp = Date.parse(form.harvestDate) / 1000;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setAssessment(null);
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (busy) return;
    setAssessment(null);
    setTxStatus(null);
    if (!form.cropType.trim() || !Number.isSafeInteger(quantity) || quantity <= 0 ||
        !Number.isSafeInteger(harvestTimestamp) || harvestTimestamp < 0) {
      setAssessment({ status: 'invalid', message: 'Enter a crop type, a positive whole quantity, and a valid harvest date.' });
      return;
    }

    setChecking(true);
    try {
      setAssessment(await api.assessRegistration({
        cropType: form.cropType.trim(),
        quantity,
        unit: form.unit,
        harvestTimestamp,
      }, AbortSignal.timeout(8000)));
    } catch {
      setAssessment({
        status: 'unavailable',
        message: 'The assessment service could not be reached. Retry the check or continue without an assessment.',
      });
    } finally {
      setChecking(false);
    }
  };

  const handleRegister = async (e) => {
    if (busy || !isAuthorizedFarmer || !canSubmitAssessment || !contract || !e.currentTarget.form.reportValidity()) return;
    setLoading(true);
    setTxStatus('pending');
    setTxHash(null);
    setTxError(null);

    try {
      const tx = await contract.registerBatch(
        form.batchId.trim(),
        form.productName.trim(),
        form.cropType.trim(),
        quantity,
        form.unit.trim(),
        form.originLocation.trim(),
        harvestTimestamp,
        form.notes.trim()
      );
      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus('success');
      setAssessment(null);
      setForm({
        batchId: '', productName: '', cropType: '', quantity: '',
        unit: 'kg', originLocation: '', harvestDate: '', notes: '',
      });
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
          <h1 className="page-title">📝 Register Batch</h1>
          <p className="page-subtitle">Connect your wallet to register a new agricultural batch on-chain.</p>
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
          <h1 className="page-title">📝 Register Batch</h1>
        </div>
        <div className="alert alert-warning">
          <span className="alert-icon">⚠️</span>
          Please switch MetaMask to <strong>Localhost 8545</strong> (Chain ID 31337).
        </div>
      </div>
    );
  }

  if (!isAuthorizedFarmer) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">📝 Register Batch</h1>
          <p className="page-subtitle">Registering a batch is reserved for authorized Farmer wallets.</p>
        </div>
        <div className="alert alert-warning" role="status">
          <span className="alert-icon">🌾</span>
          {roleStatus || 'Checking your wallet role…'}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">📝 Register Batch</h1>
        <p className="page-subtitle">
          Only accounts with the <span className="badge badge-farmer">🌾 Farmer</span> role can register new batches.
          The batch will be created on-chain under your wallet address as the initial custodian.
        </p>
      </div>

      <div className="card">
        <div className="card-title"><span className="icon">🌱</span> New Agricultural Batch</div>

        <form onSubmit={handleCheck}>
          <fieldset className="registration-fields" disabled={busy} aria-label="Batch details">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="batchId">Batch ID *</label>
                <input
                  id="batchId"
                  name="batchId"
                  className="form-input"
                  placeholder="e.g., RICE-2026-001"
                  value={form.batchId}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="productName">Product Name *</label>
                <input
                  id="productName"
                  name="productName"
                  className="form-input"
                  placeholder="e.g., Basmati Rice"
                  value={form.productName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cropType">Crop Type *</label>
                <input
                  id="cropType"
                  name="cropType"
                  className="form-input"
                  placeholder="e.g., Rice, Wheat, Cotton"
                  value={form.cropType}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="quantity">Quantity *</label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  placeholder="e.g., 1000"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="unit">Unit *</label>
                <select id="unit" name="unit" className="form-select" value={form.unit} onChange={handleChange}>
                  <option value="kg">kg</option>
                  <option value="tonnes">tonnes</option>
                  <option value="bags">bags</option>
                  <option value="quintals">quintals</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="harvestDate">Harvest Date *</label>
                <input
                  id="harvestDate"
                  name="harvestDate"
                  type="date"
                  className="form-input"
                  value={form.harvestDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="originLocation">Origin / Farm Location *</label>
              <input
                id="originLocation"
                name="originLocation"
                className="form-input"
                placeholder="e.g., Punjab, India — Amritsar District"
                value={form.originLocation}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="notes">Quality Notes (optional)</label>
              <textarea
                id="notes"
                name="notes"
                className="form-textarea"
                placeholder="Grade, certification, irrigation method, etc."
                value={form.notes}
                onChange={handleChange}
              />
            </div>
          </fieldset>

          <section className="registration-assessment" aria-labelledby="registration-assessment-title">
            <h2 id="registration-assessment-title">Anomaly assessment</h2>
            <div aria-live="polite" aria-atomic="true">
              {!assessment && (
                <p>{checking
                  ? 'Checking the batch details...'
                  : 'Check the draft before registering it. The demo model assesses rice batches by weight and harvest date.'}</p>
              )}
              {assessment && (
                <div className="registration-result" data-status={assessment.status}>
                  <div className="registration-result-heading">
                    <strong>{assessmentLabels[assessment.status]}</strong>
                    {assessment.score != null && <span>Model score {assessment.score}/100</span>}
                  </div>
                  {assessment.message && <p>{assessment.message}</p>}
                  {assessment.findings?.length > 0 && (
                    <ul>{assessment.findings.map(finding => <li key={finding}>{finding}</li>)}</ul>
                  )}
                  {assessment.status === 'review' && <p>Check the values above or register with the warning.</p>}
                </div>
              )}
            </div>
            <div className="registration-actions">
              <button type="submit" className={canSubmitAssessment ? 'btn btn-outline' : 'btn btn-primary'} disabled={busy}>
                {checking ? 'Checking...' : assessment?.status === 'unavailable' ? 'Retry check' : canSubmitAssessment ? 'Check again' : 'Check batch'}
              </button>
              {canSubmitAssessment && (
                <button type="button" className="btn btn-primary" onClick={handleRegister} disabled={busy || !contract}>
                  {loading ? 'Submitting to blockchain...' :
                    assessment.status === 'review' ? 'Register anyway' :
                    assessment.status === 'typical' ? 'Register on-chain' : 'Register without a score'}
                </button>
              )}
            </div>
          </section>

          <TxStatus status={txStatus} txHash={txHash} error={txError} />

          {txStatus === 'success' && (
            <div className="alert alert-success mt-2">
              <span className="alert-icon">🎉</span>
              Batch registered on-chain! Search for it on the <strong>Trace Product</strong> page.
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
