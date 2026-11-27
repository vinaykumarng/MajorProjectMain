import { Router } from 'express';
import { getContract, requireOwner, requireWallet, route } from '../onboarding/router.js';
import { readPublicTrace } from '../trace/publicTrace.js';
import { collection, deploymentKey, recordDecision, reviewCandidates } from './audit.js';

const router = Router();
const admin = [route(requireWallet), route(requireOwner)];

router.post('/', route(async (req, res) => {
  const { batchId, handoff } = req.body ?? {};
  if (typeof batchId !== 'string' || !batchId.trim() || !Number.isInteger(handoff) || handoff < 1 || handoff > 3) {
    return res.status(400).json({ error: 'Choose a flagged handoff to submit for review.' });
  }
  const contract = getContract();
  const trace = await readPublicTrace(contract, batchId);
  const candidate = trace && reviewCandidates(await deploymentKey(contract), trace)
    .find(item => item.handoff === handoff);
  if (!candidate) return res.status(404).json({ error: 'No timing anomaly was found for that handoff.' });

  const reviews = collection();
  try {
    await reviews.updateOne({ _id: candidate._id }, {
      $setOnInsert: { ...candidate, status: 'pending', submittedAt: new Date() },
    }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  res.json(await reviews.findOne({ _id: candidate._id }));
}));

router.get('/', ...admin, route(async (_req, res) => {
  const deployment = await deploymentKey(getContract());
  const reviews = await collection().find({ deployment }).sort({ submittedAt: -1 }).toArray();
  res.json(reviews);
}));

router.patch('/:id', ...admin, route(async (req, res) => {
  const { decision, reason } = req.body ?? {};
  if (!['accepted', 'dismissed'].includes(decision) || typeof reason !== 'string' ||
      !reason.trim() || reason.trim().length > 300) {
    return res.status(400).json({ error: 'Choose a decision and enter a reason of up to 300 characters.' });
  }
  const result = await recordDecision(
    collection(), await deploymentKey(getContract()), req.params.id, decision, reason.trim(), req.wallet,
  );
  if (!result) return res.status(409).json({ error: 'This review is no longer pending. Refresh the queue.' });
  res.json(result);
}));

router.use((error, _req, res, _next) => {
  console.error('Anomaly review:', error.message);
  res.status(503).json({ error: 'Anomaly review is temporarily unavailable.' });
});

export default router;
