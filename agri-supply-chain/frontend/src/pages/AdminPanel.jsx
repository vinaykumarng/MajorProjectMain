import { useState } from 'react';
import TxStatus from '../components/TxStatus.jsx';
import { Role, RoleNames, RoleIcons, RoleBadgeClass } from '../utils/roles.js';
import { shortAddress } from '../utils/formatters.js';

const ASSIGNABLE_ROLES = [
  { value: Role.FARMER, label: 'Farmer', icon: '🌾' },
  { value: Role.PROCESSOR, label: 'Processor', icon: '⚙️' },
  { value: Role.DISTRIBUTOR, label: 'Distributor', icon: '🚛' },
  { value: Role.RETAILER, label: 'Retailer', icon: '🏪' },
];

export default function AdminPanel({ contract, account, isConnected, isWrongNetwork }) {
  const [authForm, setAuthForm] = useState({ address: '', role: Role.FARMER });
  const [revokeAddr, setRevokeAddr] = useState('');
  const [lookupAddr, setLookupAddr] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revokeStatus, setRevokeStatus] = useState(null);
  const [revokeError, setRevokeError] = useState(null);

  const runTx = async (action, statusSetter, errorSetter, hashSetter) => {
    statusSetter('pending');
    errorSetter(null);
    if (hashSetter) hashSetter(null);
    try {
      const tx = await action();
      if (hashSetter) hashSetter(tx.hash);
      await tx.wait();
      statusSetter('success');
    } catch (err) {
      statusSetter('error');
      errorSetter(err.reason || err.message || 'Transaction failed');
    }
  };

  const handleAuthorize = async (e) => {
    e.preventDefault();
    if (!contract || loading) return;
    setLoading(true);
    await runTx(
      () => contract.authorizeParticipant(authForm.address.trim(), parseInt(authForm.role)),
      setTxStatus, setTxError, setTxHash
    );
    setLoading(false);
  };

  const handleRevoke = async (e) => {
    e.preventDefault();
    if (!contract) return;
    await runTx(
      () => contract.revokeParticipant(revokeAddr.trim()),
      setRevokeStatus, setRevokeError, null
    );
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const p = await contract.getParticipant(lookupAddr.trim());
      setLookupResult(p);
    } catch (err) {
      setLookupResult(null);
      alert(err.reason || err.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">⚙️ Admin Panel</h1>
        </div>
        <div className="alert alert-warning">
          <span className="alert-icon">🔌</span>
          Please connect your MetaMask wallet to use admin functions.
        </div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">⚙️ Admin Panel</h1>
        </div>
        <div className="alert alert-warning">
          <span className="alert-icon">⚠️</span>
          Please switch to <strong>Localhost 8545</strong> (Chain ID 31337).
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">⚙️ Admin Panel</h1>
        <p className="page-subtitle">
          Manage supply-chain participant roles. Only the contract owner can authorize or revoke participants.
          Transactions sent from a non-owner wallet will be rejected by the contract.
        </p>
      </div>

      <div className="alert alert-info mb-2">
        <span className="alert-icon">ℹ️</span>
        <div>
          Your address: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{account}</span><br />
          Only the <strong>contract owner (Admin)</strong> can execute these functions.
        </div>
      </div>

      {/* Authorize */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">✅</span> Authorize Participant</div>
        <form onSubmit={handleAuthorize}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="auth-address">Wallet Address *</label>
              <input
                id="auth-address"
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                placeholder="0x..."
                value={authForm.address}
                onChange={(e) => setAuthForm((p) => ({ ...p, address: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="auth-role">Role *</label>
              <select
                id="auth-role"
                className="form-select"
                value={authForm.role}
                onChange={(e) => setAuthForm((p) => ({ ...p, role: e.target.value }))}
              >
                {ASSIGNABLE_ROLES.map(({ value, label, icon }) => (
                  <option key={value} value={value}>{icon} {label}</option>
                ))}
              </select>
            </div>
          </div>

          <TxStatus status={txStatus} txHash={txHash} error={txError} />

          <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
            {loading ? <><span className="spinner" />Authorizing…</> : '✅ Authorize Participant'}
          </button>
        </form>
      </div>

      {/* Revoke */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">❌</span> Revoke Participant</div>
        <form onSubmit={handleRevoke}>
          <div className="form-group">
            <label className="form-label" htmlFor="revoke-address">Wallet Address *</label>
            <input
              id="revoke-address"
              className="form-input"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
              placeholder="0x..."
              value={revokeAddr}
              onChange={(e) => setRevokeAddr(e.target.value)}
              required
            />
          </div>
          <TxStatus status={revokeStatus} error={revokeError} />
          <button type="submit" className="btn btn-danger mt-2">❌ Revoke Participant</button>
        </form>
      </div>

      {/* Lookup */}
      <div className="card">
        <div className="card-title"><span className="icon">🔍</span> Lookup Participant</div>
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
          <input
            id="lookup-address"
            className="form-input"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', flex: 1 }}
            placeholder="0x..."
            value={lookupAddr}
            onChange={(e) => setLookupAddr(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-outline">🔍 Lookup</button>
        </form>

        {lookupResult && (
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)' }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>ROLE</div>
                <span className={`badge ${RoleBadgeClass[Number(lookupResult.role)]}`}>
                  {RoleIcons[Number(lookupResult.role)]} {RoleNames[Number(lookupResult.role)]}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>STATUS</div>
                <span className={`badge ${lookupResult.isAuthorized ? 'badge-farmer' : 'badge-none'}`}>
                  {lookupResult.isAuthorized ? '✅ Authorized' : '❌ Revoked / None'}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>AUTHORIZED AT</div>
                <span style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                  {lookupResult.authorizedAt ? new Date(Number(lookupResult.authorizedAt) * 1000).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
