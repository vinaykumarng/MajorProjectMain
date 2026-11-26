import { CONTRACT_ADDRESS } from '../contracts/contractAddress.js';
import { displayNameWithAddress } from '../utils/formatters.js';

export default function Dashboard({ account, isConnected, isWrongNetwork, onConnect }) {
  return (
    <div className="animate-in">
      {/* Hero */}
      <div className="hero">
        <span className="hero-emoji">🌾</span>
        <h1 className="hero-title">
          Agricultural Supply Chain<br />
          <span>on the Blockchain</span>
        </h1>
        <p className="hero-subtitle">
          Every custody handoff — from farm to retailer — is recorded immutably on Ethereum.
          No single party controls the record. Anyone can verify the provenance of any batch.
        </p>

        {!isConnected ? (
          <button className="btn btn-primary btn-lg" onClick={onConnect}>
            🦊 Connect MetaMask to Begin
          </button>
        ) : isWrongNetwork ? (
          <div className="alert alert-warning" style={{ display: 'inline-flex', marginBottom: 0 }}>
            <span className="alert-icon">⚠️</span>
            Please switch MetaMask to <strong>Localhost 8545</strong> (Chain ID 31337)
          </div>
        ) : (
          <div className="alert alert-success" style={{ display: 'inline-flex', marginBottom: 0 }}>
            <span className="alert-icon">✅</span>
            Connected — ready to interact with the supply chain
          </div>
        )}
      </div>

      {/* Supply chain flow diagram */}
      <div className="card mb-2">
        <div className="card-title"><span className="icon">🔗</span> Supply Chain Flow</div>
        <div className="chain-flow">
          <div className="chain-step farmer">
            <span className="step-icon">🌾</span>
            <span className="step-label">Farmer</span>
          </div>
          <span className="chain-arrow">→</span>
          <div className="chain-step processor">
            <span className="step-icon">⚙️</span>
            <span className="step-label">Processor</span>
          </div>
          <span className="chain-arrow">→</span>
          <div className="chain-step distributor">
            <span className="step-icon">🚛</span>
            <span className="step-label">Distributor</span>
          </div>
          <span className="chain-arrow">→</span>
          <div className="chain-step retailer">
            <span className="step-icon">🏪</span>
            <span className="step-label">Retailer</span>
          </div>
        </div>
        <p className="text-muted text-sm" style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          Each arrow is an on-chain custody transfer — recorded, timestamped, and immutable.
        </p>
      </div>

      {/* Contract info */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Network</span>
          <span className="stat-value" style={{ fontSize: '1.1rem' }}>Hardhat Local</span>
          <span className="stat-sub">Chain ID: 31337</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Contract Address</span>
          <span className="stat-value" style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            {CONTRACT_ADDRESS || 'Not deployed yet'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Your Address</span>
          <span className="stat-value" style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>
            {account ? displayNameWithAddress(account) : '—'}
          </span>
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="card-title"><span className="icon">📋</span> How It Works</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {[
            { icon: '👑', title: 'Admin Authorizes Participants', desc: 'The contract owner grants roles to wallet addresses. Only authorized participants can write transactions.' },
            { icon: '🌾', title: 'Farmer Registers a Batch', desc: 'A Farmer with an authorized wallet creates a batch on-chain with full harvest metadata and a unique Batch ID.' },
            { icon: '🔄', title: 'Custody Transfers On-Chain', desc: 'Each step (Farmer→Processor→Distributor→Retailer) is a signed blockchain transaction — permanent and auditable.' },
            { icon: '🔍', title: 'Anyone Can Trace', desc: 'Use the Trace Product page to look up any batch by ID. No wallet needed — all provenance data is public.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <hr className="divider" />

        <div style={{ padding: '0.75rem', background: 'rgba(167,139,250,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div style={{ fontWeight: 600, color: '#a78bfa', marginBottom: 4, fontSize: '0.875rem' }}>
            🤖 Phase 2 — AI Anomaly Detection (Coming Later)
          </div>
          <p style={{ fontSize: '0.825rem', color: '#94a3b8', lineHeight: 1.5 }}>
            The contract emits <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#a78bfa' }}>BatchRegistered</code> and{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#a78bfa' }}>CustodyTransferred</code> events designed for
            ML integration. An off-chain listener can subscribe to these events and flag anomalies (unusual timing,
            unexpected role sequences, geographic inconsistencies) without any contract changes.
          </p>
        </div>
      </div>
    </div>
  );
}
