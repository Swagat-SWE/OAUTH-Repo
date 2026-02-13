# Swagat – Okta OIDC Security Walkthrough
### Authorization Code Flow + JWKS + RBAC

# Okta OIDC Security Walkthrough (Authorization Code Flow + JWKS + RBAC)

A recruiter-friendly mini app that demonstrates a **real Okta OIDC login** using **Authorization Code Flow**, **server-side sessions**, **JWKS signature verification**, **state/nonce protection**, and **group-based authorization (RBAC)**.

Core rule: the browser should never handle raw tokens.  
Tokens stay **server-side only** in the Express session. The UI only talks to safe endpoints like `/status.json`.

---

## Full Project Walkthrough Video (30 min)
Unlisted YouTube: https://youtu.be/0XhveOfXPFs

---

## What This Project Proves (Security Controls)
- Authorization Code Flow (no implicit flow, no token in URL fragment)
- CSRF protection using `state` verification
- Replay protection using `nonce` verification
- Cryptographic token validation via JWKS (signature + issuer + audience)
- Least privilege** with RBAC using Okta Groups claim
- No token exposure to the frontend (no localStorage, no UI token display)

---

## Architecture (High-level)
- Backend (Node + Express, port 3000)
  - `/auth/okta` → redirects to Okta authorize endpoint (generates `state` + `nonce`)
  - `/callback` → validates `state`, exchanges code for tokens using client secret (server-side)
  - `requireAuth` middleware → verifies ID token with JWKS + issuer/audience + nonce
  - `/status.json` → safe status for UI (no tokens)
  - `/admin` → RBAC example (Admins group required)
- **Frontend (React + Vite, port 5173)**
  - Polls `/status.json` every 3 seconds
  - Shows verification checks and admin authorization state
  - Contains a “Watch me explain the entire project” link

---

## Tech Stack
- React + Vite
- Node.js + Express
- `express-session` (httpOnly cookie session)
- `jose` (JWT verification + remote JWKS)
- Okta OIDC (Authorization Server)

---

##  Environment Variables
This project uses a `.env` file for secrets. **Do NOT commit `.env`**.

To run this project locally, you need to start both the backend (Express server) and the frontend (React + Vite).
First, install the backend dependencies from the root of the project by running npm install.
Then start the backend server using node index.js. The Express server will run on port 3000.
Next, navigate into the ui folder and install the frontend dependencies by running npm install.
After that, start the frontend development server using npm run dev. The Vite server will run on port 5173.
Once both servers are running, you can access:
* The frontend UI at http://localhost:5173
* The backend health endpoint at http://localhost:3000/health
* The security status report at http://localhost:3000/status
* The RBAC-protected admin route at http://localhost:3000/admin
At runtime, the frontend communicates with the backend through a Vite proxy configuration. All authentication logic and token handling occur server-side in Express. Tokens are stored only in the server session and never exposed to the browser. The browser receives only a secure httpOnly session cookie.

Create a `.env` in the project root using this template:

```bash
OKTA_DOMAIN=your-okta-domain.okta.com
OKTA_CLIENT_ID=your_client_id_here
OKTA_CLIENT_SECRET=your_client_secret_here
OKTA_REDIRECT_URI=http://localhost:3000/callback
SESSION_SECRET=your_random_session_secret_here
FRONTEND_URL=http://localhost:5173



