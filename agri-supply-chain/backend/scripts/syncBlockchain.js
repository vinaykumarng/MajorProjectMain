import { ethers } from 'ethers';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { connectDB } from '../db/connection.js';
import Batch from '../models/Batch.js';
import Transfer from '../models/Transfer.js';
import Participant from '../models/Participant.js';
import Event from '../models/Event.js';

dotenv.config();

const { abi } = JSON.parse(readFileSync(
  new URL('../../frontend/src/contracts/AgriculturalSupplyChain.json', import.meta.url),
  'utf8',
));
const roles = ['NONE', 'ADMIN', 'FARMER', 'PROCESSOR', 'DISTRIBUTOR', 'RETAILER'];
const stages = ['REGISTERED', 'WITH_PROCESSOR', 'WITH_DISTRIBUTOR', 'WITH_RETAILER', 'SOLD'];
const blockchainDate = seconds => new Date(Number(seconds) * 1000);
const upsert = (model, filter, fields) =>
  model.updateOne(filter, { $set: fields }, { upsert: true, runValidators: true });

async function syncBlockchain() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  if (!process.env.CONTRACT_ADDRESS) throw new Error('CONTRACT_ADDRESS is required');

  const address = ethers.getAddress(process.env.CONTRACT_ADDRESS);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    await connectDB();
    const contract = new ethers.Contract(address, abi, provider);
    const chain = await provider.getNetwork();
    const tip = await provider.getBlock('latest');
    if (await provider.getCode(address, tip.number) === '0x') {
      throw new Error('No deployed contract at CONTRACT_ADDRESS');
    }

    const checkpoints = mongoose.connection.collection('blockchain_checkpoints');
    const key = `${chain.chainId}:${address}`;
    const checkpoint = await checkpoints.findOne({ _id: key });
    if (!checkpoint && await checkpoints.findOne({})) {
      throw new Error('This database indexes a different deployment. Use a fresh MongoDB database.');
    }
    if (checkpoint) {
      const block = await provider.getBlock(checkpoint.blockNumber);
      if (block?.hash !== checkpoint.blockHash) {
        throw new Error('The indexed chain was reset or reorganized. Use a fresh MongoDB database for this local deployment.');
      }
    }
    const fromBlock = checkpoint ? checkpoint.blockNumber + 1 : 0;
    if (fromBlock > tip.number) return;

    const registrations = await Event.find({ eventType: 'BatchRegistered', 'data.batchIdHash': { $exists: true } })
      .select('batchId data.batchIdHash').lean();
    const batchIds = new Map(registrations.map(event => [event.data.batchIdHash, event.batchId]));

    const logs = await contract.queryFilter('*', fromBlock, tip.number);
    logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
    const batches = new Map();
    for (const log of logs) {
      const { eventName, args, transactionHash, blockNumber } = log;
      if (!args) continue;

      const event = { eventType: eventName, transactionHash, blockNumber,
        timestamp: blockchainDate(args.timestamp), data: {} };
      if (eventName === 'BatchRegistered') {
        const tx = await log.getTransaction();
        const registration = contract.interface.parseTransaction(tx);
        if (registration?.name !== 'registerBatch' ||
            ethers.id(registration.args.batchId) !== args.batchId.hash) {
          throw new Error(`Could not recover batch ID for ${transactionHash}`);
        }
        const batchId = registration.args.batchId;
        batchIds.set(args.batchId.hash, batchId);
        const batch = await contract.getBatch(batchId, { blockTag: tip.number });
        batches.set(batchId, batch);
        await upsert(Batch, { batchId }, {
          batchId,
          productName: batch.productName,
          cropType: batch.cropType,
          quantity: Number(batch.quantity),
          unit: batch.unit,
          originLocation: batch.originLocation,
          harvestDate: blockchainDate(batch.harvestDate),
          notes: batch.notes,
          currentCustodian: batch.currentCustodian,
          currentStage: stages[Number(batch.currentStage)],
          blockchainCreatedAt: blockchainDate(batch.createdAt),
        });
        event.batchId = batchId;
        event.fromAddress = args.farmer;
        event.data = {
          batchIdHash: args.batchId.hash,
          productName: batch.productName,
          cropType: batch.cropType,
          quantity: batch.quantity.toString(),
        };
      } else if (eventName === 'CustodyTransferred') {
        const batchId = batchIds.get(args.batchId.hash);
        if (!batchId) throw new Error(`Missing registration for transfer ${transactionHash}`);
        const batch = batches.get(batchId) ?? await contract.getBatch(batchId, { blockTag: tip.number });
        batches.set(batchId, batch);
        const { from, to } = args;
        const fromRole = roles[Number(args.fromRole)];
        const toRole = roles[Number(args.toRole)];
        const newStage = stages[Number(args.newStage)];
        await upsert(Transfer, { transactionHash }, {
          batchId, fromAddress: from, toAddress: to, fromRole, toRole, newStage,
          blockchainTimestamp: event.timestamp, transactionHash, blockNumber,
        });
        await Batch.updateOne({ batchId }, {
          currentCustodian: batch.currentCustodian,
          currentStage: stages[Number(batch.currentStage)],
        });
        Object.assign(event, { batchId, fromAddress: from, toAddress: to, data: { fromRole, toRole, newStage } });
      } else if (eventName === 'ParticipantAuthorized') {
        const role = roles[Number(args.role)];
        const address = args.participant.toLowerCase();
        await upsert(Participant, { address }, { address, role, isAuthorized: true, authorizedAt: event.timestamp });
        Object.assign(event, { fromAddress: address, role });
      } else if (eventName === 'ParticipantRevoked') {
        const address = args.participant.toLowerCase();
        await Participant.updateOne({ address }, { isAuthorized: false });
        event.fromAddress = address;
      } else {
        continue;
      }
      await upsert(Event, { transactionHash }, event);
    }

    await checkpoints.updateOne({ _id: key }, {
      $set: { blockNumber: tip.number, blockHash: tip.hash },
    }, { upsert: true });
    console.log(`Synced ${logs.length} logs through block ${tip.number}`);
  } finally {
    provider.destroy();
    await mongoose.disconnect();
  }
}

syncBlockchain().catch(error => {
  console.error('Error syncing blockchain:', error.message);
  process.exitCode = 1;
});
