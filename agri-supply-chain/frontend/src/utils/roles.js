// Role enum — mirrors Solidity enum values (0-indexed)
export const Role = {
  NONE: 0,
  ADMIN: 1,
  FARMER: 2,
  PROCESSOR: 3,
  DISTRIBUTOR: 4,
  RETAILER: 5,
};

export const RoleNames = {
  [Role.NONE]: 'None',
  [Role.ADMIN]: 'Admin',
  [Role.FARMER]: 'Farmer',
  [Role.PROCESSOR]: 'Processor',
  [Role.DISTRIBUTOR]: 'Distributor',
  [Role.RETAILER]: 'Retailer',
};

export const RoleIcons = {
  [Role.NONE]: '❓',
  [Role.ADMIN]: '👑',
  [Role.FARMER]: '🌾',
  [Role.PROCESSOR]: '⚙️',
  [Role.DISTRIBUTOR]: '🚛',
  [Role.RETAILER]: '🏪',
};

export const RoleBadgeClass = {
  [Role.NONE]: 'badge-none',
  [Role.ADMIN]: 'badge-admin',
  [Role.FARMER]: 'badge-farmer',
  [Role.PROCESSOR]: 'badge-processor',
  [Role.DISTRIBUTOR]: 'badge-distributor',
  [Role.RETAILER]: 'badge-retailer',
};

// Stage enum
export const Stage = {
  REGISTERED: 0,
  WITH_PROCESSOR: 1,
  WITH_DISTRIBUTOR: 2,
  WITH_RETAILER: 3,
  SOLD: 4,
};

export const StageNames = {
  [Stage.REGISTERED]: 'Registered (with Farmer)',
  [Stage.WITH_PROCESSOR]: 'With Processor',
  [Stage.WITH_DISTRIBUTOR]: 'With Distributor',
  [Stage.WITH_RETAILER]: 'With Retailer',
  [Stage.SOLD]: 'Sold',
};

export const StageBadgeClass = {
  [Stage.REGISTERED]: 'badge-stage-0',
  [Stage.WITH_PROCESSOR]: 'badge-stage-1',
  [Stage.WITH_DISTRIBUTOR]: 'badge-stage-2',
  [Stage.WITH_RETAILER]: 'badge-stage-3',
  [Stage.SOLD]: 'badge-stage-3',
};

export const HARDHAT_CHAIN_ID = 31337;
