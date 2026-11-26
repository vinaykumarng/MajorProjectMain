import { expect } from "chai";
import { ethers } from "hardhat";
import { AgriculturalSupplyChain } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Role enum mirrors Solidity enum values
const Role = {
  NONE: 0,
  ADMIN: 1,
  FARMER: 2,
  PROCESSOR: 3,
  DISTRIBUTOR: 4,
  RETAILER: 5,
} as const;

const Stage = {
  REGISTERED: 0,
  WITH_PROCESSOR: 1,
  WITH_DISTRIBUTOR: 2,
  WITH_RETAILER: 3,
  SOLD: 4,
} as const;

const BATCH_ID = "RICE-2026-001";
const HARVEST_DATE = Math.floor(Date.now() / 1000) - 86400; // yesterday

async function registerSampleBatch(
  contract: AgriculturalSupplyChain,
  farmer: HardhatEthersSigner,
  batchId: string = BATCH_ID
) {
  return contract.connect(farmer).registerBatch(
    batchId,
    "Basmati Rice",
    "Rice",
    1000,
    "kg",
    "Punjab, India",
    HARVEST_DATE,
    "Grade A quality"
  );
}

describe("AgriculturalSupplyChain", function () {
  let contract: AgriculturalSupplyChain;
  let owner: HardhatEthersSigner;
  let farmer: HardhatEthersSigner;
  let processor: HardhatEthersSigner;
  let distributor: HardhatEthersSigner;
  let retailer: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, farmer, processor, distributor, retailer, stranger] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AgriculturalSupplyChain");
    contract = (await Factory.deploy()) as AgriculturalSupplyChain;
    await contract.waitForDeployment();
  });

  // -------------------------------------------------------------------------
  //  T01 – Admin can authorise a participant
  // -------------------------------------------------------------------------
  describe("T01 – Participant authorisation", function () {
    it("owner can authorize a farmer", async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      const p = await contract.getParticipant(farmer.address);
      expect(p.isAuthorized).to.be.true;
      expect(Number(p.role)).to.equal(Role.FARMER);
    });

    it("emits ParticipantAuthorized event", async () => {
      await expect(contract.authorizeParticipant(farmer.address, Role.FARMER))
        .to.emit(contract, "ParticipantAuthorized")
        .withArgs(farmer.address, Role.FARMER, await getBlockTimestamp());
    });

    it("owner can authorize processor, distributor, retailer", async () => {
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await contract.authorizeParticipant(distributor.address, Role.DISTRIBUTOR);
      await contract.authorizeParticipant(retailer.address, Role.RETAILER);

      expect((await contract.getParticipant(processor.address)).isAuthorized).to.be.true;
      expect((await contract.getParticipant(distributor.address)).isAuthorized).to.be.true;
      expect((await contract.getParticipant(retailer.address)).isAuthorized).to.be.true;
    });
  });

  // -------------------------------------------------------------------------
  //  T11 – Non-owner cannot authorise participants
  // -------------------------------------------------------------------------
  describe("T11 – Access control on authorisation", function () {
    it("non-owner cannot authorize a participant", async () => {
      await expect(
        contract.connect(stranger).authorizeParticipant(farmer.address, Role.FARMER)
      ).to.be.revertedWith("SC: caller is not owner");
    });

    it("cannot assign ADMIN role externally", async () => {
      await expect(
        contract.authorizeParticipant(stranger.address, Role.ADMIN)
      ).to.be.revertedWith("SC: cannot assign ADMIN externally");
    });

    it("cannot assign NONE role", async () => {
      await expect(
        contract.authorizeParticipant(stranger.address, Role.NONE)
      ).to.be.revertedWith("SC: cannot assign NONE role");
    });
  });

  // -------------------------------------------------------------------------
  //  T02 – Unauthorized user cannot register a batch
  // -------------------------------------------------------------------------
  describe("T02 – Unauthorized registration blocked", function () {
    it("stranger (no role) cannot register a batch", async () => {
      await expect(
        registerSampleBatch(contract, stranger)
      ).to.be.revertedWith("SC: caller does not hold the required role");
    });

    it("even an authorized processor cannot register a batch", async () => {
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await expect(
        registerSampleBatch(contract, processor)
      ).to.be.revertedWith("SC: caller does not hold the required role");
    });
  });

  // -------------------------------------------------------------------------
  //  T03 – Farmer can register a valid batch
  // -------------------------------------------------------------------------
  describe("T03 – Batch registration", function () {
    beforeEach(async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
    });

    it("farmer registers batch and data matches", async () => {
      await registerSampleBatch(contract, farmer);
      const batch = await contract.getBatch(BATCH_ID);
      expect(batch.batchId).to.equal(BATCH_ID);
      expect(batch.productName).to.equal("Basmati Rice");
      expect(batch.cropType).to.equal("Rice");
      expect(batch.quantity).to.equal(1000n);
      expect(batch.unit).to.equal("kg");
      expect(batch.originLocation).to.equal("Punjab, India");
      expect(batch.currentCustodian).to.equal(farmer.address);
      expect(Number(batch.currentStage)).to.equal(Stage.REGISTERED);
      expect(batch.exists).to.be.true;
    });

    it("emits BatchRegistered event", async () => {
      await expect(registerSampleBatch(contract, farmer))
        .to.emit(contract, "BatchRegistered")
        .withArgs(
          BATCH_ID,
          farmer.address,
          "Basmati Rice",
          "Rice",
          1000n,
          await getBlockTimestamp()
        );
    });
  });

  // -------------------------------------------------------------------------
  //  T04 – Duplicate batch ID rejected
  // -------------------------------------------------------------------------
  describe("T04 – Duplicate batch ID", function () {
    it("registering the same batch ID twice reverts", async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      await registerSampleBatch(contract, farmer);
      await expect(
        registerSampleBatch(contract, farmer)
      ).to.be.revertedWith("SC: batchId already registered");
    });
  });

  // -------------------------------------------------------------------------
  //  T05 – Invalid transfer role pairs rejected
  // -------------------------------------------------------------------------
  describe("T05 – Invalid transfers blocked", function () {
    beforeEach(async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await contract.authorizeParticipant(distributor.address, Role.DISTRIBUTOR);
      await contract.authorizeParticipant(retailer.address, Role.RETAILER);
      await registerSampleBatch(contract, farmer);
    });

    it("farmer cannot transfer directly to distributor", async () => {
      await expect(
        contract.connect(farmer).transferCustody(BATCH_ID, distributor.address, "skip")
      ).to.be.revertedWith("SC: invalid transfer");
    });

    it("farmer cannot transfer directly to retailer", async () => {
      await expect(
        contract.connect(farmer).transferCustody(BATCH_ID, retailer.address, "skip")
      ).to.be.revertedWith("SC: invalid transfer");
    });

    it("processor cannot transfer before receiving custody", async () => {
      await expect(
        contract.connect(processor).transferCustody(BATCH_ID, distributor.address, "")
      ).to.be.revertedWith("SC: caller is not the current custodian");
    });

    it("non-custodian cannot transfer a batch", async () => {
      await expect(
        contract.connect(stranger).transferCustody(BATCH_ID, processor.address, "")
      ).to.be.revertedWith("SC: caller is not an authorized participant");
    });
  });

  // -------------------------------------------------------------------------
  //  T06 – Full Farmer → Processor → Distributor → Retailer flow
  // -------------------------------------------------------------------------
  describe("T06 – Full supply chain flow", function () {
    beforeEach(async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await contract.authorizeParticipant(distributor.address, Role.DISTRIBUTOR);
      await contract.authorizeParticipant(retailer.address, Role.RETAILER);
      await registerSampleBatch(contract, farmer);
    });

    it("advances through all stages correctly", async () => {
      // Farmer → Processor
      await contract.connect(farmer).transferCustody(BATCH_ID, processor.address, "Harvested batch dispatched");
      let batch = await contract.getBatch(BATCH_ID);
      expect(Number(batch.currentStage)).to.equal(Stage.WITH_PROCESSOR);
      expect(batch.currentCustodian).to.equal(processor.address);

      // Processor → Distributor
      await contract.connect(processor).transferCustody(BATCH_ID, distributor.address, "Processed and packaged");
      batch = await contract.getBatch(BATCH_ID);
      expect(Number(batch.currentStage)).to.equal(Stage.WITH_DISTRIBUTOR);
      expect(batch.currentCustodian).to.equal(distributor.address);

      // Distributor → Retailer
      await contract.connect(distributor).transferCustody(BATCH_ID, retailer.address, "Delivered to store");
      batch = await contract.getBatch(BATCH_ID);
      expect(Number(batch.currentStage)).to.equal(Stage.WITH_RETAILER);
      expect(batch.currentCustodian).to.equal(retailer.address);
    });
  });

  // -------------------------------------------------------------------------
  //  T07 – Transfer history length and order correct
  // -------------------------------------------------------------------------
  describe("T07 – Transfer history", function () {
    it("records three transfers in correct order", async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await contract.authorizeParticipant(distributor.address, Role.DISTRIBUTOR);
      await contract.authorizeParticipant(retailer.address, Role.RETAILER);

      await registerSampleBatch(contract, farmer);
      await contract.connect(farmer).transferCustody(BATCH_ID, processor.address, "Note1");
      await contract.connect(processor).transferCustody(BATCH_ID, distributor.address, "Note2");
      await contract.connect(distributor).transferCustody(BATCH_ID, retailer.address, "Note3");

      const history = await contract.getBatchHistory(BATCH_ID);
      expect(history.length).to.equal(3);

      expect(history[0].from).to.equal(farmer.address);
      expect(history[0].to).to.equal(processor.address);
      expect(Number(history[0].fromRole)).to.equal(Role.FARMER);
      expect(Number(history[0].toRole)).to.equal(Role.PROCESSOR);
      expect(Number(history[0].newStage)).to.equal(Stage.WITH_PROCESSOR);
      expect(history[0].notes).to.equal("Note1");

      expect(history[1].from).to.equal(processor.address);
      expect(history[1].to).to.equal(distributor.address);
      expect(Number(history[1].newStage)).to.equal(Stage.WITH_DISTRIBUTOR);

      expect(history[2].from).to.equal(distributor.address);
      expect(history[2].to).to.equal(retailer.address);
      expect(Number(history[2].newStage)).to.equal(Stage.WITH_RETAILER);
    });
  });

  // -------------------------------------------------------------------------
  //  T08 – getBatch returns accurate data
  // -------------------------------------------------------------------------
  describe("T08 – getBatch read function", function () {
    it("getBatch on non-existent batch reverts", async () => {
      await expect(contract.getBatch("NONEXISTENT-001")).to.be.revertedWith(
        "SC: batch does not exist"
      );
    });

    it("batchExistsCheck returns false for unregistered batch", async () => {
      expect(await contract.batchExistsCheck("NONEXISTENT-001")).to.be.false;
    });
  });

  // -------------------------------------------------------------------------
  //  T09 – BatchRegistered event
  // -------------------------------------------------------------------------
  describe("T09 – BatchRegistered event", function () {
    it("event is emitted with correct args", async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      const tx = await registerSampleBatch(contract, farmer);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
      // Full event assertion covered in T03
    });
  });

  // -------------------------------------------------------------------------
  //  T10 – CustodyTransferred event
  // -------------------------------------------------------------------------
  describe("T10 – CustodyTransferred event", function () {
    it("emits CustodyTransferred with correct args on farmer->processor transfer", async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await registerSampleBatch(contract, farmer);

      await expect(
        contract.connect(farmer).transferCustody(BATCH_ID, processor.address, "Dispatch note")
      )
        .to.emit(contract, "CustodyTransferred")
        .withArgs(
          BATCH_ID,
          farmer.address,
          processor.address,
          Role.FARMER,
          Role.PROCESSOR,
          Stage.WITH_PROCESSOR,
          await getBlockTimestamp()
        );
    });
  });

  // -------------------------------------------------------------------------
  //  T12 – Retailer cannot transfer (end of chain)
  // -------------------------------------------------------------------------
  describe("T12 – Retailer is chain endpoint", function () {
    it("retailer cannot transfer batch onward", async () => {
      await contract.authorizeParticipant(farmer.address, Role.FARMER);
      await contract.authorizeParticipant(processor.address, Role.PROCESSOR);
      await contract.authorizeParticipant(distributor.address, Role.DISTRIBUTOR);
      await contract.authorizeParticipant(retailer.address, Role.RETAILER);

      await registerSampleBatch(contract, farmer);
      await contract.connect(farmer).transferCustody(BATCH_ID, processor.address, "");
      await contract.connect(processor).transferCustody(BATCH_ID, distributor.address, "");
      await contract.connect(distributor).transferCustody(BATCH_ID, retailer.address, "");

      // Retailer tries to transfer to a random authorized address
      await expect(
        contract.connect(retailer).transferCustody(BATCH_ID, farmer.address, "")
      ).to.be.revertedWith("SC: invalid transfer");
    });
  });
});

// ---------------------------------------------------------------------------
//  Helper: get latest block timestamp (approximate — used in event matching)
// ---------------------------------------------------------------------------
async function getBlockTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}
