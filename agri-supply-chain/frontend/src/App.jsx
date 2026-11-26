import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import RegisterBatch from './pages/RegisterBatch';
import TransferCustody from './pages/TransferCustody';
import TraceProduct from './pages/TraceProduct';
import AdminPanel from './pages/AdminPanel';
import DemoLoader from './pages/DemoLoader';
import './index.css';

export default function App() {
  const {
    account,
    provider,
    signer,
    chainId,
    isConnected,
    isWrongNetwork,
    connecting,
    error,
    connect,
  } = useWallet();

  const contract = useContract(signer, provider);

  return (
    <BrowserRouter>
      <Navbar
        account={account}
        isConnected={isConnected}
        isWrongNetwork={isWrongNetwork}
        connecting={connecting}
        onConnect={connect}
        chainId={chainId}
      />

      {error && (
        <div className="alert alert-error" style={{ margin: '1rem' }}>
          <span className="alert-icon">❌</span>
          {error}
        </div>
      )}

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                account={account}
                isConnected={isConnected}
                isWrongNetwork={isWrongNetwork}
                onConnect={connect}
              />
            }
          />
          <Route
            path="/register"
            element={
              <RegisterBatch
                contract={contract}
                account={account}
                isConnected={isConnected}
                isWrongNetwork={isWrongNetwork}
              />
            }
          />
          <Route
            path="/transfer"
            element={
              <TransferCustody
                contract={contract}
                account={account}
                isConnected={isConnected}
                isWrongNetwork={isWrongNetwork}
              />
            }
          />
          <Route
            path="/trace"
            element={<TraceProduct contract={contract} provider={provider} />}
          />
          <Route
            path="/admin"
            element={
              <AdminPanel
                contract={contract}
                account={account}
                isConnected={isConnected}
                isWrongNetwork={isWrongNetwork}
              />
            }
          />
          <Route
            path="/demo"
            element={
              <DemoLoader
                account={account}
                isConnected={isConnected}
                onConnect={connect}
              />
            }
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}