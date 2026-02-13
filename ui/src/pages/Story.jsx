import LiveEvents from "../components/LiveEvents";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import "../App.css";

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

function CheckRow({ label, ok, rightText }) {
  return (
    <div className="check">
      <div className={`checkDot ${ok ? "on" : "off"}`} />
      <div className="checkText">{label}</div>
      <div className="checkRight">{rightText ?? (ok ? "PASS" : "FAIL")}</div>
    </div>
  );
}

export default function Story() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    try {
      setErr(null);
      const data = await api.status(); // expects /status.json (safe JSON)
      setAuthed(true);
      setStatus(data);
    } catch (e) {
      setAuthed(false);
      setStatus(null);
      setErr("Not authenticated or backend not reachable. Login first.");
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      await load();
      if (alive) setLoading(false);
    })();

    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks = status?.securityChecks ?? {};
  const isAdmin = status?.authorization?.isAdmin ?? false;

  const issuerOk = !!checks.issuerVerified;
  const audienceOk = !!checks.audienceVerified;
  const issuerAudienceOk = issuerOk && audienceOk;

  const titleLine = useMemo(() => {
    if (!authed) return "Story Mode: What this project proves";
    const name = status?.user?.name || "Authenticated User";
    return `Story Mode: Live proof for ${name}`;
  }, [authed, status]);

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
            <div className="brandSub">Story Mode (live from /status)</div>
          </div>
        </div>

        <div className="actions">
          <a className="btn btnGhost" href="/">
            ← Back Home
          </a>

          {!authed ? (
            <a className="btn btnPrimary" href="/auth/okta">
              Login with Okta
            </a>
          ) : (
            <>
              <a className="btn btnGhost" href="/status" target="_blank" rel="noreferrer">
                View Status Report
              </a>
              <a className="btn btnGhost" href="/admin" target="_blank" rel="noreferrer">
                Test /admin
              </a>
              <a className="btn btnPrimary" href="/logout">
                Logout
              </a>
            </>
          )}
        </div>
      </header>

      <main className="main">
        {loading ? (
          <div className="heroCard">
            <div className="heroTitle">Loading story mode…</div>
            <div className="heroSub">Pulling live security signals from /status.json.</div>
            <div className="skeletonGrid">
              <div className="sk" />
              <div className="sk" />
              <div className="sk" />
            </div>
          </div>
        ) : (
          <div className="dash">
            <div className="dashTop">
              <div>
                <div className="dashTitle">{titleLine}</div>
                <div className="dashSub">
                  This page reads a safe JSON report from <code>/status.json</code> every 3 seconds — no tokens exposed.
                </div>
              </div>

              <div className="dashBadges">
                {authed ? <Pill tone="ok">Authenticated</Pill> : <Pill tone="bad">Not Authenticated</Pill>}
                {authed ? (isAdmin ? <Pill tone="ok">Admin Allowed</Pill> : <Pill tone="warn">Admin Denied</Pill>) : null}
              </div>
            </div>

            {!authed ? (
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
                    <span className="heroGlow authorLine">— Story Mode</span>
                  </h1>

                  <p className="heroSub">
                    Login first so this page can show <b>live proof</b>: state + nonce checks, JWKS verification,
                    issuer/audience validation, and RBAC authorization.
                  </p>

                  <div className="heroBtns">
                    <a className="btn btnPrimary" href="/auth/okta">
                      Login with Okta
                    </a>
                    <button className="btn btnGhost" onClick={load}>
                      Re-check status
                    </button>
                  </div>

                  {err ? <div className="error">{err}</div> : null}

                  <div className="miniNote">
                    <span className="dot" />
                    This page only reads <code>/status.json</code> (safe JSON). Tokens never touch the UI.
                  </div>
                </div>

                <div className="panel">
                  <div className="panelTitle">What you’ll see after login</div>
                  <div className="panelSub">Live checks, updated every 3 seconds</div>

                  <div className="steps">
                    {[
                      ["1", "State verified", "Prevents CSRF by matching the state saved in the session."],
                      ["2", "Nonce verified", "Prevents replay by ensuring ID token nonce matches session nonce."],
                      ["3", "JWKS verified", "Cryptographically validates signature using Okta public keys."],
                      ["4", "Issuer/Audience verified", "Ensures token is from your Okta tenant and meant for your app."],
                      ["5", "RBAC admin allowed/denied", "Allows /admin only if verified claims include group “Admins”."],
                    ].map(([n, t, d]) => (
                      <div className="step" key={n}>
                        <div className="stepNum">{n}</div>
                        <div className="stepMain">
                          <div className="stepTitle">{t}</div>
                          <div className="stepDesc">{d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid2">
                  <Card title="Live Security Proof" subtitle="Pulled from /status.json (no tokens exposed)">
                    <div className="checks">
                      <CheckRow label="State verified" ok={!!checks.stateVerified} />
                      <CheckRow label="Nonce verified" ok={!!checks.nonceVerified} />
                      <CheckRow label="JWKS verified" ok={!!checks.jwksVerified} />
                      <CheckRow label="Issuer verified" ok={!!checks.issuerVerified} />
                      <CheckRow label="Audience verified" ok={!!checks.audienceVerified} />
                      <CheckRow
                        label="Issuer + Audience verified"
                        ok={issuerAudienceOk}
                        rightText={issuerAudienceOk ? "PASS" : "FAIL"}
                      />
                      <CheckRow
                        label="RBAC: /admin access"
                        ok={isAdmin}
                        rightText={isAdmin ? "ALLOWED" : "DENIED"}
                      />
                    </div>

                    <div className="miniNote" style={{ marginTop: 14 }}>
                      <span className="dot" />
                      These checks are derived after backend verification (jwtVerify + nonce/state + RBAC).
                    </div>
                  </Card>

                  <Card title="What this proves" subtitle="Recruiter-friendly summary">
                    <div className="story">
                      <p>
                        This app doesn’t treat authentication as “trust me.” It treats it as a verification pipeline.
                        The server stores tokens inside a session, then proves identity by verifying the ID token signature
                        using Okta’s JWKS public keys.
                      </p>
                      <p>
                        Then it enforces least privilege using Okta Groups. If the verified claims contain <b>Admins</b>,
                        the user is authorized for <code>/admin</code>. If not, the route is blocked.
                      </p>
                      <p className="muted">
                        The frontend only reads a safe report from <code>/status.json</code>. Tokens never touch the browser UI.
                      </p>
                    </div>
                  </Card>
                </div>

                <div style={{ marginTop: 14 }}>
                  <LiveEvents />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
