/**
 * RealtySprint AI - Authentication Helper Module (frontend/auth.js)
 * 
 * IMPORTANT SECURITY NOTICE:
 * This module implements a DEMO-ONLY authentication mechanism for development preview.
 * It uses localStorage for session persistence and validates against fixed demo credentials.
 * DO NOT USE THIS FOR PRODUCTION SECURITY.
 */

const Auth = (function () {
  // Demo credentials configuration
  const DEMO_CONFIG = {
    EMAIL: 'admin@realtysprint.ai',
    PASSWORD: 'DemoOnly123!',
    SESSION_KEY: 'realtysprint_demo_session',
    USER: {
      name: 'Admin',
      email: 'admin@realtysprint.ai',
      role: 'Administrator'
    }
  };

  /**
   * Helper to check if a valid demo session exists in localStorage
   */
  function isAuthenticated() {
    try {
      const sessionData = localStorage.getItem(DEMO_CONFIG.SESSION_KEY);
      if (!sessionData) return false;
      const parsed = JSON.parse(sessionData);
      return parsed && parsed.authenticated === true;
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
   * Demo Login function
   */
  function login(email, password) {
    const trimmedEmail = (email || '').trim();
    const trimmedPassword = (password || '').trim();

    if (!trimmedEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }

    if (!isValidEmail(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid email format.' };
    }

    if (!trimmedPassword) {
      return { success: false, error: 'Please enter your password.' };
    }

    // Check credentials against demo constants
    if (trimmedEmail.toLowerCase() === DEMO_CONFIG.EMAIL.toLowerCase() && trimmedPassword === DEMO_CONFIG.PASSWORD) {
      const sessionPayload = {
        authenticated: true,
        user: DEMO_CONFIG.USER,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(DEMO_CONFIG.SESSION_KEY, JSON.stringify(sessionPayload));
      return { success: true };
    }

    // Friendly error for invalid credentials
    return { success: false, error: 'Invalid email or password.' };
  }

  /**
   * Demo Logout function
   */
  function logout() {
    localStorage.removeItem(DEMO_CONFIG.SESSION_KEY);
    
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
   * Get current demo user info
   */
  function getCurrentUser() {
    if (!isAuthenticated()) return null;
    try {
      const sessionData = localStorage.getItem(DEMO_CONFIG.SESSION_KEY);
      const parsed = JSON.parse(sessionData);
      return parsed.user || DEMO_CONFIG.USER;
    } catch (e) {
      return DEMO_CONFIG.USER;
    }
  }

  return {
    DEMO_CREDENTIALS: {
      email: DEMO_CONFIG.EMAIL,
      password: DEMO_CONFIG.PASSWORD
    },
    isAuthenticated: isAuthenticated,
    login: login,
    logout: logout,
    requireAuth: requireAuth,
    getCurrentUser: getCurrentUser
  };
})();
