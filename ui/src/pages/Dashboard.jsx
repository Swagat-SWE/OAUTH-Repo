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
  return new Date(exp * 1000).toLocaleString();
}

export default function Dashboard({ status }) {
  const exp = status?.token?.expiresAt ?? null;
  const groups = status?.groups ?? [];
  const checks = status?.securityChecks ?? {};
  const isAdmin = status?.authorization?.isAdmin ?? false;

  return (
    <div className="dash">
      <div className="dashTop">
        <div>
          <div className="dashTitle">Security Posture Dashboard</div>
          <div className="dashSub">Live from /status (no tokens exposed)</div>
        </div>
        <div className="dashBadges">
          <Pill tone="ok">Authenticated</Pill>
          {isAdmin ? <Pill tone="ok">Admin</Pill> : <Pill tone="neutral">Not Admin</Pill>}
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
          <Row
            label="Groups"
            value={groups.length ? groups.map((g) => <Pill key={g} tone="neutral">{g}</Pill>) : "—"}
          />
          <Row label="Admin Access" value={isAdmin ? <Pill tone="ok">Allowed</Pill> : <Pill tone="bad">Denied</Pill>} />
          <Row label="/admin" value={<a className="link" href="/admin" target="_blank" rel="noreferrer">Open</a>} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Narrative" subtitle="Recruiter-ready explanation">
          <div className="story">
            <p>
              I don’t rely on “trust me” authentication. I verify identity using cryptographic proof (JWKS),
              block replay (nonce), block CSRF (state), and enforce least privilege (RBAC groups).
            </p>
            <p className="muted">
              Tokens never touch the browser UI—sessions keep them server-side to reduce token theft risk.
            </p>
          </div>
        </Card>

        <Card title="Actions" subtitle="Test the system safely">
          <div className="heroBtns">
            <a className="btn btnGhost" href="/me" target="_blank" rel="noreferrer">Open /me</a>
            <a className="btn btnGhost" href="/status" target="_blank" rel="noreferrer">Open /status</a>
            <a className="btn btnPrimary" href="/logout">Logout</a>
          </div>
        </Card>
      </div>

      <div className="footerNote">
        Live refresh every 3 seconds · Backend: Express :3000 · Frontend: React :5173
      </div>
    </div>
  );
}
