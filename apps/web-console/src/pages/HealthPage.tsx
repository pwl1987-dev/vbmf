import type * as React from "react";
import { useEffect, useState } from "react";
import { getHealthLive, getHealthz } from "../api/client.ts";
import type { HealthLayersResponse } from "../api/schemas.ts";

type State =
  | { kind: "loading" }
  | { kind: "ok"; live: { status: "live" } | null; layers: HealthLayersResponse | null; error: string | null };

function statusClass(s: string): string {
  if (s === "up" || s === "live" || s === "running") return "ok";
  if (s === "unreachable" || s === "down") return "err";
  return "warn";
}

function statusPill(s: string): React.JSX.Element {
  return <span className={`state-pill ${statusClass(s)}`}>{s}</span>;
}

export function HealthPage(): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function tick(): Promise<void> {
      const live = await getHealthLive();
      const layers = await getHealthz();
      if (cancelled) return;
      if (live.kind === "ok" && layers.kind === "ok") {
        setState({ kind: "ok", live: live.body, layers: layers.body, error: null });
      } else if (live.kind === "error") {
        setState({ kind: "ok", live: null, layers: null, error: live.envelope.error.message });
      } else if (layers.kind === "error") {
        setState({ kind: "ok", live: null, layers: null, error: layers.envelope.error.message });
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (state.kind === "loading") return <div className="panel">Loading…</div>;
  return (
    <>
      <div className="panel">
        <h2>Liveness</h2>
        {state.live !== null ? (
          <div className="health-row">
            <span className="label">/health/live</span>
            {statusPill(state.live.status)}
            <span className="value">fastify process is serving requests</span>
          </div>
        ) : (
          <div className="error-banner">/health/live unreachable</div>
        )}
      </div>

      <div className="panel">
        <h2>Layered health (/healthz)</h2>
        {state.layers !== null ? (
          <div>
            <div className="health-row">
              <span className="label">api</span>
              {statusPill(state.layers.layers.api.status)}
              <span className="value">control plane process</span>
            </div>
            <div className="health-row">
              <span className="label">runtime</span>
              {statusPill(state.layers.layers.runtime.status)}
              <span className="value">
                {state.layers.layers.runtime.status === "up"
                  ? `agent_state=${String(state.layers.layers.runtime["agent_state"] ?? "—")} · devices=${String(state.layers.layers.runtime["devices"] ?? "—")} · pipelines=${String(state.layers.layers.runtime["active_pipelines"] ?? "—")}`
                  : "media-agent unreachable"}
              </span>
            </div>
            <div className="health-row">
              <span className="label">db</span>
              {statusPill(state.layers.layers.db.status)}
              <span className="value">
                {state.layers.layers.db.status === "up" ? "PostgreSQL SELECT 1 OK" : "durable command plane"}
              </span>
            </div>
            <div className="health-row">
              <span className="label">auth</span>
              {statusPill(state.layers.layers.auth.status)}
              <span className="value">Better Auth identity layer</span>
            </div>
            <div className="health-row">
              <span className="label">events</span>
              {statusPill(state.layers.layers.events.status)}
              <span className="value">drain loop / outbox</span>
            </div>
          </div>
        ) : (
          <div className="error-banner">/healthz unreachable</div>
        )}
      </div>

      {state.error !== null ? <div className="error-banner">error: {state.error}</div> : null}
    </>
  );
}
