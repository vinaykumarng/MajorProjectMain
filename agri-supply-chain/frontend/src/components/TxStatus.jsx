export default function TxStatus({ status, txHash, error }) {
  if (!status) return null;

  const config = {
    pending: { cls: 'pending', icon: null, spinner: true, label: 'Transaction pending…' },
    success: { cls: 'success', icon: '✅', spinner: false, label: 'Transaction confirmed!' },
    error:   { cls: 'error',   icon: '❌', spinner: false, label: error || 'Transaction failed' },
  };

  const { cls, icon, spinner, label } = config[status] || config.error;

  return (
    <div className={`tx-status ${cls}`}>
      {spinner && <span className="spinner" />}
      {icon && <span>{icon}</span>}
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {txHash && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: 2, opacity: 0.8 }}>
            Tx: {txHash.slice(0, 20)}…
          </div>
        )}
      </div>
    </div>
  );
}
