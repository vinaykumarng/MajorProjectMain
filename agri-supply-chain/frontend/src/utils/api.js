export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * API client for backend communication
 */
export const api = {
  getPublicTrace: async (batchId, signal) => {
    const query = new URLSearchParams({ batchId });
    const response = await fetch(`${API_BASE_URL}/public/trace?${query}`, { signal });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('The trace service is temporarily unavailable.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to trace batch.');
    return data;
  },
  // Batches
  getBatches: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/batches${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch batches');
    return response.json();
  },

  getBatch: async (batchId) => {
    const response = await fetch(`${API_BASE_URL}/batches/${batchId}`);
    if (!response.ok) throw new Error('Failed to fetch batch');
    return response.json();
  },

  getBatchHistory: async (batchId) => {
    const response = await fetch(`${API_BASE_URL}/batches/${batchId}/history`);
    if (!response.ok) throw new Error('Failed to fetch batch history');
    return response.json();
  },

  getBatchRisk: async ({ batchId, registeredAt, transferCount, signal }) => {
    const query = new URLSearchParams({ registeredAt, transferCount });
    const response = await fetch(`${API_BASE_URL}/batches/${encodeURIComponent(batchId)}/risk?${query}`, { signal });
    if (response.status === 404 || response.status === 409) {
      return { message: 'Run blockchain sync and trace the batch again to see its assessment.' };
    }
    if (!response.ok) throw new Error('Failed to fetch batch risk');
    return response.json();
  },

  assessRegistration: async (draft, signal) => {
    const response = await fetch(`${API_BASE_URL}/batches/registration-assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
      signal,
    });
    if (response.status === 400) {
      const { error } = await response.json();
      return { status: 'invalid', message: error };
    }
    if (!response.ok) throw new Error('Assessment unavailable');
    return response.json();
  },

  // Participants
  getParticipants: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/participants${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch participants');
    return response.json();
  },

  getParticipant: async (address) => {
    const response = await fetch(`${API_BASE_URL}/participants/${address}`);
    if (!response.ok) throw new Error('Failed to fetch participant');
    return response.json();
  },

  // Transfers
  getTransfers: async (address, limit = 50) => {
    const response = await fetch(`${API_BASE_URL}/transfers?address=${address}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch transfers');
    return response.json();
  },

  // Analytics
  getAnalytics: async () => {
    const response = await fetch(`${API_BASE_URL}/analytics`);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  },

  // Events
  getEvents: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/events${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  // Search
  search: async (query, limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to search');
    return response.json();
  },

  // Health check
  health: async () => {
    const response = await fetch('http://localhost:3001/health');
    if (!response.ok) throw new Error('Backend not healthy');
    return response.json();
  },
};
