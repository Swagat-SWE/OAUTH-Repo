export default function Landing({ onCheck, err }) {
  return (
    <div className="layout">
      <div className="hero">
        <div className="heroKicker">
          <span className="pill pill--ok">Secure by design</span>
          <span className="pill pill--neutral">OIDC + JWKS</span>
          <span className="pill pill--warn">RBAC</span>
        </div>

        <h1 className="heroTitle">
          <span className="heroGlow">Trust is a vulnerability. Verification is control.</span>
          <div className="heroGlow heroSignature">— Project by Swagat</div>
        </h1>

        <p className="heroSub">
          This mini app demonstrates OIDC Authorization Code Flow, server-side sessions, JWKS signature verification,
          nonce/state protection, and group-based authorization.
        </p>

        <div className="heroBtns">
          <a className="btn btnPrimary" href="/auth/okta">Login with Okta</a>
          <button className="btn btnGhost" onClick={onCheck}>Re-check status</button>
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
          <div className="step">
            <div className="stepNum">1</div>
            <div className="stepMain">
              <div className="stepTitle">Authorize Redirect</div>
              <div className="stepDesc">Browser goes to Okta /authorize with state + nonce.</div>
            </div>
          </div>

          <div className="step">
            <div className="stepNum">2</div>
            <div className="stepMain">
              <div className="stepTitle">Callback + State Check</div>
              <div className="stepDesc">App receives code + state, blocks CSRF if state mismatches.</div>
            </div>
          </div>

          <div className="step">
            <div className="stepNum">3</div>
            <div className="stepMain">
              <div className="stepTitle">Token Exchange</div>
              <div className="stepDesc">Server exchanges code for tokens using client credentials (Basic auth).</div>
            </div>
          </div>

          <div className="step">
            <div className="stepNum">4</div>
            <div className="stepMain">
              <div className="stepTitle">JWKS Verification</div>
              <div className="stepDesc">ID token verified using Okta public keys (JWKS).</div>
            </div>
          </div>

          <div className="step">
            <div className="stepNum">5</div>
            <div className="stepMain">
              <div className="stepTitle">RBAC Authorization</div>
              <div className="stepDesc">Groups claim controls /admin (Admins only).</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
