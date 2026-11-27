import { API_BASE_URL } from './api.js';

export async function onboardingRequest(path, { session, method = 'GET', body, signal } = {}) {
  const headers = {};
  if (session) headers.Authorization = `Bearer ${session}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}/onboarding${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, signal,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Participant service request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function verifyWallet(account, signer) {
  const { challenge, message } = await onboardingRequest('/challenge', {
    method: 'POST', body: { address: account },
  });
  const signature = await signer.signMessage(message);
  const { session } = await onboardingRequest('/session', { method: 'POST', body: { challenge, signature } });
  return session;
}
