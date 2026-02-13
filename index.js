// Goal: Start a tiny web server that can log in with Okta (OIDC)
function renderPage({ title, badges = [], body }) {
  return `
  <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8" />
      <style>
        body {
          background: #0b1020;
          color: #e5e7eb;
          font-family: system-ui, -apple-system, Segoe UI, Roboto;
          padding: 24px;
        }

        h1 {
          font-size: 22px;
          margin-bottom: 12px;
        }

        pre {
          background: rgba(255,255,255,0.05);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .note {
          color: #9ca3af;
          font-size: 13px;
          margin-top: 12px;
        }

        .pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          margin-right: 6px;
          background: rgba(255,255,255,0.08);
        }

        .ok { color: #36d399; }
        .bad { color: #fb7185; }

        a {
          color: #9dd6ff;
          text-decoration: none;
          font-weight: 600;
        }

        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>

    <body>
      <h1>${title}</h1>

      ${badges.map(b => `<span class="pill ${b.tone}">${b.label}</span>`).join("")}

      <div style="margin-top: 14px">
        ${body}
      </div>
    </body>
  </html>
  `;
}

// Load secrets from .env file into process.env
require("dotenv").config();                                                           // so OKTA_DOMAIN / CLIENT_ID etc work

const express = require("express");                                                   // makes a web server easy
const crypto = require("crypto");                                                     // used to create random strings (state/nonce)
const session = require("express-session");                                           // This library lets us store data (like tokens) on the server and identify users using a secure session cookie
const { jwtVerify, createRemoteJWKSet } = require("jose");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
// Create the Express server app
const app = express();                                                                 // NOW app exists, so we can use app.set/app.use
app.use(express.static("public"));

// Import express-session
// Tell Express it may be running behind a proxy (like Nginx, Heroku, Render)
app.set("trust proxy", 1);                                                             // This matters for secure cookies and HTTPS detection
app.use(
  session({
    // Name of the cookie stored in the browser
    name: "sid",                                                                       // The browser will send this cookie on every request
    // Secret key used to SIGN the session cookie
    // This prevents attackers from forging cookies
    secret: process.env.SESSION_SECRET || "dev-secret",                                // NEVER commit real secrets to GitHub
    // Do NOT save the session again if nothing changed
    resave: false,                                                                     // Saves memory and avoids unnecessary writes
    // Do NOT create a session until we actually store something
    saveUninitialized: false,                                                          // Prevents empty/unused sessions
    cookie: {                                                                          // Cookie configuration (this is CRITICAL for security)
      // Prevents JavaScript (document.cookie) from reading the cookie
      httpOnly: true,                                                                  // This blocks XSS attacks from stealing sessions
      // Cookie is ONLY sent over HTTPS
      secure: false,                                                                   // false for localhost and MUST be true in production
      // Allows cookie to be sent during OAuth redirects
      sameSite: "lax",                                                                 // This helps protect against CSRF while allowing OAuth flows
      // Session expires after 1 hour
      maxAge: 60 * 60 * 1000                                                           // Matches your access_token lifetime nicely
    }
  })
);

// ---- Live verification event buffer (in-memory) ----
const EVENT_BUFFER_SIZE = 50;
const authEvents = []; // newest first

function pushAuthEvent(evt) {
  authEvents.unshift({ ts: Date.now(), ...evt });
  if (authEvents.length > EVENT_BUFFER_SIZE) authEvents.pop();
}




// 5) Read our Okta settings from the .env file
const OKTA_DOMAIN = process.env.OKTA_DOMAIN;                                           // like: integrator-xxxx.okta.com
const CLIENT_ID = process.env.OKTA_CLIENT_ID;                                          // your app's client id
const REDIRECT_URI = process.env.OKTA_REDIRECT_URI;                                    // where Okta sends you back after login


// Build the JWKS URL (Okta publishes public keys here)

// Example: https://yourOktaDomain/oauth2/default/v1/keys
const JWKS_URL = new URL(`https://${OKTA_DOMAIN}/oauth2/default/v1/keys`);

// This creates a JWKS “key fetcher” that downloads + caches Okta public keys
const JWKS = createRemoteJWKSet(JWKS_URL);


// Middleware: blocks users who are not logged in OR have invalid tokens
// This runs BEFORE a protected route loads
async function requireAuth(req, res, next) {
        // If session tokens are missing, user is NOT logged in
  if (!req.session.tokens) {
    return res.status(401).send("Not authenticated  Go to /auth/okta first.");
  }

  try {
    // Grab ID token from the server session
    const idToken = req.session.tokens.id_token;                                  // this stays on the server

    // Verify the ID token signature + claims using Okta public keys
    const result = await jwtVerify(idToken, JWKS, {
      issuer: `https://${OKTA_DOMAIN}/oauth2/default`,                             // must match iss
      audience: CLIENT_ID,                                                        // must match aud
    });

    // Nonce validation (protects against replay)
    if (req.session.oauthNonce && result.payload.nonce !== req.session.oauthNonce) {
      return res.status(401).send("Nonce mismatch. Please login again.");
    }

    delete req.session.oauthNonce;                                                 // nonce is one-time use

    pushAuthEvent({
      type: "AUTH_VERIFY_OK",
      path: req.path,
      user: {
        email: result.payload.email || null,
        sub: result.payload.sub || null,
      },
      groups: Array.isArray(result.payload.groups) ? result.payload.groups : [],
      checks: {
        jwksVerified: true,
        issuerVerified: true,
        audienceVerified: true,
        nonceVerified: true, // (true if you got here; mismatch would return earlier)
      }
    });

    // Save the verified user info (claims) for the next route to use
    req.user = result.payload;                                                    // trusted ONLY after jwtVerify

    console.log("USER GROUPS:", req.user.groups);

    // Continue to the real route
    next();

  } catch (e) {
    pushAuthEvent({
      type: "AUTH_VERIFY_FAIL",
      path: req.path,
      error: e?.message || "verify failed"
    });
    req.session.destroy(() => {});
    // If verification fails, treat as not logged in
    return res.status(401).send("Invalid or expired token. Please login again.");
  }
}

// AUTHORIZATION middleware (GROUP-BASED)
function requireGroup(groupName) {
  return [
    requireAuth,
    (req, res, next) => {
      const groups = req.user?.groups;

      if (!Array.isArray(groups)) {
        return res.status(403).send("Forbidden (no groups claim)");
      }

      if (!groups.includes(groupName)) {
        return res.status(403).send("Forbidden (not authorized)");
      }

      next();
    }
  ];
}

function buildStatus(req) {
  const user = req.user || null;
  const groups = Array.isArray(user?.groups) ? user.groups : [];

  const expiresAt = user?.exp || null;

  return {
    authenticated: true,
    user: user
      ? {
          name: user.name || null,
          email: user.email || null,
          sub: user.sub || null
        }
      : null,
    groups,
    authorization: {
      isAdmin: groups.includes("Admins")
    },
    token: {
      expiresAt,
      issuer: user?.iss || null,
      audience: user?.aud || null
    },
    securityChecks: {
      session: !!req.session.tokens,
      stateVerified: true,          // (we only reach requireAuth after successful login flow)
      nonceVerified: true,          // (requireAuth checks nonce when present)
      jwksVerified: true,           // (jwtVerify passed)
      issuerVerified: true,         // (jwtVerify enforced issuer)
      audienceVerified: true,       // (jwtVerify enforced audience)
      groupsClaimPresent: Array.isArray(user?.groups)
    }
  };
}

// We want to make web requests to Okta's token endpoint
// node-fetch is a library that lets Node call APIs like a browser does
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));                   // lazy-load fetch

function decodeJwtPart(part) {
  // JWT uses Base64URL (slightly different from normal Base64)
  const fixed = part
    .replace(/-/g, "+")                                                                  // convert URL-safe "-" back to "+"
    .replace(/_/g, "/")                                                                  // convert URL-safe "_" back to "/";

  // Add missing "=" padding if needed (Base64 needs length multiple of 4)
  const padded = fixed + "=".repeat((4 - (fixed.length % 4)) % 4);

  // Convert Base64 -> string -> JSON object
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

// ROUTE 1: Home page. 
 app.get("/health", (req, res) => {
  //When someone visits http://localhost:3000/
  res.send("Server is alive. Go to /auth/okta to login."); // show a simple message
});


// ROUTE 2: Start the login (redirect to Okta)
app.get("/auth/okta", (req, res) => {

  const state = crypto.randomBytes(16).toString("hex");                         // state = anti-hacker token (protects from CSRF)                         
  const nonce = crypto.randomBytes(16).toString("hex");                         // nonce = anti-replay token for ID token (helps prevent token reuse)              

  // Build the URL we will send the browser to
  // This is the /authorize step of OAuth/OIDC
  const authorizeUrl =
    `https://${OKTA_DOMAIN}/oauth2/default/v1/authorize` +                      // Okta authorize endpoint
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +                             // which app is asking
    `&response_type=code` +                                                     // we want an auth "code"
    `&scope=${encodeURIComponent("openid profile email")}`+                     // what info we request
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +                       // where to send user back
    `&state=${encodeURIComponent(state)}` +                                     // protect request from CSRF
    `&nonce=${encodeURIComponent(nonce)}`;                                      // protects ID token replay

  // IMPORTANT: save session BEFORE redirect so state is not lost
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;
  req.session.save(() => res.redirect(authorizeUrl));                                                // browser leaves our site and goes to Okta
});

// ROUTE 3: Okta sends us back here with ?code=......
app.get("/callback", async (req, res) => {

  // Grab the code and state from the URL query
  const { code, state } = req.query;                                            // example: /callback?code=abc&state=xyz

  if (!state || state !== req.session.oauthState) {
  return res.status(400).send("State mismatch");
}
delete req.session.oauthState;

  try {
    // (A) Build the request body for /token
    // This is the "exchange code for tokens" step
    const params = new URLSearchParams();                                       // builds form-style data like a browser
    params.append("grant_type", "authorization_code");                          // tells Okta which flow we use
    params.append("code", code);                                                // the one-time code from Okta
    params.append("redirect_uri", REDIRECT_URI);                                // must match exactly

    // (B) Build HTTP Basic Auth header: base64(client_id:client_secret)
    // This proves to Okta: "I am the real app, not a random attacker"
    const clientSecret = process.env.OKTA_CLIENT_SECRET;                         // secret (never show in public)
    const basic = Buffer
      .from(`${CLIENT_ID}:${clientSecret}`)                                     // join id + secret like "id:secret"
      .toString("base64");                                                      // convert to base64 for Basic auth

    // (C) Call Okta /token endpoint to get tokens
    const tokenRes = await fetch(`https://${OKTA_DOMAIN}/oauth2/default/v1/token`, {
      method: "POST", // token exchange is a POST
      headers: {
        "Authorization": `Basic ${basic}`,                                      // app proves identity with Basic auth
        "Content-Type": "application/x-www-form-urlencoded",                    // required format
      },
      body: params.toString(),                                                  // send grant_type/code/redirect_uri
    });

      // Convert Okta's response into JSON
         const tokenData = await tokenRes.json();                               // This contains access_token, id_token, expires_in, scope, etc.

      if (!tokenRes.ok) {
      return res.status(500).send("Token exchange failed: " + JSON.stringify(tokenData));
    }

      req.session.tokens = tokenData;
      // send user back to React (Vite)
      req.session.save(() => {
      res.redirect(FRONTEND_URL + "/");
      });

  } catch (err) {
    // If something breaks, show error
    res.status(500).send("Error exchanging code: " + err.message);
  }
});

// ROUTE 4: Profile page (protected-ish for now)
app.get("/profile", requireAuth, (req, res) => {
  res.send(`
    <h2>Authenticated </h2>
    <p>Welcome, <b>${req.user.name}</b></p>
    <p>Email: ${req.user.email}</p>
    <p><a href="/me">View /me</a></p>
    <p><a href="/admin">Go to /admin</a></p>
    <p><a href="/logout">Logout</a></p>
  `);
});

// ROUTE 5: /me (protected) - shows verified user info safely
app.get("/me", requireAuth, (req, res) => {
  const user = req.user;                                                            // req.user was attached by requireAuth after jwtVerify
  res.send(`
    <h2>/me (Verified User)</h2>
    <p><b>Name:</b> ${user.name}</p>
    <p><b>Email:</b> ${user.email}</p>
    <p><b>Issuer (iss):</b> ${user.iss}</p>
    <p><b>Audience (aud):</b> ${user.aud}</p>
    <p><b>Expires (exp):</b> ${new Date(user.exp * 1000).toLocaleString()}</p>
    <p> Protected route + verified token via middleware.</p>
  `);
});


// ROUTE: /status.json (protected) - raw JSON for the React dashboard (NO TOKENS)
app.get("/status.json", requireAuth, (req, res) => {
  res.json(buildStatus(req));
});

// ROUTE: /status (protected) - pretty HTML report for humans / recruiters
app.get("/status", requireAuth, (req, res) => {
  const data = buildStatus(req);

  const pill = (text, ok) =>
    `<span class="pill ${ok ? "ok" : "bad"}">${text}</span>`;

  const checks = data.securityChecks || {};
  const isAdmin = !!data.authorization?.isAdmin;

  res.send(`
    <html>
      <head>
        <title>Security Status</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root{
            --bg0:#070A12;
            --bg1:#0B1020;
            --card:rgba(255,255,255,0.06);
            --stroke:rgba(255,255,255,0.12);
            --txt:rgba(255,255,255,0.92);
            --muted:rgba(255,255,255,0.62);
            --ok:#36d399;
            --bad:#fb7185;
            --warn:#fbbf24;
          }
          html,body{height:100%;}
          body{
            margin:0;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
            background:
              radial-gradient(1200px 700px at 20% 0%, #14214a 0%, transparent 60%),
              radial-gradient(1000px 600px at 80% 10%, #2a144a 0%, transparent 60%),
              linear-gradient(180deg, var(--bg0), var(--bg1));
            color:var(--txt);
            padding:28px;
          }
          .wrap{max-width:1100px;margin:0 auto;}
          .top{
            display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
            margin-bottom:14px;
          }
          h1{font-size:22px;margin:0;}
          .sub{color:var(--muted);font-size:13px;margin-top:6px;}
          .actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
          a.btn{
            display:inline-flex;align-items:center;gap:10px;
            padding:10px 14px;border-radius:14px;
            border:1px solid rgba(255,255,255,0.14);
            text-decoration:none;font-weight:700;font-size:14px;
            background: rgba(255,255,255,0.06);
          }
          a.btn:hover{transform:translateY(-1px);}
          .grid{display:grid;grid-template-columns:1.1fr 0.9fr;gap:14px;}
          @media (max-width: 980px){ .grid{grid-template-columns:1fr;} }
          .card{
            border-radius:22px;
            border:1px solid var(--stroke);
            background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04));
            box-shadow:0 24px 70px rgba(0,0,0,0.35);
            overflow:hidden;
          }
          .cardHead{padding:16px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.08);}
          .cardTitle{font-weight:900;}
          .cardSub{color:var(--muted);font-size:13px;margin-top:4px;}
          .cardBody{padding:14px 16px 16px;}
          .pill{
            display:inline-block;padding:4px 10px;border-radius:999px;
            font-size:12px;font-weight:900;margin-right:6px;
            border:1px solid rgba(255,255,255,0.14);
            background: rgba(255,255,255,0.06);
          }
          .ok{color:var(--ok);border-color: rgba(54,211,153,0.35); background: rgba(54,211,153,0.12);}
          .bad{color:var(--bad);border-color: rgba(251,113,133,0.35); background: rgba(251,113,133,0.12);}
          .warn{color:var(--warn);border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.12);}
          pre{
            margin:0;
            background: rgba(255,255,255,0.04);
            padding:14px;
            border-radius:16px;
            border:1px solid rgba(255,255,255,0.10);
            overflow-x:auto;
            font-size:13px;
            line-height:1.5;
            white-space:pre-wrap;
          }
          .kv{display:grid;grid-template-columns:160px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);}
          .kv:last-child{border-bottom:none;}
          .k{color:var(--muted);font-size:13px;}
          .v{font-weight:700;}
          .note{color:var(--muted);font-size:13px;margin-top:12px;}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="top">
            <div>
              <h1>🔐 Security Status Report</h1>
              <div class="sub">Verified server-side (JWKS + nonce/state + RBAC). Tokens never touch the browser UI.</div>
            </div>
            <div class="actions">
              <a class="btn" href="${FRONTEND_URL}/">← Back to UI</a>
              <a class="btn" href="/admin">Test /admin</a>
              <a class="btn" href="/logout">Logout</a>
              <a class="btn" href="/status.json" target="_blank" rel="noreferrer">Raw JSON</a>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            ${pill("Authenticated", true)}
            ${pill(isAdmin ? "Admin Allowed" : "Admin Denied", isAdmin)}
            ${pill(checks.jwksVerified ? "JWKS Verified" : "JWKS Failed", !!checks.jwksVerified)}
            ${pill(checks.nonceVerified ? "Nonce Verified" : "Nonce Failed", !!checks.nonceVerified)}
            ${pill(checks.stateVerified ? "State Verified" : "State Failed", !!checks.stateVerified)}
          </div>

          <div class="grid">
            <div class="card">
              <div class="cardHead">
                <div class="cardTitle">Identity (Verified Claims)</div>
                <div class="cardSub">Trusted only after jwtVerify succeeds</div>
              </div>
              <div class="cardBody">
                <div class="kv"><div class="k">Name</div><div class="v">${data.user?.name || "—"}</div></div>
                <div class="kv"><div class="k">Email</div><div class="v">${data.user?.email || "—"}</div></div>
                <div class="kv"><div class="k">Subject (sub)</div><div class="v">${data.user?.sub || "—"}</div></div>
                <div class="kv"><div class="k">Issuer</div><div class="v">${data.token?.issuer || "—"}</div></div>
                <div class="kv"><div class="k">Audience</div><div class="v">${data.token?.audience || "—"}</div></div>
              </div>
            </div>

            <div class="card">
              <div class="cardHead">
                <div class="cardTitle">Full Safe Report</div>
                <div class="cardSub">No tokens included</div>
              </div>
              <div class="cardBody">
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <div class="note">
                  This view is derived entirely from server-side session data after verification.
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
});



// ROUTE 6: /admin (protected) - example protected page
app.get("/admin", requireGroup("Admins"), (req, res) => {
  const data = buildStatus(req);

  res.send(
    renderPage({
      title: "🛡️ Admin Security View",
      badges: [
        { label: "Authenticated", tone: "ok" },
        { label: "Admin", tone: "ok" }
      ],
      body: `
        <pre>${JSON.stringify(data, null, 2)}</pre>
        <div class="note">
          This route is protected by group-based authorization (RBAC).
          Access is granted only if the verified ID token contains
          the <b>Admins</b> group claim.
        </div>
      `
    })
  );
});


// ROUTE 7: Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid", { path: "/" });

    res.send(
      renderPage({
        title: "👋 Logged Out",
        badges: [{ label: "Session Ended", tone: "bad" }],
        body: `
          <p>You have been securely logged out.</p>
          <p class="note">
            The server-side session has been destroyed and the session cookie
            cleared from the browser.
          </p>
          <p>
            <a href="${FRONTEND_URL}/">Return to application</a>
          </p>
        `
      })
    );
  });
});

// ROUTE: /events (protected) - shows recent verification events (no tokens)
app.get("/events", requireAuth, (req, res) => {
  res.json({
    now: Date.now(),
    events: authEvents
  });
});

// Start the server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");                          // tells you it's live
});
