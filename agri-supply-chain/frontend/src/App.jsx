import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import { useParticipantRole } from './hooks/useParticipantRole';
import { Role } from './utils/roles';
import Navbar from './components/Navbar';
import ParticipantOnboarding from './components/ParticipantOnboarding';
import { AdminAnomalyReviews } from './components/AnomalyReviews';
import Dashboard from './pages/Dashboard';
import RegisterBatch from './pages/RegisterBatch';
import TransferCustody from './pages/TransferCustody';
import TraceProduct from './pages/TraceProduct';
import AdminPanel from './pages/AdminPanel';
import DemoLoader from './pages/DemoLoader';
import RiskDashboard from './pages/RiskDashboard';
import './index.css';

function RestrictedPage({ allowed, roleName, status, children }) {
  if (allowed) return children;
  return (
    <section className="card" aria-live="polite">
      <h1 className="card-title">{roleName} access</h1>
      <p>{status || `Switch to an authorized ${roleName.toLowerCase()} wallet to open this page.`}</p>
    </section>
  );
}

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
  const participant = useParticipantRole(contract, account, isWrongNetwork);
  const canRegister = participant?.role === Role.FARMER;
  const canManage = participant?.role === Role.ADMIN;
  let accessStatus;
  if (!isConnected) accessStatus = 'Connect your MetaMask wallet to continue.';
  else if (isWrongNetwork) accessStatus = 'Switch MetaMask to Localhost 8545.';
  else if (!contract || participant?.failed) accessStatus = 'Could not verify your role. Check that the local contract is running.';
  else if (!participant) accessStatus = 'Checking your wallet role…';

  return (
    <BrowserRouter>
      <Navbar
        account={account}
        isConnected={isConnected}
        isWrongNetwork={isWrongNetwork}
        connecting={connecting}
        onConnect={connect}
        chainId={chainId}
        canManage={canManage}
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
            path="/participant-account"
            element={<ParticipantOnboarding key={`${account}:${chainId}`} account={account}
              signer={isWrongNetwork ? null : signer} />}
          />
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
                key={`${account}:${chainId}`}
                contract={contract}
                isConnected={isConnected}
                isWrongNetwork={isWrongNetwork}
                isAuthorizedFarmer={canRegister}
                roleStatus={accessStatus}
              />
            }
          />
          <Route
            path="/transfer"
            element={
              <TransferCustody
                key={`${account}:${chainId}`}
                contract={contract}
                account={account}
                isConnected={isConnected}
                isWrongNetwork={isWrongNetwork}
              />
            }
          />
          <Route
            path="/trace"
            element={<TraceProduct account={account} isWrongNetwork={isWrongNetwork} />}
          />
          <Route
            path="/admin"
            element={
              <RestrictedPage allowed={canManage} roleName="Admin" status={accessStatus}>
                <AdminAnomalyReviews key={account} account={account} signer={signer} />
                <ParticipantOnboarding key={account} account={account} signer={signer} contract={contract} review />
                <AdminPanel contract={contract} account={account} isConnected={isConnected} isWrongNetwork={isWrongNetwork} />
              </RestrictedPage>
            }
          />
          <Route
            path="/demo"
            element={
              <DemoLoader
                account={account}
                isConnected={isConnected}
                onConnect={connect}
                canRegister={canRegister}
                canManage={canManage}
              />
            }
          />
          <Route path="/risk-dashboard" element={<RiskDashboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
