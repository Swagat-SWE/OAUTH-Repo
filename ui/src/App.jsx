import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { api } from "./lib/api";

function Pill({ children, tone = "neutral" }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

function Card({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="cardTitle">{title}</div>
          {subtitle ? <div className="cardSub">{subtitle}</div> : null}
        </div>
      </div>
      <div className="cardBody">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="row">
      <div className="rowLabel">{label}</div>
      <div className="rowValue">{value}</div>
    </div>
  );
}

function fmtExp(exp) {
  if (!exp) return "—";
  const dt = new Date(exp * 1000);
  return dt.toLocaleString();
}

function secondsLeft(exp) {
  if (!exp) return null;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, exp - now);
}

function FlowStep({ n, title, desc }) {
  return (
    <div className="step">
      <div className="stepNum">{n}</div>
      <div className="stepMain">
        <div className="stepTitle">{title}</div>
        <div className="stepDesc">{desc}</div>
      </div>
    </div>
  );
}
function NarrativeCard() {
  return (
    <Card title="Narrative" subtitle="The story behind this build">
      <div className="story">
        <p>
          This project started with one rule: <b>The browser should never handle raw tokens</b>.
          A lot of demo apps throw ID/access tokens into local storage or expose them in the UI.
          That works for demos, but it’s a common real world failure point because one XSS bug can turn into token theft.
        </p>

        <p>
          So I designed the login like a backend first security system.
          When the user clicks <b>“Login with Okta”</b>, my server begins a real OIDC Authorization Code Flow.
          Before redirecting to Okta, the server generates two protections: <b>state</b> (CSRF defense) and <b>nonce</b> (replay defense).
          Both are saved server-side in the session so they can’t be altered by the client.
        </p>

        <p>
          After Okta redirects back to <code>/callback</code>, the server verifies that the returned <b>state matches</b>.
          If it doesn’t match, the login is rejected immediately.
          If it matches, the server exchanges the authorization code for tokens using <b>server-side Basic Auth</b>
          (client id + secret). The secret stays on the server, never in the frontend.
        </p>

        <p>
          Next comes the core security proof: I don’t “trust” the ID token — I <b>verify it cryptographically</b>.
          The backend uses Okta’s <b>JWKS public keys</b> to validate the token signature, and checks the issuer + audience.
          Only after verification passes do I attach the user claims to the request and consider the identity trusted.
        </p>

        <p>
          Finally, I enforce <b>least privilege</b> with RBAC using Okta Groups.
          The <code>/admin</code> route is only accessible if the verified token contains the <b>Admins</b> group.
          The dashboard displays a safe summary from <code>/status</code> without exposing token contents.
        </p>

        <p className="muted">
          Result: tokens remain server-side, the browser only carries an httpOnly session cookie,
          identity is verified with JWKS (not assumed), and authorization is enforced with group-based access control.
        </p>
      </div>
    </Card>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);

async function loadStatus() {
  try {
    setErr(null);

    const result = await api.status();

    if (!result.ok && result.status === 401) {
      setAuthed(false);
      setStatus(null);
      return;
    }

    setAuthed(true);
    setStatus(result.data);
  } catch (e) {
    setAuthed(false);
    setStatus(null);
    setErr("Backend not reachable. Is Express running on :3000?");
  }
}

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      await loadStatus();
      if (alive) setLoading(false);
    })();

    const t = setInterval(() => {
      loadStatus();
    }, 3000);

    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exp = status?.token?.expiresAt ?? null;
  const left = useMemo(() => secondsLeft(exp), [exp]);

  const groups = status?.groups ?? [];
  const checks = status?.securityChecks ?? {};
  const isAdmin = status?.authorization?.isAdmin ?? false;

  return (
    <div className="page">
      <div className="bg">
        <div className="blob blobA" />
        <div className="blob blobB" />
        <div className="grid" />
      </div>

      <header className="topbar">
        <div className="brand">
          <div className="logoMark">OIDC</div>
          <div>
            <div className="brandTitle">Okta OIDC Security Walkthrough</div>
            <div className="brandSub">By Swagat Karki</div>
          </div>
        </div>

        <div className="actions">
          <a className="btn btnGhost" href="/status" target="_blank" rel="noreferrer">
            Status Report
          </a>
          {!authed ? (
            <a className="btn btnPrimary" href="/auth/okta">
              Login with Okta
            </a>
          ) : (
            <>
              <a className="btn btnGhost" href="/admin" target="_blank" rel="noreferrer">
                Test /admin
              </a>
              <a className="btn btnPrimary" href="/logout">
                Logout
              </a>
            </>
          )}
        <a className="btn btnGhost" href="/story">
          View Story
        </a>

        </div>
      </header>
          <div className="videoShowcase">
            <a
              className="videoBox"
              href="https://youtu.be/0XhveOfXPFs"
              target="_blank"
              rel="noreferrer"
            >
              <div className="videoTitle">
                ▶ Watch me explain the entire project
              </div>
              <div className="videoSub">
                30-minute full architecture walkthrough (OIDC + JWKS + RBAC)
              </div>
            </a>
          </div>

      <main className="main">
        {loading ? (
          <div className="heroCard">
            <div className="heroTitle">Loading security posture…</div>
            <div className="heroSub">Checking session + verifying identity state.</div>
            <div className="skeletonGrid">
              <div className="sk" />
              <div className="sk" />
              <div className="sk" />
            </div>
          </div>
        ) : !authed ? (
          <div className="layout">
            <div className="hero">
              <div className="heroKicker">
                <Pill tone="ok">Secure by design</Pill>
                <Pill tone="neutral">OIDC + JWKS</Pill>
                <Pill tone="warn">RBAC</Pill>
              </div>

              <h1 className="heroTitle">
              Trust is a vulnerability. Verification is control.
               <br />
                <span className="heroGlow authorLine">— Project by Swagat</span>
                </h1>


              <p className="heroSub">
                This mini app demonstrates a real OIDC login using Authorization Code Flow,
                server-side sessions, JWKS signature verification, nonce/state protection, and
                group-based authorization.
              </p>

              <div className="heroBtns">
                <a className="btn btnPrimary" href="/auth/okta">
                  Login with Okta
                </a>
                <button className="btn btnGhost" onClick={loadStatus}>
                  Re-check status
                </button>
              </div>

              {err ? <div className="error">{err}</div> : null}

              <div className="miniNote">
                <span className="dot" />
                Tokens are stored server-side only (session). Browser never sees raw tokens.
              </div>
            </div>


            <div className="panel">
              <div className="panelTitle">What happens during login</div>
              <div className="panelSub">A recruiter-friendly walkthrough</div>

              <div className="steps">
                <FlowStep
                  n="1"
                  title="Authorize Redirect"
                  desc="Browser is redirected to Okta /authorize with state + nonce."
                />
                <FlowStep
                  n="2"
                  title="Callback + State Check"
                  desc="App receives code + state, blocks CSRF if state mismatches."
                />
                <FlowStep
                  n="3"
                  title="Token Exchange"
                  desc="Server exchanges code for tokens using client credentials (Basic auth)."
                />
                <FlowStep
                  n="4"
                  title="JWKS Verification"
                  desc="ID token is verified cryptographically using Okta’s public keys."
                />
                <FlowStep
                  n="5"
                  title="RBAC Authorization"
                  desc="Groups claim controls access to /admin (Admins only)."
                />
              </div>
            </div>

          <div style={{ marginTop: 16 }}>
            <NarrativeCard />
          </div>

          </div>
        ) : (
          <div className="dash">
            <div className="dashTop">
              <div>
                <div className="dashTitle">Security Posture Dashboard</div>
                <div className="dashSub">Live from /status (no tokens exposed)</div>
              </div>
              <div className="dashBadges">
                <Pill tone="ok">Authenticated</Pill>
                {isAdmin ? <Pill tone="ok">Admin</Pill> : <Pill tone="neutral">Not Admin</Pill>}
                {left !== null ? (
                  left > 0 ? (
                    <Pill tone="warn">{Math.ceil(left / 60)} min left</Pill>
                  ) : (
                    <Pill tone="bad">Expired</Pill>
                  )
                ) : (
                  <Pill tone="neutral">No exp</Pill>
                )}
              </div>
            </div>

            <div className="grid3">
              <Card title="Authentication" subtitle="Server session + verified identity">
                <Row label="Session" value={checks.session ? <Pill tone="ok">Active</Pill> : <Pill tone="bad">Missing</Pill>} />
                <Row label="Token Exp" value={fmtExp(exp)} />
                <Row label="JWKS Verify" value={checks.jwksVerified ? <Pill tone="ok">Passed</Pill> : <Pill tone="bad">Failed</Pill>} />
              </Card>

              <Card title="Verified Claims" subtitle="Only trusted after jwtVerify">
                <Row label="Name" value={status?.user?.name || "—"} />
                <Row label="Email" value={status?.user?.email || "—"} />
                <Row label="Subject (sub)" value={status?.user?.sub || "—"} />
              </Card>

              <Card title="Authorization" subtitle="Group-based access control (RBAC)">
                <Row label="Groups" value={groups.length ? groups.map((g) => <Pill key={g} tone="neutral">{g}</Pill>) : "—"} />
                <Row label="Admin Access" value={isAdmin ? <Pill tone="ok">Allowed</Pill> : <Pill tone="bad">Denied</Pill>} />
                <Row label="/admin route" value={<a className="link" href="/admin" target="_blank" rel="noreferrer">Open</a>} />
              </Card>
            </div>

            <div className="grid2">
              <Card title="Security Checks" subtitle="Trust decisions, made explicit">
                <div className="checks">
                  {[
                    ["State verified", checks.stateVerified],
                    ["Nonce verified", checks.nonceVerified],
                    ["Issuer verified", checks.issuerVerified],
                    ["Audience verified", checks.audienceVerified],
                    ["Groups claim present", checks.groupsClaimPresent],
                  ].map(([label, ok]) => (
                    <div className="check" key={label}>
                      <div className={`checkDot ${ok ? "on" : "off"}`} />
                      <div className="checkText">{label}</div>
                      <div className="checkRight">{ok ? "PASS" : "FAIL"}</div>
                    </div>
                  ))}
                </div>
              </Card>

            <Card title="Narrative" subtitle="The story behind this build">
              <div className="story">
                <p>
                  This project started with one rule: <b> The browser should never handle raw tokens</b>.
                  A lot of demo apps throw ID/access tokens into local storage or expose them in the UI.
                  That works for demos, but it’s a common real world failure point because one XSS bug can turn into token theft.
                </p>            

                <p>
                  So I designed the login like a backend first security system.
                  When the user clicks <b>“Login with Okta”</b>, my server begins a real OIDC Authorization Code Flow.
                  Before redirecting to Okta, the server generates two protections: <b>state</b> (CSRF defense) and <b>nonce</b> (replay defense).
                  Both are saved server-side in the session so they can’t be altered by the client.
                </p>            

                <p>
                  After Okta redirects back to <code>/callback</code>, the server verifies that the returned <b>state matches</b>.
                  If it doesn’t match, the login is rejected immediately.
                  If it matches, the server exchanges the authorization code for tokens using <b>server side Basic Auth </b>
                  (client id + secret). This is important as the secret stays on the server, never in the frontend.
                </p>            

                <p>
                  Next comes the core security proof: I don’t “trust” the ID token I <b>verify it cryptographically</b>.
                  The backend uses Okta’s <b>JWKS public keys</b> to validate the token signature, and checks the issuer + audience.
                  Only after verification passes do I attach the user claims to the request and consider the identity trusted.
                </p>            

                <p>
                  Finally, I enforce <b>least privilege</b> with RBAC using Okta Groups.
                  The <code>/admin</code> route is only accessible if the verified token contains the <b>Admins</b> group.
                  The dashboard then displays a safe security summary from <code>/status</code>—showing what was verified
                  (state, nonce, JWKS, issuer, audience) without ever exposing token contents.
                </p>            

                <p className="muted">
                  Result: tokens remain server-side, the browser only carries an httpOnly session cookie,
                  identity is verified with JWKS (not assumed), and authorization is enforced with group-based access control.
                </p>
              </div>
            </Card>
            </div>

            <div className="footerNote">
              Live refresh every 3 seconds · Backend: Express on :3000 · Frontend: React on :5173
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
