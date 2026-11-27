import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TraceShare from '../components/TraceShare.jsx';
import { api } from '../utils/api.js';
import './TraceProduct.css';
import Timeline from '../components/Timeline.jsx';
import BatchRisk from '../components/BatchRisk.jsx';
import { BatchReviewTrail } from '../components/AnomalyReviews.jsx';
import { formatTimestamp, formatQuantity, displayNameWithAddress } from '../utils/formatters.js';
import { RoleNames, RoleIcons, RoleBadgeClass, StageBadgeClass, StageNames } from '../utils/roles.js';

export default function TraceProduct({ account, isWrongNetwork }) {
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('batch') || '';
  const [draft, setDraft] = useState(null);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const currentResult = result?.batchId === requestedId && result?.attempt === attempt ? result : null;
  const batch = currentResult?.trace?.batch;
  const history = currentResult?.trace?.history || [];
  const error = currentResult?.error;
  const loading = Boolean(requestedId && !currentResult);
  const batchId = draft?.requestedId === requestedId ? draft.value : requestedId;

  useEffect(() => {
    if (!requestedId) return;
    const controller = new AbortController();
    api.getPublicTrace(requestedId, controller.signal)
      .then(trace => {
        if (!controller.signal.aborted) setResult({ batchId: requestedId, attempt, trace });
      })
      .catch(err => {
        if (!controller.signal.aborted) setResult({ batchId: requestedId, attempt, error: err.message });
      });
    return () => controller.abort();
  }, [requestedId, attempt]);

  function handleSearch(e) {
    e.preventDefault();
    const id = batchId.trim();
    if (!id) return;
    setDraft(null);
    setParams({ batch: id });
    setAttempt(previous => previous + 1);
  }

  const stageNum = batch ? Number(batch.currentStage) : 0;
  const custodianRole = batch ? (history.length > 0 ? Number(history[history.length - 1].toRole) : 2) : 0;

  return (
    <div className="animate-in customer-trace">
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
              onChange={(e) => setDraft({ requestedId, value: e.target.value })}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !batchId.trim()}>
              {loading ? <span className="spinner" /> : '🔍 Trace'}
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">❌</span>
          {error}
        </div>
      )}

      {loading && <p role="status" className="mb-2">Reading batch from the blockchain…</p>}

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

            <p className="trace-verification mb-2">
              <strong>Batch record found on-chain.</strong> Match the batch ID below with the package label.
            </p>

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

          {stageNum === 3 && !isWrongNetwork && account?.toLowerCase() === batch.currentCustodian.toLowerCase() && (
            <TraceShare key={batch.batchId} batchId={batch.batchId} />
          )}
          <BatchRisk assessment={currentResult.trace.assessment} />
          <BatchReviewTrail key={batch.batchId} trace={currentResult.trace} />

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
