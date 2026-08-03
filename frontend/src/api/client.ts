import axios from 'axios';

// Singleton HTTP Client
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Generic interceptors for global error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    // Future: trigger toast notification
    return Promise.reject(error);
  }
);
