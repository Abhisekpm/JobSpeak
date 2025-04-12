import axios from 'axios';

// Determine the base URL for the API
// Use Vite's env variable convention (import.meta.env), fallback to localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';

console.log(`API Client configured with base URL: ${API_BASE_URL}`); // Add log for debugging

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    console.log(`[Request Interceptor] Token from localStorage for ${config.url}:`, token ? 'Exists' : 'null'); // Log token presence
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`[Request Interceptor] Attaching Bearer token to ${config.url}`); // Log attachment
    } else {
      console.log(`[Request Interceptor] No token found for ${config.url}`); // Log if no token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          console.log("Refresh token not found, redirecting to login.");
          localStorage.removeItem('access_token'); // Clear potentially expired access token too
          window.location.href = '/login';
          return Promise.reject(error);
        }
        
        // Construct the refresh URL safely
        // Ensure there's exactly one slash between base URL and endpoint path
        const refreshUrl = `${API_BASE_URL.replace(/\/$/, '')}/token/refresh/`;
        console.log("Attempting token refresh at:", refreshUrl);

        const response = await axios.post(
          refreshUrl, 
          { refresh: refreshToken },
          { headers: { 'Content-Type': 'application/json' } } // Ensure content type for this specific request
        );
        
        const { access } = response.data;
        console.log("Token refresh successful. New access token obtained.");
        localStorage.setItem('access_token', access);
        
        // Update the header for the retried request
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        // Also update the header on the original request config being retried
        originalRequest.headers.Authorization = `Bearer ${access}`;
        
        return apiClient(originalRequest); // Use apiClient instance for retry to ensure interceptors are used

      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Optionally, notify the user before redirecting
        // alert("Your session has expired. Please log in again.");
        window.location.href = '/login'; // Redirect to login on refresh failure
        return Promise.reject(refreshError);
      }
    }
    
    // For non-401 errors, or if retry already happened, just reject
    return Promise.reject(error);
  }
);

export default apiClient;