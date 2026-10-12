/**
 * RealtySprint AI - Authentication Helper Module (frontend/auth.js)
 *
 * Handles client-side authentication state, session storage, and route protection.
 * Communicates with the backend API (/api/auth/login) for authentication.
 */

// Determine API base URL dynamically based on environment
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocal ? 'http://localhost:4000' : "https://api.realitysprint.co.in";

const Auth = (function () {
  const SESSION_KEY = 'realtysprint_demo_session';
  const DEFAULT_USER = {
    name: 'User',
    email: '',
    role: 'User'
  };

  /**
   * Helper to check if a valid session exists in sessionStorage
   */
  function isAuthenticated() {
    try {
      const sessionData = sessionStorage.getItem(SESSION_KEY);
      if (!sessionData) return false;
      const parsed = JSON.parse(sessionData);
      return parsed && parsed.authenticated === true && !!parsed.token;
    } catch (e) {
      return false;
    }
  }

  /**
   * Helper to validate email format
   */
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  /**
   * Login function using backend API
   */
  async function login(email, password) {
    const trimmedEmail = (email || '').trim();
    const trimmedPassword = (password || '').trim();

    if (!trimmedEmail) return { success: false, error: 'Please enter your email address.' };
    if (!isValidEmail(trimmedEmail)) return { success: false, error: 'Please enter a valid email format.' };
    if (!trimmedPassword) return { success: false, error: 'Please enter your password.' };

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword })
      });

      const data = await response.json();
      if (data.success && data.token) {
        const sessionPayload = {
          authenticated: true,
          token: data.token,
          user: data.user,
          timestamp: new Date().toISOString()
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionPayload));
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Invalid email or password.' };
      }
    } catch (e) {
      console.error('Login error:', e);
      return { success: false, error: 'Network error or server is unavailable.' };
    }
  }

  /**
   * Logout function
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);

    // Determine path back to login.html
    const path = window.location.pathname;
    if (path.includes('/app/')) {
      window.location.href = '../login.html';
    } else {
      window.location.href = 'login.html';
    }
  }

  /**
   * Page guard - Require authentication or redirect to login.html
   */
  function requireAuth() {
    if (!isAuthenticated()) {
      const path = window.location.pathname;
      if (path.includes('/app/')) {
        window.location.href = '../login.html';
      } else {
        window.location.href = 'login.html';
      }
    }
  }

  /**
   * Get current user info
   */
  function getCurrentUser() {
    if (!isAuthenticated()) return null;
    try {
      const sessionData = sessionStorage.getItem(SESSION_KEY);
      const parsed = JSON.parse(sessionData);
      return parsed.user || DEFAULT_USER;
    } catch (e) {
      return DEFAULT_USER;
    }
  }

  return {
    isAuthenticated: isAuthenticated,
    login: login,
    logout: logout,
    requireAuth: requireAuth,
    getCurrentUser: getCurrentUser
  };
})();
