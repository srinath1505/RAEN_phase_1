// RAEN Frontend API Helper
// Base configuration
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api'; // Change to your production backend URL

// Storage keys
const TOKEN_KEY = 'raen_auth_token';
const SESSION_ID_KEY = 'raen_session_id';

// Auth token management
function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Session ID management
function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function setSessionId(sessionId) {
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
}

// Guest cart management (kept for backward compatibility during migration)
function getGuestCart() {
  try {
    const cart = localStorage.getItem('raen_cart');
    return cart ? JSON.parse(cart) : [];
  } catch (e) {
    return [];
  }
}

function setGuestCart(cart) {
  localStorage.setItem('raen_cart', JSON.stringify(cart));
}

function clearGuestCart() {
  localStorage.removeItem('raen_cart');
}

// API request helper
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const sessionId = getSessionId();
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Session-Id': sessionId,
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const result = await response.json();
    
    if (!response.ok) {
      const err = new Error(result.message || 'Request failed');
      err.status = response.status;
      throw err;
    }
    
    // Unwrap data if it's in the standard API response format
    return result.data !== undefined ? result.data : result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// API methods
async function apiGet(endpoint, options = {}) {
  return apiRequest(endpoint, {
    method: 'GET',
    ...options
  });
}

async function apiPost(endpoint, body, options = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options
  });
}

async function apiPatch(endpoint, body, options = {}) {
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...options
  });
}

async function apiDelete(endpoint, options = {}) {
  return apiRequest(endpoint, {
    method: 'DELETE',
    ...options
  });
}

// Error handling
function handleApiError(error, fallbackMessage = 'An error occurred') {
  console.error('API Error:', error);
  const message = error.message || fallbackMessage;
  showToast(message, 'error');
  return message;
}

// Toast notifications
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let container = document.getElementById('raen-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'raen-toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'error' ? '#ba1a1a' : type === 'success' ? '#2e7d32' : '#000'};
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 400px;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
}

// Add animations to document
if (!document.getElementById('raen-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'raen-toast-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Loading state helper
function setLoadingState(element, isLoading, originalText = 'Submit') {
  if (!element) return;
  
  if (isLoading) {
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.textContent = 'Loading...';
    element.style.opacity = '0.6';
    element.style.cursor = 'not-allowed';
  } else {
    element.disabled = false;
    element.textContent = element.dataset.originalText || originalText;
    element.style.opacity = '1';
    element.style.cursor = 'pointer';
  }
}

// Check if user is logged in
function isLoggedIn() {
  return !!getAuthToken();
}

// Export for use in other scripts
window.RaenAPI = {
  API_BASE_URL,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getSessionId,
  setSessionId,
  getGuestCart,
  setGuestCart,
  clearGuestCart,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  handleApiError,
  showToast,
  setLoadingState,
  isLoggedIn
};
