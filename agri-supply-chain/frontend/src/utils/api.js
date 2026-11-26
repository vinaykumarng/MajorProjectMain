const API_BASE_URL = 'http://localhost:3001/api';

/**
 * API client for backend communication
 */
export const api = {
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
