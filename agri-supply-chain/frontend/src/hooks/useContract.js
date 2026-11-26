import { useMemo } from 'react';
import { ethers } from 'ethers';
import contractABI from '../contracts/AgriculturalSupplyChain.json';
import { CONTRACT_ADDRESS } from '../contracts/contractAddress';

/**
 * Returns a contract instance.
 * - If `signer` is provided, returns a write-capable instance.
 * - If only `provider` is provided, returns a read-only instance.
 * - If neither is provided, returns null.
 */
export function useContract(signer, provider) {
  return useMemo(() => {
    const runner = signer || provider;
    if (!runner || !CONTRACT_ADDRESS) return null;
    try {
      return new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, runner);
    } catch {
      return null;
    }
  }, [signer, provider]);
}
