import { readFileSync } from 'node:fs';

let model;
const day = 86_400_000;
const kilogramsPerUnit = new Map([['kg', 1], ['tonnes', 1000], ['quintals', 100], ['lbs', 0.45359237]]);
const stages = ['REGISTERED', 'WITH_PROCESSOR', 'WITH_DISTRIBUTOR', 'WITH_RETAILER'];

function averagePathLength(size) {
  if (size <= 1) return 0;
  if (size === 2) return 1;
  return 2 * (Math.log(size - 1) + 0.5772156649015329) - 2 * (size - 1) / size;
}

function scoreForest(features, { trees, sampleSize }) {
  let totalDepth = 0;
  for (const tree of trees) {
    let node = tree[0];
    let depth = 0;
    while (node.length > 1) {
      const [feature, threshold, left, right] = node;
      node = tree[Math.fround(features[feature]) <= threshold ? left : right];
      depth += 1;
    }
    totalDepth += depth + averagePathLength(node[0]);
  }
  return 2 ** (-totalDepth / (trees.length * averagePathLength(sampleSize)));
}

export function analyzeBatch(batch, transfers) {
  model ??= JSON.parse(readFileSync(new URL('./model.json', import.meta.url), 'utf8'));
  const stage = stages.indexOf(batch.currentStage);
  const result = {
    status: 'insufficient_data',
    score: null,
    modelVersion: model.version,
    analyzedAt: new Date().toISOString(),
    findings: [],
    handoffFindings: [],
  };
  const registered = batch.blockchainCreatedAt?.getTime();
  const harvested = batch.harvestDate?.getTime();
  if (Number.isFinite(registered) && Number.isFinite(harvested) && harvested > registered) {
    result.findings.push('The recorded harvest date is after registration.');
  }
  if (batch.cropType.trim().toLowerCase() !== 'rice') {
    return { ...result, message: 'The synthetic model currently covers rice batches.' };
  }
  const factor = kilogramsPerUnit.get(batch.unit.trim().toLowerCase());
  if (!factor) return { ...result, message: 'This quantity unit cannot be converted to kilograms.' };

  const dates = [registered, ...transfers.map(transfer => transfer.blockchainTimestamp?.getTime())];
  if (!model.stages[stage] || transfers.length !== stage ||
      transfers.some((transfer, index) => transfer.newStage !== stages[index + 1]) ||
      ![harvested, ...dates].every(Number.isFinite)) {
    return { ...result, message: 'The batch history is incomplete. Run blockchain sync and trace the batch again.' };
  }
  const durations = dates.slice(1).map((timestamp, index) => (timestamp - dates[index]) / day);
  if (durations.some(duration => duration < 0) || !Number.isSafeInteger(batch.quantity) || batch.quantity <= 0) {
    return { ...result, message: 'The indexed quantity or timestamps could not be scored.' };
  }

  const values = [batch.quantity * factor, (registered - harvested) / day, ...durations];
  const stageModel = model.stages[stage];
  stageModel.features.forEach(([label, unit, low, high], index) => {
    if (index === 1 && values[index] < 0) return;
    if (values[index] < low || values[index] > high) {
      const message = `${label} was ${Number(values[index].toPrecision(4))} ${unit}. The demo range is ${low} to ${high} ${unit}.`;
      result.findings.push(message);
      if (index >= 2) result.handoffFindings.push({ handoff: index - 1, message });
    }
  });
  const score = scoreForest(values, stageModel);
  if (score > stageModel.cutoff && result.findings.length === 0) {
    result.findings.push('The combination of quantity and timing was unusual for this stage in the synthetic model.');
  }
  return {
    ...result,
    score: Math.round(score * 1000) / 10,
    status: result.findings.length ? 'review' : 'typical',
  };
}
