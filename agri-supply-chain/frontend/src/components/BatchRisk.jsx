const labels = {
  typical: 'Within demo baseline',
  review: 'Review suggested',
  insufficient_data: 'Insufficient data',
};

export default function BatchRisk({ assessment }) {
  return (
    <section className="card mb-2" aria-live="polite">
      <h2 className="card-title">Anomaly Assessment</h2>
      <p className="text-sm text-muted">
        This check uses a synthetic rice baseline for weight and timing.
      </p>
      {assessment?.status && (
        <p>
          <strong>{labels[assessment.status]}</strong>
        </p>
      )}
      {assessment?.score != null && <p>Model score {assessment.score}/100</p>}
      {assessment?.message && <p>{assessment.message}</p>}
      {assessment?.findings?.length > 0 && (
        <ul>
          {assessment.findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      )}
      {assessment?.analyzedAt && (
        <p className="text-muted text-xs">
          Analyzed {new Date(assessment.analyzedAt).toLocaleString()} using{' '}
          {assessment.modelVersion}
        </p>
      )}
    </section>
  );
}
