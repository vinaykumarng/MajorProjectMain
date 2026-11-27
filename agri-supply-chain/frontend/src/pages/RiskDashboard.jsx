import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RiskDashboard.css";

export default function RiskDashboard() {
  const [batches, setBatches] = useState({});
  const [metadata, setMetadata] = useState({ totalAnalyzed: 0, averageRisk: 0, lastSync: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRiskData();
    // Poll every 30 seconds
    const interval = setInterval(fetchRiskData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      // Fetch all batches
      const response = await fetch("/api/risk");
      if (response.ok) {
        const data = await response.json();
        setBatches(data.batches);
        setMetadata(data.metadata);
      }

      // Also fetch specific batch details if we have a batch selected
      // (could expand with route param later)
    } catch (error) {
      console.error("Failed to fetch risk data:", error);
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (score) => {
    if (score < 25) return "green";
    if (score < 50) return "orange";
    return "red";
  };

  const riskLabel = (score) => {
    if (score < 25) return "Low";
    if (score < 50) return "Medium";
    return "High";
  };

  if (loading) {
    return (
      <div className="risk-loading">
        <span>Loading risk scores...</span>
      </div>
    );
  }

  return (
    <div className="risk-dashboard">
      <h2>Anomaly Risk Dashboard</h2>

      <div className="risk-metadata">
        <div>Total Batches Analyzed: {metadata.totalAnalyzed || 0}</div>
        <div>Average Risk Score: {(metadata.averageRisk || 0).toFixed(1)}</div>
        <div>Last Sync: {(metadata.lastSync || 0) ? new Date(metadata.lastSync * 1000).toLocaleString() : "Never"}</div>
      </div>

      <div className="risk-grid">
        {Object.keys(batches).length === 0 && (
          <div className="empty-state">
            No batches analyzed yet.
            <br />
            <small>Register a batch and make transfers to see risk scores.</small>
          </div>
        )}

        {Object.keys(batches).map((batchId) => {
          const batch = batches[batchId];
          const riskScore = batch.riskScore ?? 0;
          const riskEvents = batch.riskEvents ?? [];
          const riskColorVal = riskColor(riskScore);
          const riskLevel = riskLabel(riskScore);

          return (
            <div key={batchId} className="risk-card">
              <div className="risk-header">
                <span className="batch-id">{batchId}</span>
                <span className="risk-level" style={{ color: riskColorVal }}>{riskLevel}</span>
                <span className="risk-score">{riskScore.toFixed(1)}</span>
              </div>

              <div className="risk-events">
                {riskEvents.length > 0 ? (
                  riskEvents.map((event, idx) => (
                    <div key={idx} className="risk-event">
                      <span className="event-rule">{event.rule}</span>
                      <span className="event-desc">{event.description}</span>
                      <span className="event-time">
                        {new Date(event.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-events">No triggering events</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action hint */}
      <div className="action-hint">
        <small>
          Connect MetaMask to {"Localhost 8545"} and run transfers to see{" "}
          "risk events" populate here.
        </small>
      </div>
    </div>
  );
}