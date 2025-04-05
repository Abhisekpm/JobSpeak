import axios from 'axios';

// Determine the base URL for the API
// Use Vite's env variable convention (import.meta.env), fallback to localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';

console.log(`API Client configured with base URL: ${API_BASE_URL}`); // Add log for debugging

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Add other default headers if needed, e.g., for authentication
    // 'Authorization': `Bearer ${token}`
  }
});

// You can add interceptors here for handling requests or responses globally
// For example, logging requests or handling errors

// apiClient.interceptors.request.use(config => {
//   console.log('Starting Request', config);
//   return config;
// });

// apiClient.interceptors.response.use(response => {
//   console.log('Response:', response);
//   return response;
// }, error => {
//   console.error('API Error Response:', error.response);
//   console.error('API Error Message:', error.message);
//   return Promise.reject(error);
// });

export default apiClient; 