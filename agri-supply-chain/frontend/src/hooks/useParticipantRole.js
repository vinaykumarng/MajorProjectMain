import { useEffect, useState } from 'react';
import { Role } from '../utils/roles';

export function useParticipantRole(contract, account, isWrongNetwork) {
  const [result, setResult] = useState(null);
  const active = Boolean(contract && account && !isWrongNetwork);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer;

    async function refreshRole() {
      try {
        const [participant, owner] = await Promise.all([
          contract.getParticipant(account),
          contract.owner(),
        ]);
        const role = owner.toLowerCase() === account.toLowerCase()
          ? Role.ADMIN
          : participant.isAuthorized && Number(participant.role) === Role.FARMER
            ? Role.FARMER
            : Role.NONE;
        if (!cancelled) setResult({ account, contract, role });
      } catch {
        if (!cancelled) setResult({ account, contract, role: Role.NONE, failed: true });
      } finally {
        if (!cancelled) timer = setTimeout(refreshRole, 4000);
      }
    }

    refreshRole();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, account, contract]);

  if (!active || result?.account !== account || result?.contract !== contract) return null;
  return result;
}
