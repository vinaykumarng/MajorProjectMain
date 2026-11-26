// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgriculturalSupplyChain
 * @author Capstone Project — Phase 1 (Blockchain Traceability)
 * @notice Immutable, role-gated custody tracking for agricultural product batches.
 *
 * PHASE 2 NOTE: The events emitted here (BatchRegistered, CustodyTransferred) are
 * the intended integration points for an AI/anomaly-detection layer.  An off-chain
 * listener can subscribe to these events, feed them to an ML model, and surface risk
 * scores to stakeholders — no contract changes required.
 *
 * ON-CHAIN vs OFF-CHAIN STRATEGY (for future production):
 * - This contract stores essential traceability fields directly on-chain.
 * - Large artefacts (lab certificates, sensor data streams, product images) should
 *   be stored off-chain (e.g., IPFS / Filecoin) and only their content hashes
 *   anchored on-chain to balance cost and verifiability.
 */
contract AgriculturalSupplyChain {

    // =========================================================================
    //  Enums
    // =========================================================================

    /// @notice Roles that a wallet address can hold in the supply chain.
    enum Role {
        NONE,        // 0 – default; not a participant
        ADMIN,       // 1 – contract owner (set in constructor, not re-assignable)
        FARMER,      // 2 – registers new product batches
        PROCESSOR,   // 3 – receives from Farmer; processes raw produce
        DISTRIBUTOR, // 4 – receives from Processor; transports to retailers
        RETAILER     // 5 – receives from Distributor; sells to consumers
    }

    /// @notice Lifecycle stage of a batch, advancing linearly through the chain.
    enum Stage {
        REGISTERED,        // 0 – just created by Farmer
        WITH_PROCESSOR,    // 1 – handed off to Processor
        WITH_DISTRIBUTOR,  // 2 – handed off to Distributor
        WITH_RETAILER,     // 3 – handed off to Retailer (end of tracked chain)
        SOLD               // 4 – reserved for future consumer-facing extension
    }

    // =========================================================================
    //  Structs
    // =========================================================================

    /// @notice On-chain record for an authorised supply-chain participant.
    struct Participant {
        address addr;
        Role    role;
        bool    isAuthorized;
        uint256 authorizedAt;  // Unix timestamp
    }

    /**
     * @notice Core data record for an agricultural product batch.
     * @dev    All fields that define the batch at the time of harvest are
     *         stored here. Future: add bytes32 documentHash for off-chain docs.
     */
    struct Batch {
        string  batchId;
        string  productName;
        string  cropType;
        uint256 quantity;
        string  unit;           // e.g., "kg", "tonnes", "bags"
        string  originLocation; // Farm name / GPS coords
        uint256 harvestDate;    // Unix timestamp supplied by Farmer
        string  notes;          // Optional quality / certification notes
        address currentCustodian;
        Stage   currentStage;
        uint256 createdAt;      // Block timestamp at registration
        bool    exists;         // Guard flag for duplicate-ID check
    }

    /**
     * @notice One entry in a batch's provenance history.
     * @dev    Appended immutably every time transferCustody succeeds.
     */
    struct TransferRecord {
        address from;
        address to;
        Role    fromRole;
        Role    toRole;
        uint256 timestamp;
        string  notes;     // Optional location / processing notes
        Stage   newStage;
    }

    // =========================================================================
    //  State Variables
    // =========================================================================

    address public owner;

    /// @notice Wallet address → participant record.
    mapping(address => Participant) public participants;

    /// @notice Batch ID string → batch record.
    mapping(string => Batch) public batches;

    /// @notice Batch ID string → ordered list of custody transfers.
    mapping(string => TransferRecord[]) private batchHistory;

    // =========================================================================
    //  Events
    // =========================================================================

    event ParticipantAuthorized(
        address indexed participant,
        Role            role,
        uint256         timestamp
    );

    event ParticipantRevoked(
        address indexed participant,
        uint256         timestamp
    );

    event BatchRegistered(
        string  indexed batchId,
        address indexed farmer,
        string          productName,
        string          cropType,
        uint256         quantity,
        uint256         timestamp
    );

    /**
     * @notice Emitted on every custody transfer — primary hook for Phase 2 AI.
     */
    event CustodyTransferred(
        string  indexed batchId,
        address indexed from,
        address indexed to,
        Role            fromRole,
        Role            toRole,
        Stage           newStage,
        uint256         timestamp
    );

    // =========================================================================
    //  Modifiers
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "SC: caller is not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            participants[msg.sender].isAuthorized,
            "SC: caller is not an authorized participant"
        );
        _;
    }

    modifier onlyRole(Role required) {
        require(
            participants[msg.sender].isAuthorized &&
            participants[msg.sender].role == required,
            "SC: caller does not hold the required role"
        );
        _;
    }

    modifier batchExists(string calldata batchId) {
        require(batches[batchId].exists, "SC: batch does not exist");
        _;
    }

    // =========================================================================
    //  Constructor
    // =========================================================================

    constructor() {
        owner = msg.sender;
        // Grant owner the ADMIN role so the admin panel can query it.
        participants[msg.sender] = Participant({
            addr:         msg.sender,
            role:         Role.ADMIN,
            isAuthorized: true,
            authorizedAt: block.timestamp
        });
        emit ParticipantAuthorized(msg.sender, Role.ADMIN, block.timestamp);
    }

    // =========================================================================
    //  Admin Functions
    // =========================================================================

    /**
     * @notice Authorise a wallet address as a supply-chain participant.
     * @param  participant  Wallet address to authorise.
     * @param  role         Role to assign (must not be NONE or ADMIN).
     */
    function authorizeParticipant(address participant, Role role) external onlyOwner {
        require(participant != address(0),        "SC: zero address");
        require(role != Role.NONE,                "SC: cannot assign NONE role");
        require(role != Role.ADMIN,               "SC: cannot assign ADMIN externally");
        require(participant != owner,             "SC: owner already has ADMIN");

        participants[participant] = Participant({
            addr:         participant,
            role:         role,
            isAuthorized: true,
            authorizedAt: block.timestamp
        });

        emit ParticipantAuthorized(participant, role, block.timestamp);
    }

    /**
     * @notice Revoke a participant's authorisation.
     * @param  participant  Address to revoke.
     */
    function revokeParticipant(address participant) external onlyOwner {
        require(participant != owner, "SC: cannot revoke owner");
        require(participants[participant].isAuthorized, "SC: not currently authorized");

        participants[participant].isAuthorized = false;
        emit ParticipantRevoked(participant, block.timestamp);
    }

    // =========================================================================
    //  Batch Registration  (Farmer only)
    // =========================================================================

    /**
     * @notice Register a new agricultural product batch on-chain.
     * @dev    Only callable by an authorised Farmer.
     *         Reverts if batchId already exists.
     */
    function registerBatch(
        string calldata batchId,
        string calldata productName,
        string calldata cropType,
        uint256         quantity,
        string calldata unit,
        string calldata originLocation,
        uint256         harvestDate,
        string calldata notes
    ) external onlyRole(Role.FARMER) {
        require(bytes(batchId).length > 0,      "SC: batchId cannot be empty");
        require(bytes(productName).length > 0,  "SC: productName cannot be empty");
        require(quantity > 0,                   "SC: quantity must be > 0");
        require(!batches[batchId].exists,       "SC: batchId already registered");

        batches[batchId] = Batch({
            batchId:          batchId,
            productName:      productName,
            cropType:         cropType,
            quantity:         quantity,
            unit:             unit,
            originLocation:   originLocation,
            harvestDate:      harvestDate,
            notes:            notes,
            currentCustodian: msg.sender,
            currentStage:     Stage.REGISTERED,
            createdAt:        block.timestamp,
            exists:           true
        });

        emit BatchRegistered(batchId, msg.sender, productName, cropType, quantity, block.timestamp);
    }

    // =========================================================================
    //  Custody Transfer
    // =========================================================================

    /**
     * @notice Transfer custody of a batch to the next authorised participant.
     *
     * Allowed transitions:
     *   FARMER      (REGISTERED)        → PROCESSOR   (WITH_PROCESSOR)
     *   PROCESSOR   (WITH_PROCESSOR)    → DISTRIBUTOR (WITH_DISTRIBUTOR)
     *   DISTRIBUTOR (WITH_DISTRIBUTOR)  → RETAILER    (WITH_RETAILER)
     *
     * @param batchId   The batch to transfer.
     * @param to        Recipient's wallet address.
     * @param notes     Optional handoff notes (location, condition, etc.).
     */
    function transferCustody(
        string calldata batchId,
        address         to,
        string calldata notes
    ) external onlyAuthorized batchExists(batchId) {
        Batch storage batch = batches[batchId];

        require(
            batch.currentCustodian == msg.sender,
            "SC: caller is not the current custodian"
        );
        require(to != address(0),               "SC: recipient is zero address");
        require(to != msg.sender,               "SC: cannot transfer to yourself");
        require(participants[to].isAuthorized,  "SC: recipient is not authorized");

        Role senderRole    = participants[msg.sender].role;
        Role recipientRole = participants[to].role;
        Stage newStage;

        // Validate and resolve the next stage.
        if (senderRole == Role.FARMER && recipientRole == Role.PROCESSOR) {
            newStage = Stage.WITH_PROCESSOR;
        } else if (senderRole == Role.PROCESSOR && recipientRole == Role.DISTRIBUTOR) {
            newStage = Stage.WITH_DISTRIBUTOR;
        } else if (senderRole == Role.DISTRIBUTOR && recipientRole == Role.RETAILER) {
            newStage = Stage.WITH_RETAILER;
        } else {
            revert("SC: invalid transfer - role pair not allowed in supply chain order");
        }

        // Verify stage consistency (guards against out-of-order replay).
        require(
            _expectedStageForRole(senderRole) == batch.currentStage,
            "SC: batch stage does not match sender role"
        );

        // Append immutable history record.
        batchHistory[batchId].push(TransferRecord({
            from:      msg.sender,
            to:        to,
            fromRole:  senderRole,
            toRole:    recipientRole,
            timestamp: block.timestamp,
            notes:     notes,
            newStage:  newStage
        }));

        // Update batch state.
        batch.currentCustodian = to;
        batch.currentStage     = newStage;

        emit CustodyTransferred(
            batchId,
            msg.sender,
            to,
            senderRole,
            recipientRole,
            newStage,
            block.timestamp
        );
    }

    // =========================================================================
    //  Public Read Functions
    // =========================================================================

    /**
     * @notice Retrieve all fields of a batch record.
     * @dev    Reverts if batch does not exist — caller can check first with
     *         batchExists mapping or catch the revert.
     */
    function getBatch(string calldata batchId)
        external
        view
        batchExists(batchId)
        returns (Batch memory)
    {
        return batches[batchId];
    }

    /**
     * @notice Retrieve the complete, ordered custody history for a batch.
     * @return Array of TransferRecord structs (empty if no transfers yet).
     */
    function getBatchHistory(string calldata batchId)
        external
        view
        batchExists(batchId)
        returns (TransferRecord[] memory)
    {
        return batchHistory[batchId];
    }

    /**
     * @notice Check whether a batch ID has been registered.
     */
    function batchExistsCheck(string calldata batchId) external view returns (bool) {
        return batches[batchId].exists;
    }

    /**
     * @notice Return participant record for any address.
     */
    function getParticipant(address addr) external view returns (Participant memory) {
        return participants[addr];
    }

    /**
     * @notice Quick auth check used by the frontend.
     */
    function isParticipantAuthorized(address addr) external view returns (bool) {
        return participants[addr].isAuthorized;
    }

    // =========================================================================
    //  Internal Helpers
    // =========================================================================

    /**
     * @dev Returns the expected current Stage for a given sender Role,
     *      used to validate stage/role consistency in transferCustody.
     */
    function _expectedStageForRole(Role role) internal pure returns (Stage) {
        if (role == Role.FARMER)      return Stage.REGISTERED;
        if (role == Role.PROCESSOR)   return Stage.WITH_PROCESSOR;
        if (role == Role.DISTRIBUTOR) return Stage.WITH_DISTRIBUTOR;
        revert("SC: sender role cannot initiate a transfer");
    }
}
