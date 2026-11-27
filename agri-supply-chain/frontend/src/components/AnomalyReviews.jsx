import { useState } from 'react';
import { Link } from 'react-router-dom';
import { onboardingRequest, verifyWallet } from '../utils/onboarding.js';
import { tracePath } from '../utils/traceShare.js';
import { RoleNames } from '../utils/roles.js';
import { formatTimestamp, shortAddress } from '../utils/formatters.js';

export function HandoffAudit({ reviews }) {
  return reviews.map(review => (
    <article key={review._id} className="card mt-2">
      <h3>Handoff {review.handoff} · {RoleNames[Number(review.record.fromRole)]} to {RoleNames[Number(review.record.toRole)]}</h3>
      <p className="text-sm text-muted">{formatTimestamp(review.record.timestamp)} · {review.modelVersion}</p>
      <p>{review.finding}</p>
      <p className="text-sm text-muted">Submitted {new Date(review.submittedAt).toLocaleString()}</p>
      <p><strong>{review.status === 'pending' ? 'Pending review' : review.status === 'accepted' ? 'Finding confirmed' : 'Finding dismissed'}</strong></p>
      {review.reviewedAt && (
        <>
          <p>{review.reason}</p>
          <p className="text-sm text-muted" title={review.reviewer}>
            Reviewed by {shortAddress(review.reviewer)} on {new Date(review.reviewedAt).toLocaleString()}
          </p>
        </>
      )}
    </article>
  ));
}

export function BatchReviewTrail({ trace }) {
  const [submitted, setSubmitted] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reviews = new Map((trace.reviews ?? []).map(review => [review.handoff, review]));
  Object.values(submitted).forEach(review => {
    if (!reviews.has(review.handoff) || review.status !== 'pending') reviews.set(review.handoff, review);
  });
  const available = (trace.assessment.handoffFindings ?? []).filter(item => !reviews.has(item.handoff));
  if (!reviews.size && !available.length && !trace.reviewsUnavailable) return null;

  async function submit(handoff) {
    setBusy(true);
    setError('');
    try {
      const review = await onboardingRequest('/reviews', { method: 'POST', body: { batchId: trace.batch.batchId, handoff } });
      setSubmitted(previous => ({ ...previous, [handoff]: review }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-2" aria-label="Handoff audit trail">
      <h2 className="card-title">Handoff audit trail</h2>
      <p className="text-sm text-muted">Timing findings and admin decisions are recorded off-chain against the handoff.</p>
      {trace.reviewsUnavailable && <p>Saved reviews are temporarily unavailable.</p>}
      {available.map(({ handoff, message }) => (
        <div className="mt-2" key={handoff}>
          <p><strong>Handoff {handoff}</strong> · {message}</p>
          <button type="button" className="btn btn-outline mt-1" disabled={busy} onClick={() => submit(handoff)}>Send to admin review</button>
        </div>
      ))}
      <div aria-live="polite"><HandoffAudit reviews={[...reviews.values()]} /></div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function AdminAnomalyReviews({ account, signer }) {
  const [session, setSession] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      const token = session ?? await verifyWallet(account, signer);
      setSession(token);
      await action(token);
    } catch (err) {
      if (err.status === 401) setSession(null);
      setError(err.shortMessage || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-2">
      <h2 className="card-title">Anomaly reviews</h2>
      <button type="button" className="btn btn-outline" disabled={busy || !signer} onClick={() => run(async token => {
        setReviews(await onboardingRequest('/reviews', { session: token }));
      })}>{busy ? 'Working…' : session ? 'Refresh reviews' : 'Verify wallet and load reviews'}</button>
      {error && <p role="alert" className="alert alert-error mt-2">{error}</p>}
      {reviews?.length === 0 && <p className="mt-2">No handoffs have been submitted for review.</p>}
      {reviews?.map(review => (
        <div key={review._id} className="mt-2">
          <Link to={tracePath(review.batchId)}>{review.batchId}</Link>
          <HandoffAudit reviews={[review]} />
          {review.status === 'pending' && (
            <form className="mt-1" onSubmit={event => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              run(async token => {
                const updated = await onboardingRequest('/reviews/' + review._id, {
                  session: token, method: 'PATCH',
                  body: { decision: fields.get('decision'), reason: fields.get('reason') },
                });
                setReviews(previous => previous.map(item => item._id === updated._id ? updated : item));
              });
            }}>
              <fieldset className="registration-fields" disabled={busy}>
                <label className="form-label" htmlFor={'decision-' + review._id}>Decision</label>
                <select className="form-select" name="decision" id={'decision-' + review._id}>
                  <option value="accepted">Confirm finding</option>
                  <option value="dismissed">Dismiss finding</option>
                </select>
                <label className="form-label mt-1" htmlFor={'reason-' + review._id}>Public reason</label>
                <textarea id={'reason-' + review._id} className="form-textarea" name="reason" maxLength={300} required />
                <button className="btn btn-primary mt-1">Record decision</button>
              </fieldset>
            </form>
          )}
        </div>
      ))}
    </section>
  );
}
