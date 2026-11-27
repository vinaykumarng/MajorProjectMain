import { useState } from 'react';
import { Link } from 'react-router-dom';
import { onboardingRequest, verifyWallet } from '../utils/onboarding.js';
import { Role, RoleNames } from '../utils/roles.js';

const roles = [Role.FARMER, Role.PROCESSOR, Role.DISTRIBUTOR, Role.RETAILER];
const labels = { pending: 'Pending review', active: 'Active', rejected: 'Rejected', inactive: 'Inactive' };

export default function ParticipantOnboarding({ account, signer, contract, review = false }) {
  const path = review ? '/requests' : '/me';
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState(Role.FARMER);
  const [rejection, setRejection] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = session ?? await verifyWallet(account, signer);
      setSession(current);
      await action(current);
    } catch (err) {
      if (err.status === 401) setSession(null);
      setError(err.shortMessage || err.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const refresh = current => onboardingRequest(path, { session: current }).then(setData);

  async function decide(record, decision) {
    await run(async current => {
      if (decision === 'approved') {
        const participant = await contract.getParticipant(record._id);
        if (!participant.isAuthorized || Number(participant.role) !== record.role) {
          const tx = await contract.authorizeParticipant(record._id, record.role);
          await tx.wait();
          setNotice('Authorization confirmed on-chain.');
        }
      }
      await onboardingRequest(`/requests/${record._id}`, {
        method: 'PATCH', session: current, body: { decision, reason },
      });
      setRejection(null);
      setReason('');
      await refresh(current);
    });
  }

  return (
    <section className="card mb-2">
      <h2 className="card-title">{review ? 'Participant requests' : 'Participant account'}</h2>
      <p className="text-sm text-muted">
        {review
          ? 'Review who can join the supply chain. Approving a role requires a blockchain transaction.'
          : 'Verify your wallet to apply for a supply-chain role or check your request.'}
      </p>
      {signer && (
        <button type="button" className="btn btn-outline mt-2" disabled={busy} onClick={() => run(refresh)}>
          {busy ? 'Working…' : session ? 'Refresh status' : 'Verify wallet'}
        </button>
      )}
      {!signer && <p className="mt-2">Connect MetaMask on Localhost 8545 to continue.</p>}
      {error && <p role="alert" className="alert alert-error mt-2">{error}</p>}
      {notice && <p role="status" className="alert alert-success mt-2">{notice}</p>}
      {signer && session && !review && !data && (
        <form className="mt-2" onSubmit={e => {
          e.preventDefault();
          run(async current => {
            setData(await onboardingRequest('/requests', { method: 'POST', session: current, body: { name, role } }));
          });
        }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="participant-name">Name or business name</label>
              <input id="participant-name" className="form-input" value={name} maxLength={100}
                required onChange={e => setName(e.target.value)} />
              <p className="text-sm text-muted">Use the name other participants should see in the transfer directory.</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="participant-role">Requested role</label>
              <select id="participant-role" className="form-select" value={role} onChange={e => setRole(Number(e.target.value))}>
                {roles.map(value => <option key={value} value={value}>{RoleNames[value]}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy}>Request access</button>
        </form>
      )}
      {!review && data && (
        <div className="alert alert-info mt-2">
          <div>
            <strong>{data.name} · {RoleNames[data.role]} · {labels[data.status]}</strong>
            {data.status === 'rejected' && <p>{data.reason}</p>}
            {data.status === 'active' && (
              <p><Link to={data.role === Role.FARMER ? '/register' : '/transfer'}>
                {data.role === Role.FARMER ? 'Register a batch' : 'View batches in your custody'}
              </Link></p>
            )}
          </div>
        </div>
      )}
      {review && data?.length === 0 && <p className="mt-2">No participant requests yet.</p>}
      {review && data?.map(record => (
        <article className="card mt-2" key={record._id}>
          <h3>{record.name}</h3>
          <p>{RoleNames[record.role]} · {labels[record.status]}</p>
          <p className="text-sm text-muted" style={{ overflowWrap: 'anywhere' }}>{record._id}</p>
          {record.status === 'rejected' && <p>{record.reason}</p>}
          {record.status === 'pending' && (
            <div className="mt-2">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide(record, 'approved')}>Approve role</button>{' '}
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => {
                setRejection(record._id);
                setReason('');
              }}>Reject</button>
            </div>
          )}
          {record.status === 'active' && !record.approvedAt && (
            <button type="button" className="btn btn-outline mt-2" disabled={busy} onClick={() => decide(record, 'approved')}>
              Record confirmed approval
            </button>
          )}
          {record.status === 'pending' && rejection === record._id && (
            <form className="mt-2" onSubmit={e => { e.preventDefault(); decide(record, 'rejected'); }}>
              <label className="form-label" htmlFor="rejection-reason">Reason for rejection</label>
              <input id="rejection-reason" className="form-input" required maxLength={300} value={reason}
                onChange={e => setReason(e.target.value)} />
              <button className="btn btn-outline mt-1" disabled={busy || !reason.trim()}>Confirm rejection</button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
