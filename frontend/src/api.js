// Resolves base API URL dynamically. 
// When running React dev server (5173), direct requests to FastAPI port (8000).
// In production, served from the same host/port.
const API_BASE = window.location.port === '5173' ? 'http://127.0.0.1:8000' : '';

export default API_BASE;
