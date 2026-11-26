import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { HARDHAT_CHAIN_ID } from '../utils/roles';

const CHAIN_ID = HARDHAT_CHAIN_ID;

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const isConnected = !!account;
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install the MetaMask browser extension.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send('eth_requestAccounts', []);
      const _signer = await _provider.getSigner();
      const _account = await _signer.getAddress();
      const { chainId: _chainId } = await _provider.getNetwork();

      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);
      setChainId(Number(_chainId));
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  // Refresh provider + signer so txs use the active MetaMask account
  const refreshSession = useCallback(async (preferredAccount) => {
    if (!window.ethereum) return;
    const _provider = new ethers.BrowserProvider(window.ethereum);
    const _signer = preferredAccount
      ? await _provider.getSigner(preferredAccount)
      : await _provider.getSigner();
    const _account = await _signer.getAddress();
    const { chainId: _chainId } = await _provider.getNetwork();
    setProvider(_provider);
    setSigner(_signer);
    setAccount(_account);
    setChainId(Number(_chainId));
  }, []);

  // Listen for account / network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        refreshSession(accounts[0]).catch((err) => {
          setError(err.message || 'Failed to switch account');
        });
      }
    };

    const handleChainChanged = () => {
      // Full refresh so provider/signer match the new network
      refreshSession().catch((err) => {
        setError(err.message || 'Failed to switch network');
      });
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect, refreshSession]);

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
      if (accounts.length > 0) connect();
    });
  }, []); // eslint-disable-line

  return {
    account,
    provider,
    signer,
    chainId,
    isConnected,
    isWrongNetwork,
    connecting,
    error,
    connect,
    disconnect,
  };
}
