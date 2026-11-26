import { RoleNames, RoleIcons, RoleBadgeClass } from '../utils/roles';
import { formatTimestamp, displayNameWithAddress } from '../utils/formatters';
import { StageNames, StageBadgeClass } from '../utils/roles';

const ROLE_DOT_CLASS = {
  2: 'farmer',
  3: 'processor',
  4: 'distributor',
  5: 'retailer',
};

/**
 * Visual provenance timeline component.
 * `items` is an array of TransferRecord structs from the contract.
 * `batch` is the Batch struct (to show the initial registration as step 0).
 */
export default function Timeline({ batch, history }) {
  if (!batch) return null;

  return (
    <div className="timeline animate-in">
      {/* Step 0: Registration */}
      <div className="timeline-item" style={{ animationDelay: '0ms' }}>
        <div className="timeline-dot registered">🌱</div>
        <div className="timeline-content">
          <div className="timeline-header">
            <span className="timeline-title">
              Batch Registered
              <span style={{ marginLeft: 8 }}>
                <span className={`badge ${StageBadgeClass[0]}`}>Registered</span>
              </span>
            </span>
            <span className="timeline-time">{formatTimestamp(batch.createdAt)}</span>
          </div>
          <div className="timeline-meta">
            <span>
              <strong>Farmer:</strong>{' '}
              <span className={`badge badge-farmer`}>
                {RoleIcons[2]} Farmer
              </span>
            </span>
            <span className="addr">
              Address:{' '}
              {displayNameWithAddress(
                history?.length > 0 ? history[0].from : batch.currentCustodian
              )}
            </span>
            {batch.notes && (
              <div className="timeline-notes">{batch.notes}</div>
            )}
          </div>
        </div>
      </div>

      {/* Steps 1+: Transfer records */}
      {history && history.map((record, idx) => {
        const fromRoleNum = Number(record.fromRole);
        const dotClass = ROLE_DOT_CLASS[Number(record.toRole)] || 'registered';
        const roleIcon = RoleIcons[Number(record.toRole)] || '📦';
        const roleName = RoleNames[Number(record.toRole)] || 'Unknown';
        const stageNum = Number(record.newStage);

        return (
          <div
            key={idx}
            className="timeline-item"
            style={{ animationDelay: `${(idx + 1) * 80}ms` }}
          >
            <div className={`timeline-dot ${dotClass}`}>{roleIcon}</div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-title">
                  Custody Transferred → {roleName}
                  <span style={{ marginLeft: 8 }}>
                    <span className={`badge ${StageBadgeClass[stageNum]}`}>
                      {StageNames[stageNum]}
                    </span>
                  </span>
                </span>
                <span className="timeline-time">{formatTimestamp(record.timestamp)}</span>
              </div>
              <div className="timeline-meta">
                <span>
                  <span className={`badge ${RoleBadgeClass[fromRoleNum]}`}>
                    {RoleIcons[fromRoleNum]} {RoleNames[fromRoleNum]}
                  </span>
                  {' → '}
                  <span className={`badge ${RoleBadgeClass[Number(record.toRole)]}`}>
                    {roleIcon} {roleName}
                  </span>
                </span>
                <span className="addr">From: {displayNameWithAddress(record.from)}</span>
                <span className="addr">To: &nbsp; {displayNameWithAddress(record.to)}</span>
                {record.notes && (
                  <div className="timeline-notes">📍 {record.notes}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
