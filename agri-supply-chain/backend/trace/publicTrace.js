import { analyzeBatch } from '../anomaly/analyzeBatch.js';
import { getContract } from '../onboarding/router.js';
import { collection, deploymentKey, handoffId } from '../reviews/audit.js';

const stages = ['REGISTERED', 'WITH_PROCESSOR', 'WITH_DISTRIBUTOR', 'WITH_RETAILER', 'SOLD'];
const serialize = result => Object.fromEntries(Object.entries(result.toObject())
  .map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value]));

class MissingDeploymentError extends Error {}

export async function readPublicTrace(contract, batchId) {
  const provider = contract.runner.provider;
  const { number: blockTag } = await provider.getBlock('latest');
  const address = await contract.getAddress();
  if (await provider.getCode(address, blockTag) === '0x') {
    throw new MissingDeploymentError(`No contract deployed at ${address} on the configured blockchain.`);
  }
  if (!await contract.batchExistsCheck(batchId, { blockTag })) return null;
  const [result, records] = await Promise.all([
    contract.getBatch(batchId, { blockTag }),
    contract.getBatchHistory(batchId, { blockTag }),
  ]);
  const batch = serialize(result);
  const history = records.map(serialize);
  let assessment;
  try {
    assessment = analyzeBatch({
      ...batch,
      quantity: Number(batch.quantity),
      harvestDate: new Date(Number(batch.harvestDate) * 1000),
      blockchainCreatedAt: new Date(Number(batch.createdAt) * 1000),
      currentStage: stages[batch.currentStage],
    }, history.map(record => ({
      newStage: stages[record.newStage],
      blockchainTimestamp: new Date(Number(record.timestamp) * 1000),
    })));
  } catch (error) {
    console.error('Public trace assessment:', error.message);
    assessment = { message: 'The anomaly assessment is temporarily unavailable.' };
  }
  return { batch, history, assessment };
}

export async function getPublicTrace(req, res) {
  const batchId = req.query.batchId;
  if (typeof batchId !== 'string' || !batchId.trim()) {
    return res.status(400).json({ error: 'Enter a batch ID to trace.' });
  }
  try {
    const contract = getContract();
    const trace = await readPublicTrace(contract, batchId);
    if (!trace) return res.status(404).json({ error: 'This batch ID was not found on the blockchain.' });
    if (trace.history.length) {
      try {
        const deployment = await deploymentKey(contract);
        const ids = trace.history.map((_, index) => handoffId(deployment, trace, index + 1));
        trace.reviews = await collection().find({ _id: { $in: ids } }).sort({ handoff: 1 }).toArray();
      } catch (error) {
        console.error('Public trace reviews:', error.message);
        trace.reviewsUnavailable = true;
      }
    }
    res.set('Cache-Control', 'no-store').json(trace);
  } catch (error) {
    if (error instanceof MissingDeploymentError) {
      console.error('Public trace lookup:', error.message);
      return res.status(503).json({ error: 'The trace contract is missing on the configured blockchain. For a local Hardhat node, deploy the contract and check CONTRACT_ADDRESS in backend/.env.' });
    }
    console.error('Public trace lookup:', error.message);
    res.status(503).json({ error: 'Blockchain lookup is temporarily unavailable. Try again shortly.' });
  }
}
