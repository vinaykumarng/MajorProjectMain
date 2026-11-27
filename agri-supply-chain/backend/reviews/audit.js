import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

export const collection = () => mongoose.connection.collection('anomaly_reviews');
export const deploymentKey = async contract =>
  `${(await contract.runner.provider.getNetwork()).chainId}:${(await contract.getAddress()).toLowerCase()}`;

export function handoffId(deployment, trace, handoff) {
  const identity = [deployment, trace.batch.batchId, trace.batch.createdAt, trace.history.slice(0, handoff)];
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

export function reviewCandidates(deployment, trace) {
  const { batch, history, assessment } = trace;
  return (assessment.handoffFindings ?? []).map(({ handoff, message }) => {
    const record = history[handoff - 1];
    const _id = handoffId(deployment, trace, handoff);
    return { _id, deployment, batchId: batch.batchId, handoff, record,
      finding: message, modelVersion: assessment.modelVersion };
  });
}

export async function recordDecision(reviews, deployment, id, decision, reason, reviewer) {
  return reviews.findOneAndUpdate(
    { _id: id, deployment, status: 'pending' },
    { $set: { status: decision, reason, reviewer, reviewedAt: new Date() } },
    { returnDocument: 'after' },
  );
}
