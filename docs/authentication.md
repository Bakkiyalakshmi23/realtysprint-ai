# RealtySprint AI — Authentication & Security Architecture

## Overview
This document outlines the authentication model for **RealtySprint AI**, detailing the transition from the Step 4B frontend preview to production server-side security.

---

## 1. Step 4B Demo Authentication (Development Only)

> [!WARNING]
> **DEMO ONLY SECURITY**: The authentication mechanism implemented in Step 4B (`frontend/auth.js`) is strictly intended for local UI evaluation and demonstration purposes.

- **Session Storage**: Uses browser `localStorage` (`realtysprint_demo_session`).
- **Validation**: Performed client-side against fixed demo constants:
  - **Demo Email**: `admin@realtysprint.ai`
  - **Demo Password**: `DemoOnly123!`
- **Session Guard**: All Control Center pages (`frontend/app/*.html`) invoke `Auth.requireAuth()` on document load to enforce UI protection.

---

## 2. Production Security Requirements

When transitioning to production backend services (Step 5+), the following architectural mandates must be enforced:

### A. Server-Side Authentication Provider
- Replace client-side credentials validation with a secure identity provider (e.g., Supabase Auth, Firebase Auth, OAuth 2.0 / OpenID Connect, or custom Node.js/Python JWT authentication).
- All passwords must be hashed using industry-standard password hashing algorithms (e.g., Argon2 or bcrypt) on the server.
- **NEVER** hardcode or store plain-text passwords or secret credentials in frontend files or client repositories.

### B. Secure Session Management
- Production sessions must use secure **HttpOnly, SameSite, SSL-encrypted cookies** or short-lived JSON Web Tokens (JWT) with secure refresh token rotation.
- `localStorage` must not store sensitive access tokens in production to mitigate Cross-Site Scripting (XSS) risks.

### C. API & Endpoint Authorization
- Frontend session guards are UI conveniences only. True access control must occur at the API server and database level (Row-Level Security / RBAC).
- Every backend endpoint serving agent data, leads, tasks, or approvals must independently verify the user's bearer token or session cookie.

### D. API Key Protection
- OpenAI API keys, WhatsApp Business tokens, and CRM API credentials must remain strictly encapsulated inside backend microservices / serverless functions.
- Client browsers must **NEVER** receive or transmit raw AI service keys.

---

## 3. Architecture Roadmap

```
PUBLIC WEBSITE (frontend/index.html)
        ↓
LOGIN PAGE (frontend/login.html)
        ↓
AUTHENTICATION SERVICE (Server-side JWT / OAuth)
        ↓
CONTROL CENTER DASHBOARD (frontend/app/)
        ↓
SECURE API GATEWAY (Node.js / Python FastAPI)
        ↓
AI AGENTS RUNTIME & DATABASE (PostgreSQL / Redis)
```
