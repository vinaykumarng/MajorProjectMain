import { analyzeBatch } from './analyzeBatch.js';

const units = new Set(['kg', 'tonnes', 'bags', 'quintals', 'lbs']);

export function assessRegistration(req, res) {
  const { cropType, quantity, unit, harvestTimestamp } = req.body ?? {};
  if (typeof cropType !== 'string' || !cropType.trim() ||
      !Number.isSafeInteger(quantity) || quantity <= 0 || !units.has(unit) ||
      !Number.isSafeInteger(harvestTimestamp) || harvestTimestamp < 0 ||
      harvestTimestamp > 8_640_000_000_000) {
    return res.status(400).json({
      error: 'Enter a crop type, a positive whole quantity, a supported unit, and a valid harvest date.',
    });
  }

  try {
    return res.json(analyzeBatch({
      cropType,
      quantity,
      unit,
      harvestDate: new Date(harvestTimestamp * 1000),
      blockchainCreatedAt: new Date(),
      currentStage: 'REGISTERED',
    }, []));
  } catch (error) {
    console.error('Error assessing registration draft:', error);
    return res.status(503).json({ error: 'The assessment service is currently unavailable.' });
  }
}
