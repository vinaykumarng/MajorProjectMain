import { Link } from 'react-router-dom';
import { DEMO_ACCOUNTS } from '../contracts/demoAccounts.js';
import { CONTRACT_ADDRESS } from '../contracts/contractAddress.js';
import { RoleIcons } from '../utils/roles.js';
import { shortAddress } from '../utils/formatters.js';

const ROLE_ICON = {
  ADMIN: RoleIcons[1],
  FARMER: RoleIcons[2],
  PROCESSOR: RoleIcons[3],
  DISTRIBUTOR: RoleIcons[4],
  RETAILER: RoleIcons[5],
};

const STEPS = [
  {
    title: 'Start Hardhat node',
    cmd: 'npx hardhat node',
    note: 'Terminal 1 — keep this running (localhost:8545)',
  },
  {
    title: 'Deploy contract',
    cmd: 'npx hardhat run scripts/deploy.ts --network localhost',
    note: 'Terminal 2 — writes address + ABI into the frontend',
  },
  {
    title: 'Seed demo data',
    cmd: 'npx hardhat run scripts/seedDemoData.ts --network localhost',
    note: 'Authorizes roles + registers batch RICE-2026-001',
  },
  {
    title: 'Start frontend',
    cmd: 'cd frontend && npm run dev',
    note: 'Terminal 3 — open http://localhost:5173',
  },
];

export default function DemoLoader({ account, isConnected, onConnect }) {
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">🚀 Demo Guide</h1>
        <p className="page-subtitle">
          Startup checklist, demo accounts, and how to add a new Farmer or participant.
          Seeding still runs from the terminal (on-chain — no mocks).
        </p>
      </div>

      {/* Contract status */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">📄</span> Contract</div>
        <p className="text-sm text-muted mb-1">
          Deployed address (updates after each redeploy):
        </p>
        <code
          className="form-input"
          style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', cursor: 'pointer' }}
          onClick={() => copy(CONTRACT_ADDRESS)}
          title="Click to copy"
        >
          {CONTRACT_ADDRESS || 'Not deployed yet — run deploy.ts'}
        </code>
        <div className="mt-2" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!isConnected ? (
            <button type="button" className="btn btn-primary" onClick={onConnect}>
              🦊 Connect MetaMask
            </button>
          ) : (
            <span className="alert alert-success" style={{ display: 'inline-flex', margin: 0, padding: '8px 14px' }}>
              Connected as {shortAddress(account)}
            </span>
          )}
          <Link to="/trace" className="btn btn-outline">
            🔍 Trace RICE-2026-001
          </Link>
          <Link to="/admin" className="btn btn-outline">
            ⚙️ Open Admin Panel
          </Link>
        </div>
      </div>

      {/* Startup */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">▶️</span> Start From Scratch</div>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1' }}>
          {STEPS.map((s) => (
            <li key={s.title} style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#f1f5f9' }}>{s.title}</strong>
              <div className="text-xs text-muted" style={{ margin: '4px 0 6px' }}>{s.note}</div>
              <code
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  background: 'rgba(0,0,0,0.35)',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--clr-border)',
                }}
              >
                {s.cmd}
              </code>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">
          MetaMask network: <strong>Localhost 8545</strong> · RPC <code>http://127.0.0.1:8545</code> · Chain ID <strong>31337</strong>
        </p>
      </div>

      {/* Demo accounts */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">👥</span> Seeded Demo Accounts</div>
        <p className="text-sm text-muted mb-2">
          Import private keys for these addresses from your <strong>Hardhat node</strong> terminal
          (Account #0–#4). Click an address to copy.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {Object.entries(DEMO_ACCOUNTS).map(([key, info]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--clr-border)',
              }}
            >
              <div>
                <strong style={{ color: '#f1f5f9' }}>
                  {ROLE_ICON[info.role]} {key.charAt(0).toUpperCase() + key.slice(1)}
                </strong>
                <span className="text-xs text-muted" style={{ marginLeft: 8 }}>{info.role}</span>
              </div>
              <code
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', cursor: 'pointer', color: '#94a3b8' }}
                onClick={() => copy(info.address)}
                title="Click to copy"
              >
                {info.address}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* New farmer / user */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">🌾</span> How to Add a New Farmer (or Any Role)</div>
        <p className="text-sm" style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
          There is no username/password signup. A “user” is a <strong>MetaMask wallet</strong>.
          The Admin must authorize that wallet on-chain before it can write data.
        </p>
        <ol style={{ color: '#cbd5e1', lineHeight: 1.7, paddingLeft: '1.25rem' }}>
          <li>
            Create or import a new wallet in MetaMask
            (or use another Hardhat account from the node output, e.g. Account #5+).
          </li>
          <li>
            Copy its address (starts with <code>0x</code>).
          </li>
          <li>
            Switch MetaMask to <strong>Admin</strong> ({shortAddress(DEMO_ACCOUNTS.admin.address)}).
          </li>
          <li>
            Open <Link to="/admin">Admin Panel</Link> → Authorize Participant →
            paste the address → choose <strong>Farmer</strong> (or Processor / Distributor / Retailer) → submit.
          </li>
          <li>
            Switch MetaMask to the <strong>new</strong> wallet.
          </li>
          <li>
            Open <Link to="/register">Register Batch</Link> and create a batch
            (only works if that wallet was authorized as Farmer).
          </li>
        </ol>
        <div className="alert alert-info mt-2" style={{ marginBottom: 0 }}>
          <span className="alert-icon">ℹ️</span>
          New wallets won’t show a friendly name (🌾 Farmer) in the navbar until you add them to
          <code> demoAccounts.js</code> — the on-chain role still works either way.
        </div>
      </div>

      {/* Demo story */}
      <div className="card">
        <div className="card-title"><span className="icon">🎬</span> Live Demo Flow</div>
        <ol style={{ color: '#cbd5e1', lineHeight: 1.7, paddingLeft: '1.25rem', marginBottom: 0 }}>
          <li>Show Trace for <strong>RICE-2026-001</strong> (public provenance).</li>
          <li>As Farmer → Transfer to Processor.</li>
          <li>As Processor → Transfer to Distributor.</li>
          <li>As Distributor → Transfer to Retailer.</li>
          <li>Trace again — full timeline is immutable on-chain.</li>
        </ol>
      </div>
    </div>
  );
}
