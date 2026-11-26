import { useState } from 'react';
import TxStatus from '../components/TxStatus.jsx';
import { Role } from '../utils/roles.js';
import { formatTimestamp } from '../utils/formatters.js';

export default function RegisterBatch({ contract, account, isConnected, isWrongNetwork }) {
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

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setTxStatus('pending');
    setTxHash(null);
    setTxError(null);

    try {
      const harvestTs = form.harvestDate
        ? Math.floor(new Date(form.harvestDate).getTime() / 1000)
        : 0;

      const tx = await contract.registerBatch(
        form.batchId.trim(),
        form.productName.trim(),
        form.cropType.trim(),
        parseInt(form.quantity, 10),
        form.unit.trim(),
        form.originLocation.trim(),
        harvestTs,
        form.notes.trim()
      );
      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus('success');
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

        <form onSubmit={handleSubmit}>
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

          <TxStatus status={txStatus} txHash={txHash} error={txError} />

          {txStatus === 'success' && (
            <div className="alert alert-success mt-2">
              <span className="alert-icon">🎉</span>
              Batch registered on-chain! Search for it on the <strong>Trace Product</strong> page.
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg mt-2" disabled={loading}>
            {loading ? (
              <><span className="spinner" />Submitting to Blockchain…</>
            ) : (
              '🌾 Register Batch On-Chain'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
