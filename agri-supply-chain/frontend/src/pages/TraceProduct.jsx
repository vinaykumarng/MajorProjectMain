import { useState } from 'react';
import Timeline from '../components/Timeline.jsx';
import { formatTimestamp, formatQuantity, displayNameWithAddress } from '../utils/formatters.js';
import { RoleNames, RoleIcons, RoleBadgeClass, StageBadgeClass, StageNames } from '../utils/roles.js';

export default function TraceProduct({ contract, provider }) {
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // Read-only — uses provider, no wallet needed
  const readContract = contract; // already read-only with provider if no signer

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!readContract) {
      setError('Contract not available. Make sure the Hardhat node is running and the contract is deployed.');
      return;
    }
    setLoading(true);
    setError(null);
    setBatch(null);
    setHistory([]);
    setSearched(true);

    try {
      const exists = await readContract.batchExistsCheck(batchId.trim());
      if (!exists) {
        setError(`Batch "${batchId.trim()}" not found on-chain. Check the Batch ID and try again.`);
        setLoading(false);
        return;
      }

      const [batchData, historyData] = await Promise.all([
        readContract.getBatch(batchId.trim()),
        readContract.getBatchHistory(batchId.trim()),
      ]);

      setBatch(batchData);
      setHistory(historyData);
    } catch (err) {
      setError(err.reason || err.message || 'Failed to fetch batch data');
    } finally {
      setLoading(false);
    }
  };

  const stageNum = batch ? Number(batch.currentStage) : 0;
  const custodianRole = batch ? (history.length > 0 ? Number(history[history.length - 1].toRole) : 2) : 0;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">🔍 Trace Product</h1>
        <p className="page-subtitle">
          Look up any batch by its Batch ID. No wallet connection required — this data is publicly readable from the blockchain.
        </p>
      </div>

      {/* Search */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">🔎</span> Search by Batch ID</div>
        <form onSubmit={handleSearch}>
          <div className="search-bar">
            <input
              id="trace-batchId"
              className="form-input"
              placeholder="e.g., RICE-2026-001"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !batchId.trim()}>
              {loading ? <span className="spinner" /> : '🔍 Trace'}
            </button>
          </div>
          {!contract && (
            <div className="alert alert-warning mt-1">
              <span className="alert-icon">⚠️</span>
              Contract not connected. Make sure the Hardhat node is running and the app is configured with a deployed contract address.
            </div>
          )}
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">❌</span>
          {error}
        </div>
      )}

      {/* Not found */}
      {searched && !loading && !error && !batch && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">📦</span>
            <span className="empty-title">Batch Not Found</span>
            <span className="empty-text">No batch with that ID exists on-chain.</span>
          </div>
        </div>
      )}

      {/* Results */}
      {batch && (
        <>
          {/* Batch summary */}
          <div className="card mb-2">
            <div className="card-title">
              <span className="icon">📦</span>
              {batch.productName}
              <span style={{ marginLeft: 8 }}>
                <span className={`badge ${StageBadgeClass[stageNum]}`}>
                  {StageNames[stageNum]}
                </span>
              </span>
            </div>

            <div className="batch-detail-grid">
              <div className="batch-field">
                <span className="field-label">Batch ID</span>
                <span className="field-value mono">{batch.batchId}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Crop Type</span>
                <span className="field-value">{batch.cropType}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Quantity</span>
                <span className="field-value">{formatQuantity(batch.quantity)} {batch.unit}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Origin</span>
                <span className="field-value">{batch.originLocation}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Harvest Date</span>
                <span className="field-value">{formatTimestamp(batch.harvestDate)}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Registered</span>
                <span className="field-value">{formatTimestamp(batch.createdAt)}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Current Custodian</span>
                <span className="field-value">{displayNameWithAddress(batch.currentCustodian)}</span>
              </div>
              <div className="batch-field">
                <span className="field-label">Current Role</span>
                <span className="field-value">
                  <span className={`badge ${RoleBadgeClass[custodianRole]}`}>
                    {RoleIcons[custodianRole]} {RoleNames[custodianRole]}
                  </span>
                </span>
              </div>
            </div>

            {batch.notes && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--clr-border)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>QUALITY NOTES</span>
                <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{batch.notes}</span>
              </div>
            )}
          </div>

          {/* Provenance timeline */}
          <div className="card">
            <div className="card-title">
              <span className="icon">📜</span>
              Provenance Timeline
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                {history.length + 1} event{history.length !== 0 ? 's' : ''}
              </span>
            </div>
            <Timeline batch={batch} history={history} />

            {history.length === 0 && (
              <div className="alert alert-info mt-2">
                <span className="alert-icon">ℹ️</span>
                This batch has been registered but not yet transferred. It is still with the Farmer.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
