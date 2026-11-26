import { DEMO_ACCOUNTS } from '../contracts/demoAccounts.js';
import { RoleIcons } from './roles.js';

/** Lowercased address → { key, label, role, icon } for known demo wallets */
const DEMO_BY_ADDRESS = Object.fromEntries(
  Object.entries(DEMO_ACCOUNTS).map(([key, info]) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1); // Farmer, Admin, …
    const icon =
      RoleIcons[
        { ADMIN: 1, FARMER: 2, PROCESSOR: 3, DISTRIBUTOR: 4, RETAILER: 5 }[info.role]
      ] || '';
    return [
      info.address.toLowerCase(),
      { key, label, role: info.role, icon, address: info.address },
    ];
  })
);

/**
 * Look up a friendly demo identity for a wallet address (if known).
 */
export function getDemoIdentity(address) {
  if (!address) return null;
  return DEMO_BY_ADDRESS[address.toLowerCase()] || null;
}

/**
 * Prefer "🌾 Farmer" over raw hex for known demo accounts.
 */
export function displayName(address) {
  const id = getDemoIdentity(address);
  if (id) return `${id.icon} ${id.label}`.trim();
  return shortAddress(address);
}

/**
 * Name + short address, e.g. "🌾 Farmer (0x7099…79C8)"
 */
export function displayNameWithAddress(address) {
  const id = getDemoIdentity(address);
  if (id) return `${id.icon} ${id.label} (${shortAddress(address)})`.trim();
  return shortAddress(address);
}

/**
 * Format a Unix timestamp (seconds) to a human-readable string.
 */
export function formatTimestamp(unixTs) {
  if (!unixTs || unixTs === 0n || unixTs === 0) return 'N/A';
  const ts = typeof unixTs === 'bigint' ? Number(unixTs) : unixTs;
  return new Date(ts * 1000).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Shorten an Ethereum address: 0x1234...abcd
 */
export function shortAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Ordered list of demo participants for dropdowns (excludes Admin by default). */
export function getDemoParticipants({ includeAdmin = false } = {}) {
  const order = ['farmer', 'processor', 'distributor', 'retailer', 'admin'];
  return order
    .map((key) => DEMO_BY_ADDRESS[DEMO_ACCOUNTS[key].address.toLowerCase()])
    .filter((p) => p && (includeAdmin || p.role !== 'ADMIN'));
}

/**
 * Convert BigInt quantity to a readable number
 */
export function formatQuantity(qty) {
  if (qty === undefined || qty === null) return '0';
  return (typeof qty === 'bigint' ? Number(qty) : qty).toLocaleString();
}

/**
 * Stage number to display label
 */
export const STAGE_LABELS = [
  'Registered',
  'With Processor',
  'With Distributor',
  'With Retailer',
  'Sold',
];
