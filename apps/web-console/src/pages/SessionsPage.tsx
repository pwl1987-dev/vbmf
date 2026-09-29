import type * as React from "react";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  ApiClientError,
  getCommand,
  getRuntime,
  postReleaseSession,
  postStartSession,
  postStopSession,
} from "../api/client.ts";
import {
  describeFourState,
  initialFourState,
  reduceFourState,
} from "../state/fourStateMachine.ts";
import type { CommandOperationBody, RuntimeSnapshot } from "../api/schemas.ts";

interface CmdRow {
  label: string;
  command: CommandOperationBody | null;
  polling: boolean;
  error: string | null;
}

function initialRows(): CmdRow[] {
  return [
    { label: "Start session", command: null, polling: false, error: null },
    { label: "Stop session", command: null, polling: false, error: null },
    { label: "Release session", command: null, polling: false, error: null },
  ];
}

function genIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 12);
  const t = Date.now().toString(36);
  return `${prefix}-${t}-${rand}`;
}

export function SessionsPage(): React.JSX.Element {
  const [intentDeviceId, setIntentDeviceId] = useState("");
  const [rows, setRows] = useState<CmdRow[]>(initialRows());
  const [four, dispatchFour] = useReducer(reduceFourState, initialFourState());
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // latest-ref：polling effect 固定 2s cadence（deps=[]），state 更新（rows/
  // four/runtime）只通过 ref 进入 tick，不重建 timer——否则 reduceFourState
  // 每次返回新对象会把 2s polling 退化成请求风暴。
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const fourRef = useRef(four);
  fourRef.current = four;
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  useEffect(() => {
    let cancelled = false;
    async function tick(): Promise<void> {
      const res = await getRuntime();
      if (cancelled) return;
      if (res.kind === "ok") {
        setRuntime(res.body);
        setRuntimeError(null);
        dispatchFour({ kind: "OBSERVE", runtime: res.body, sessionId: pickSessionId() });
      } else {
        setRuntimeError(res.envelope.error.message);
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function onStart(): Promise<void> {
    const deviceId = intentDeviceId.trim();
    if (deviceId.length === 0) {
      updateRow(0, { error: "device_id required for intent.devices[]" });
      return;
    }
    dispatchFour({ kind: "DESIRE", target: "Running" });
    const idem = genIdempotencyKey("wc-start");
    const res = await postStartSession(
      { intent: { version: "1.0", devices: [{ device_id: deviceId, role: "CAPTURE" }] } },
      idem,
    );
    if (res.kind === "error") {
      updateRow(0, { error: formatError(res.status, res.envelope.error.code, res.envelope.error.message) });
      return;
    }
    updateRow(0, { command: res.body, polling: true, error: null });
    dispatchFour({ kind: "REQUESTED", command: res.body });
    await pollUntilTerminal(0, res.body.command_id);
  }

  async function onStop(): Promise<void> {
    const sid = pickSessionId();
    if (sid === null) {
      updateRow(1, { error: "no active session" });
      return;
    }
    dispatchFour({ kind: "DESIRE", target: "Stopped" });
    const idem = genIdempotencyKey("wc-stop");
    const res = await postStopSession(sid, idem);
    if (res.kind === "error") {
      updateRow(1, { error: formatError(res.status, res.envelope.error.code, res.envelope.error.message) });
      return;
    }
    updateRow(1, { command: res.body, polling: true, error: null });
    dispatchFour({ kind: "REQUESTED", command: res.body });
    await pollUntilTerminal(1, res.body.command_id);
  }

  async function onRelease(): Promise<void> {
    const sid = pickSessionId();
    if (sid === null) {
      updateRow(2, { error: "no active session" });
      return;
    }
    dispatchFour({ kind: "DESIRE", target: "Released" });
    const idem = genIdempotencyKey("wc-rel");
    const res = await postReleaseSession(sid, idem);
    if (res.kind === "error") {
      updateRow(2, { error: formatError(res.status, res.envelope.error.code, res.envelope.error.message) });
      return;
    }
    updateRow(2, { command: res.body, polling: true, error: null });
    dispatchFour({ kind: "REQUESTED", command: res.body });
    await pollUntilTerminal(2, res.body.command_id);
  }

  async function pollUntilTerminal(rowIdx: number, commandId: string): Promise<void> {
    for (let i = 0; i < 30; i += 1) {
      const res = await getCommand(commandId);
      if (res.kind === "error") {
        updateRow(rowIdx, { error: formatError(res.status, res.envelope.error.code, res.envelope.error.message), polling: false });
        return;
      }
      const c = res.body;
      dispatchFour({ kind: "EXECUTING", state: c.state });
      updateRow(rowIdx, { command: c });
      if (c.state !== "pending") {
        updateRow(rowIdx, { polling: false });
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    updateRow(rowIdx, { error: "poll timeout (15s)", polling: false });
  }

  function updateRow(idx: number, patch: Partial<CmdRow>): void {
    setRows((prev) => {
      const next = prev.slice();
      const cur = next[idx];
      if (cur === undefined) return prev;
      next[idx] = { ...cur, ...patch };
      return next;
    });
  }

  function pickSessionId(): string | null {
    const lastStart = rowsRef.current[0]?.command;
    if (lastStart !== null && lastStart !== undefined && fourRef.current.observed === "running") {
      const sid = runtimeRef.current?.sessions.find((s) => s.state === "running")?.id;
      return sid ?? null;
    }
    const firstRunning = runtimeRef.current?.sessions.find((s) => s.state === "running")?.id;
    return firstRunning ?? null;
  }

  return (
    <>
      <div className="panel">
        <h2>4-state machine</h2>
        <div className="kv">
          <div className="k">desired</div>
          <div className="v">{four.desired ?? "—"}</div>
          <div className="k">requested</div>
          <div className="v">{four.requested?.state ?? "—"} ({four.requested?.command_id ?? "—"})</div>
          <div className="k">executing</div>
          <div className="v">{four.executing?.state ?? "—"}</div>
          <div className="k">observed</div>
          <div className="v">{four.observed ?? "—"}</div>
          <div className="k">divergence</div>
          <div className="v">{four.divergence ? "DIVERGENT" : "ok"}</div>
        </div>
        <div className="credential-banner">{describeFourState(four)}</div>
      </div>

      <div className="panel">
        <h2>Start session</h2>
        <div className="kv">
          <div className="k">device_id</div>
          <div className="v">
            <input
              className="credential"
              value={intentDeviceId}
              onChange={(e) => setIntentDeviceId(e.target.value)}
              placeholder="canonical device UUID"
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="primary" onClick={() => void onStart()}>Start</button>
        </div>
        <CommandRowView row={rows[0]} />
      </div>

      <div className="panel">
        <h2>Stop session</h2>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="secondary" onClick={() => void onStop()}>Stop</button>
        </div>
        <CommandRowView row={rows[1]} />
      </div>

      <div className="panel">
        <h2>Release session</h2>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="danger" onClick={() => void onRelease()}>Release</button>
        </div>
        <CommandRowView row={rows[2]} />
      </div>

      {runtimeError !== null ? <div className="error-banner">{runtimeError}</div> : null}
    </>
  );
}

function CommandRowView({ row }: { row: CmdRow | undefined }): React.JSX.Element {
  if (row === undefined) return <></>;
  if (row.error !== null) return <div className="error-banner">{row.error}</div>;
  if (row.command === null) return <div style={{ color: "var(--muted)", fontSize: 12 }}>no command yet</div>;
  const c = row.command;
  const cls = c.state === "completed" ? "ok" : c.state === "pending" ? "warn" : "err";
  return (
    <div className="kv">
      <div className="k">command_id</div>
      <div className="v">{c.command_id}</div>
      <div className="k">state</div>
      <div className="v">
        <span className={`state-pill ${cls}`}>{c.state}</span>
        {row.polling ? <span style={{ marginLeft: 8, color: "var(--muted)" }}>polling…</span> : null}
      </div>
      {c.classification !== undefined ? (
        <>
          <div className="k">classification</div>
          <div className="v">{c.classification}</div>
        </>
      ) : null}
      {c.detail !== undefined ? (
        <>
          <div className="k">detail</div>
          <div className="v">{c.detail}</div>
        </>
      ) : null}
      <div className="k">created_at</div>
      <div className="v">{c.created_at}</div>
      {c.terminal_at !== undefined ? (
        <>
          <div className="k">terminal_at</div>
          <div className="v">{c.terminal_at}</div>
        </>
      ) : null}
    </div>
  );
}

function formatError(status: number, code: string, message: string): string {
  return `HTTP ${status} ${code}: ${message}`;
}

// suppress unused-import lint for ApiClientError when not used
export { ApiClientError };
