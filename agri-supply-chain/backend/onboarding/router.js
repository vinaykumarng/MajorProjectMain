import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Contract, JsonRpcProvider, isAddress, verifyMessage } from 'ethers';
import { Router } from 'express';
import mongoose from 'mongoose';

const { abi } = JSON.parse(readFileSync(
  new URL('../../frontend/src/contracts/AgriculturalSupplyChain.json', import.meta.url), 'utf8',
));
const roles = new Set([2, 3, 4, 5]);
const router = Router();
let contract;

export function getContract() {
  const address = process.env.CONTRACT_ADDRESS;
  if (!isAddress(address ?? '')) throw new Error('Configure CONTRACT_ADDRESS');
  contract ??= new Contract(address, abi, new JsonRpcProvider(
    process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
  ));
  return contract;
}

const requests = () => mongoose.connection.collection('participant_requests');
const authRecords = () => mongoose.connection.collection('wallet_auth');
const token = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export const route = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export async function requireWallet(req, res, next) {
  const value = req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const session = value && await authRecords().findOne({
    _id: digest(value), kind: 'session', expiresAt: { $gt: new Date() },
  });
  if (!session) return res.status(401).json({ error: 'Verify your wallet to continue.' });
  req.wallet = session.wallet;
  next();
}

export async function requireOwner(req, res, next) {
  if ((await getContract().owner()).toLowerCase() !== req.wallet) {
    return res.status(403).json({ error: 'Only the contract owner can review requests.' });
  }
  next();
}

async function withStatus(record) {
  const participant = await getContract().getParticipant(record._id);
  const activeRole = participant.isAuthorized ? Number(participant.role) : null;
  const status = activeRole === record.role ? 'active'
    : record.approvedAt ? 'inactive' : record.decision || 'pending';
  return { ...record, status, activeRole };
}

router.post('/challenge', route(async (req, res) => {
  const address = req.body?.address;
  if (typeof address !== 'string' || !isAddress(address)) {
    return res.status(400).json({ error: 'Enter a valid wallet address.' });
  }
  const wallet = address.toLowerCase();
  const challenge = token();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const message = [
    'AgriChain wallet sign-in',
    `Wallet: ${wallet}`,
    `Nonce: ${challenge}`,
    `Expires: ${expiresAt.toISOString()}`,
  ].join('\n');
  const records = authRecords();
  await records.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await records.insertOne({ _id: challenge, kind: 'challenge', wallet, message, expiresAt });
  res.json({ challenge, message });
}));

router.post('/session', route(async (req, res) => {
  const { challenge, signature } = req.body ?? {};
  if (!validToken(challenge) || typeof signature !== 'string' || signature.length > 140) {
    return res.status(400).json({ error: 'Invalid wallet signature or challenge.' });
  }
  const query = { _id: challenge, kind: 'challenge', expiresAt: { $gt: new Date() } };
  const records = authRecords();
  const record = await records.findOne(query);
  let signedBy;
  if (record) {
    try { signedBy = verifyMessage(record.message, signature).toLowerCase(); } catch { /* Invalid signature. */ }
  }
  if (!record || signedBy !== record.wallet || !(await records.deleteOne(query)).deletedCount) {
    return res.status(401).json({ error: 'Wallet verification failed. Request a new signature.' });
  }
  const session = token();
  await records.insertOne({
    _id: digest(session), kind: 'session', wallet: record.wallet,
    expiresAt: new Date(Date.now() + 60 * 60_000),
  });
  res.json({ session });
}));

router.get('/me', route(requireWallet), route(async (req, res) => {
  const record = await requests().findOne({ _id: req.wallet });
  res.json(record ? await withStatus(record) : null);
}));

router.post('/requests', route(requireWallet), route(async (req, res) => {
  const { name, role } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !roles.has(role)) {
    return res.status(400).json({ error: 'Enter a name and select a supply-chain role.' });
  }
  try {
    const record = { _id: req.wallet, name: name.trim(), role, createdAt: new Date() };
    const profile = await withStatus(record);
    await requests().insertOne(record);
    res.status(201).json(profile);
  } catch (error) {
    if (error.code !== 11000) throw error;
    res.status(409).json({ error: 'This wallet already has a participant request.' });
  }
}));

router.get('/requests', route(requireWallet), route(requireOwner), route(async (_req, res) => {
  const records = await requests().find().sort({ createdAt: -1 }).toArray();
  res.json(await Promise.all(records.map(withStatus)));
}));

router.patch('/requests/:wallet', route(requireWallet), route(requireOwner), route(async (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const { decision, reason } = req.body ?? {};
  const record = await requests().findOne({ _id: wallet });
  if (!record) return res.status(404).json({ error: 'Request not found.' });
  const profile = await withStatus(record);
  if (decision === 'approved' && profile.status === 'active') {
    await requests().updateOne({ _id: wallet }, { $set: { approvedAt: new Date() }, $unset: { decision: '', reason: '' } });
  } else if (decision === 'rejected' && profile.status === 'pending' &&
             typeof reason === 'string' && reason.trim() && reason.trim().length <= 300) {
    await requests().updateOne({ _id: wallet, approvedAt: { $exists: false }, decision: { $exists: false } },
      { $set: { decision, reason: reason.trim() } });
  } else {
    return res.status(409).json({ error: 'Refresh the request and check its on-chain status or rejection reason.' });
  }
  res.json(await withStatus(await requests().findOne({ _id: wallet })));
}));

router.get('/directory', route(async (req, res) => {
  const role = Number(req.query.role);
  if (!roles.has(role)) return res.status(400).json({ error: 'Select a supply-chain role.' });
  const chain = getContract();
  const logs = await chain.queryFilter(chain.filters.ParticipantAuthorized());
  const addresses = [...new Set(logs.map(log => log.args.participant.toLowerCase()))];
  const names = await requests().find({ _id: { $in: addresses } }).project({ name: 1 }).toArray();
  const profiles = new Map(names.map(({ _id, name }) => [_id, name]));
  const participants = await Promise.all(addresses.map(async address => {
    const current = await chain.getParticipant(address);
    return current.isAuthorized && Number(current.role) === role
      ? { address, name: profiles.get(address) ?? null }
      : null;
  }));
  res.json(participants.filter(Boolean));
}));

router.use((error, _req, res, _next) => {
  console.error('Participant onboarding:', error.message);
  res.status(503).json({ error: 'Participant services are temporarily unavailable.' });
});

export default router;
