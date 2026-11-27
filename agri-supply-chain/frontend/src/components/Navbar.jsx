import { NavLink } from 'react-router-dom';
import { displayName } from '../utils/formatters';

export default function Navbar({ account, isConnected, isWrongNetwork, connecting, onConnect, chainId, canManage }) {
  const networkStatus = () => {
    if (!isConnected) return { cls: 'disconnected', label: 'Not Connected' };
    if (isWrongNetwork) return { cls: 'wrong-network', label: `Wrong Network (${chainId})` };
    return { cls: 'connected', label: 'Localhost 8545' };
  };

  const { cls, label } = networkStatus();

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        <span className="brand-icon">🌾</span>
        AgriChain
      </NavLink>

      <ul className="navbar-nav">
        <li><NavLink to="/participant-account">Participant account</NavLink></li>
        <li><NavLink to="/" end>🏠 Home</NavLink></li>
        <li><NavLink to="/register">📝 Register</NavLink></li>
        <li><NavLink to="/transfer">🔄 Transfer</NavLink></li>
        <li><NavLink to="/trace">🔍 Trace</NavLink></li>
        {canManage && <li><NavLink to="/admin">⚙️ Admin</NavLink></li>}
        <li><NavLink to="/demo">🚀 Demo</NavLink></li>
      </ul>

      <div className="navbar-right">
        <div className={`network-badge ${cls}`}>
          <span className="dot" />
          {label}
        </div>
        <button className="btn-wallet" onClick={onConnect} disabled={connecting}>
          {isConnected ? (
            <>
              <span>🦊</span>
              <span className="address">{displayName(account)}</span>
            </>
          ) : connecting ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14 }} />
              Connecting…
            </>
          ) : (
            <>
              <span>🦊</span>
              Connect Wallet
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
