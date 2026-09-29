import type * as React from "react";
import { useEffect, useState } from "react";
import { getRuntime } from "../api/client.ts";
import type { RuntimeSnapshot } from "../api/schemas.ts";

type State =
  | { kind: "loading" }
  | { kind: "ok"; snapshot: RuntimeSnapshot | null; error: string | null; fetchedAt: number };

export function RuntimePage(): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick(): Promise<void> {
      const res = await getRuntime();
      if (cancelled) return;
      if (res.kind === "ok") {
        setState({ kind: "ok", snapshot: res.body, error: null, fetchedAt: Date.now() });
      } else {
        setState({ kind: "ok", snapshot: null, error: res.envelope.error.message, fetchedAt: Date.now() });
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (state.kind === "loading") return <div className="panel">Loading…</div>;
  if (state.snapshot === null) return <div className="error-banner">/api/v1/runtime: {state.error}</div>;

  const snap = state.snapshot;
  const detail =
    selectedSession !== null ? snap.sessions.find((s) => s.id === selectedSession) ?? null : null;

  return (
    <>
      <div className="panel">
        <h2>Runtime snapshot (live)</h2>
        <div className="kv">
          <div className="k">generated_at_ms</div>
          <div className="v">{snap.generated_at_ms}</div>
          <div className="k">observation_revision</div>
          <div className="v">{snap.observation_revision}</div>
          <div className="k">observation_lineage</div>
          <div className="v">{snap.observation_lineage}</div>
          <div className="k">fetched_at_ms</div>
          <div className="v">{state.fetchedAt}</div>
          <div className="k">devices</div>
          <div className="v">{snap.devices.length}</div>
          <div className="k">ports</div>
          <div className="v">{snap.ports.length}</div>
          <div className="k">resources</div>
          <div className="v">{snap.resources.length}</div>
          <div className="k">sessions</div>
          <div className="v">{snap.sessions.length}</div>
          <div className="k">capabilities</div>
          <div className="v">{snap.capabilities.length}</div>
        </div>
      </div>

      <div className="panel">
        <h2>Sessions</h2>
        {snap.sessions.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>no sessions</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>id (UUID)</th>
                <th>label</th>
                <th>state</th>
                <th>phase</th>
                <th>inputs</th>
                <th>outputs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {snap.sessions.map((s) => (
                <tr key={s.id}>
                  <td className="v">{s.id}</td>
                  <td className="v">{s.label}</td>
                  <td>
                    <span className={`state-pill ${stateClass(s.state)}`}>{s.state}</span>
                  </td>
                  <td>{s.phase}</td>
                  <td>{s.inputs.length}</td>
                  <td>{s.outputs.length}</td>
                  <td>
                    <button className="secondary" onClick={() => setSelectedSession(s.id)}>
                      detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail !== null ? (
        <div className="panel">
          <h2>Session detail</h2>
          <div className="kv">
            <div className="k">id</div>
            <div className="v">{detail.id}</div>
            <div className="k">label</div>
            <div className="v">{detail.label}</div>
            <div className="k">state</div>
            <div className="v">{detail.state}</div>
            <div className="k">phase</div>
            <div className="v">{detail.phase}</div>
            <div className="k">inputs</div>
            <div className="v">{JSON.stringify(detail.inputs)}</div>
            <div className="k">outputs</div>
            <div className="v">{JSON.stringify(detail.outputs)}</div>
          </div>
        </div>
      ) : null}

      <div className="warn-banner">
        Runtime snapshot is canonical truth. UI must NOT infer Desired state from observed snapshot alone.
      </div>
    </>
  );
}

function stateClass(state: string): string {
  if (state === "running") return "ok";
  if (state === "released" || state === "terminated") return "warn";
  if (state === "failed") return "err";
  return "warn";
}
