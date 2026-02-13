import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function LiveEvents() {
  const [events, setEvents] = useState([]);

  async function loadEvents() {
    const result = await api.events();
    if (!result.ok) return;          // includes 401
    setEvents(result.data?.events || []);
  }

  useEffect(() => {
    loadEvents();
    const t = setInterval(loadEvents, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="cardTitle">Live Verification Feed</div>
          <div className="cardSub">
            This is what the backend is verifying right now (no tokens).
          </div>
        </div>
      </div>

      <div className="cardBody">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map((e, i) => {
            const ok = e.type === "AUTH_VERIFY_OK";
            const groups = Array.isArray(e.groups) ? e.groups : [];

            return (
              <div key={i} className="check">
                <div className={`checkDot ${ok ? "on" : "off"}`} />

                <div className="checkText">
                  <div style={{ fontWeight: 900 }}>
                    {ok ? "AUTH_VERIFY_OK" : "AUTH_VERIFY_FAIL"}
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
                    {new Date(e.ts).toLocaleTimeString()} · {e.path}
                    {e.user?.email ? ` · ${e.user.email}` : ""}
                  </div>

                  {groups.length ? (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {groups.map((g) => (
                        <span key={g} className="pill pill--neutral">{g}</span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="checkRight">{ok ? "PASS" : "FAIL"}</div>
              </div>
            );
          })}

          {!events.length ? (
            <div style={{ opacity: 0.7 }}>No events yet. Visit /status or /story to generate activity.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
