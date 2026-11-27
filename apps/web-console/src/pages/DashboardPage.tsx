/**
 * WCO-01B — 01-dashboard 主控台（LOCK 表面 docs/phase-0.5/operator/01-dashboard.html）。
 * MVP 映射（LOCK 偏差已登记，待 owner 签字）：
 * - Backup/SRS/REC/Clock(PTP) 四格 V0.2 无数据源 ⇒ 显式 N/A（REDUNDANCY-ENTRY-01）；
 * - NEXT 窗无独立预览流（E-42 未实现）⇒ 显示空闲待命源设备，不放假画面；
 * - 操作员意图层 = 真实四状态旅程（Desired/Requested/Executing/Observed）；
 * - 数据只来自 /api/v1/runtime + /api/v1/alarms；监看流 = 同源 /hls/index.m3u8（hls.js）。
 */
import type * as React from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { getAlarms, getCommand, getRuntime, postStartSession, postStopSession } from "../api/client.ts";
import type { AlarmItem, CommandOperationBody, RuntimeSnapshot } from "../api/schemas.ts";
import { buildDecklinkHlsIntent } from "../api/intent.ts";
import { POLL_INTERVAL_MS, shouldSkipPoll } from "../api/poll.ts";
import { describeFourState, initialFourState, reduceFourState } from "../state/fourStateMachine.ts";
import { t } from "../i18n/index.ts";
import { HlsMonitor } from "../components/HlsMonitor.tsx";

// snapshot 的 devices/ports/resources 在 wire schema 里是开放对象（index signature），
// 只按证据字段（id/model/device_id/direction/state/observed_active）安全取值。
function strField(obj: unknown, key: string): string | null {
  if (typeof obj === "object" && obj !== null) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return null;
}

function genIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface CmdState {
  command: CommandOperationBody | null;
  polling: boolean;
  error: string | null;
}

export function DashboardPage(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [four, dispatchFour] = useReducer(reduceFourState, initialFourState());
  const [cmd, setCmd] = useState<CmdState>({ command: null, polling: false, error: null });
  const [busy, setBusy] = useState(false);
  // stop 后 observed 目标（会话消失前锁定 id；否则 OBSERVE 找不到对象）
  const journeySidRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [rt, al] = await Promise.all([getRuntime(), getAlarms({ active: true, limit: 10 })]);
    if (rt.kind === "ok") {
      setRuntime(rt.body);
      const running = rt.body.sessions.find((s) => s.state === "running")?.id ?? null;
      dispatchFour({ kind: "OBSERVE", runtime: rt.body, sessionId: journeySidRef.current ?? running });
      setError(null);
    } else {
      setError(`${rt.envelope.error.code}: ${rt.envelope.error.message}`);
    }
    if (al.kind === "ok") setAlarms(al.body.alarms);
  }, []);

  // 5s cadence 轮询（CP-01C 限流：每台 24 次/分 ⇒ 240/分 读桶可容约 10 台同看；
  // 不可见页与 429 冷却期不发请求 —— 见 api/poll.ts）
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (!shouldSkipPoll()) void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const runningSession = runtime?.sessions.find((s) => s.state === "running") ?? null;

  function deviceName(id: string | null): string {
    if (runtime === null || id === null) return "—";
    const d = runtime.devices.find((x) => strField(x, "id") === id);
    if (d === undefined) return id.slice(0, 8);
    return strField(d, "model") ?? id.slice(0, 8);
  }

  /** 空闲输入设备 = ports(direction=input) 且不在 resources(allocated) 里（真数据）。 */
  function freeInputDevice(): { deviceId: string; model: string } | null {
    if (runtime === null) return null;
    const busyDevices = new Set(
      runtime.resources
        .filter((r) => strField(r, "state") === "allocated")
        .map((r) => strField(r, "device_id"))
        .filter((x): x is string => x !== null),
    );
    for (const p of runtime.ports) {
      const dev = strField(p, "device_id");
      if (strField(p, "direction") === "input" && dev !== null && !busyDevices.has(dev)) {
        return { deviceId: dev, model: deviceName(dev) };
      }
    }
    return null;
  }

  async function pollUntilTerminal(commandId: string): Promise<void> {
    for (let i = 0; i < 30; i += 1) {
      const res = await getCommand(commandId);
      if (res.kind === "error") {
        setCmd({ command: null, polling: false, error: `HTTP ${res.status} ${res.envelope.error.code}: ${res.envelope.error.message}` });
        return;
      }
      dispatchFour({ kind: "EXECUTING", state: res.body.state });
      setCmd({ command: res.body, polling: res.body.state === "pending", error: null });
      if (res.body.state !== "pending") return;
      await new Promise((r) => setTimeout(r, 500));
    }
    setCmd((prev) => ({ ...prev, polling: false, error: t("sessions.poll_timeout") }));
  }

  async function runJourney(post: () => ReturnType<typeof postStartSession>, desire: "Running" | "Stopped"): Promise<void> {
    setBusy(true);
    dispatchFour({ kind: "DESIRE", target: desire });
    const res = await post();
    if (res.kind === "error") {
      setCmd({ command: null, polling: false, error: `HTTP ${res.status} ${res.envelope.error.code}: ${res.envelope.error.message}` });
      setBusy(false);
      return;
    }
    dispatchFour({ kind: "REQUESTED", command: res.body });
    setCmd({ command: res.body, polling: true, error: null });
    await pollUntilTerminal(res.body.command_id);
    await refresh();
    setBusy(false);
  }

  function onStart(): void {
    const free = freeInputDevice();
    if (free === null) {
      setCmd({ command: null, polling: false, error: t("dash.no_free_device") });
      return;
    }
    journeySidRef.current = null;
    void runJourney(() => postStartSession(buildDecklinkHlsIntent(free.deviceId), genIdempotencyKey("wc-hls")), "Running");
  }

  function onStop(): void {
    if (runningSession === null) return;
    const sid = runningSession.id;
    journeySidRef.current = sid;
    void runJourney(() => postStopSession(sid, genIdempotencyKey("wc-hls-stop")), "Stopped");
  }

  const pgmDeviceId = strField(runtime?.program_switch, "observed_active") ?? runningSession?.inputs.map((i) => strField(i, "id")).find((x) => x !== null) ?? null;
  const free = freeInputDevice();
  const genMs = runtime?.generated_at_ms ?? null;
  return (
    <div className="dash">
      <div className="dash-statebar">
        <StateItem dot={runningSession !== null ? "green" : "gray"} label={t("dash.pgm")} value={runningSession !== null ? runningSession.state : t("dash.no_session")} />
        <StateItem dot="gray" label={t("dash.backup")} value={t("dash.na")} />
        <StateItem dot="gray" label={t("dash.srs")} value={t("dash.na")} />
        <StateItem dot="gray" label={t("dash.rec")} value={t("dash.na")} />
        <StateItem dot="gray" label={t("dash.clock")} value={t("dash.na")} />
        <StateItem dot={alarms.length > 0 ? "yellow" : "green"} label={t("dash.incidents")} value={String(alarms.length)} />
      </div>

      <div className="dash-main">
        <section className="dash-panel dash-now">
          <h3>{t("dash.now")}</h3>
          <div className="dash-video">
            <HlsMonitor playing={runningSession !== null} />
            {runningSession !== null ? <span className="dash-badge">{t("dash.onair")}</span> : null}
            {runningSession !== null ? <span className="dash-vlabel">{deviceName(pgmDeviceId)}</span> : null}
          </div>
          <p className="dash-dim">{describeFourState(four)}</p>
        </section>

        <section className="dash-panel dash-next">
          <h3>{t("dash.next")}</h3>
          <div className="dash-video">
            <HlsMonitor playing={false} />
            <span className="dash-vlabel">{free !== null ? free.model : t("dash.no_free_device")}</span>
          </div>
          <p className="dash-dim">{t("dash.next_hint")}</p>
        </section>

        <section className="dash-panel dash-status">
          <h3>{t("dash.status")}</h3>
          <div className="row"><span>{t("dash.row_lifecycle")}</span><span className="val">{runningSession?.state ?? "OFFLINE"}</span></div>
          <div className="row"><span>{t("dash.row_phase")}</span><span className="val">{runningSession?.phase ?? "—"}</span></div>
          <div className="row"><span>{t("dash.row_pgm_device")}</span><span className="val">{deviceName(pgmDeviceId)}</span></div>
          <div className="row"><span>observation_revision</span><span className="val">{runtime?.observation_revision ?? "—"}</span></div>
          <div className="row"><span>observation_lineage</span><span className="val">{(runtime?.observation_lineage ?? "—").slice(0, 8)}</span></div>
          <div className="row"><span>{t("dash.row_generated")}</span><span className="val">{genMs === null ? "—" : new Date(genMs).toISOString().slice(11, 19)}</span></div>
        </section>
      </div>

      <section className="dash-panel dash-intent">
        <h3>{t("dash.intent")}</h3>
        <div className="dash-intent-grid">
          <div className="dash-step"><div className="step-label">{t("four.desired")}</div><div className="step-val">{four.desired ?? "—"}</div></div>
          <div className="dash-step"><div className="step-label">{t("four.requested")}</div><div className="step-val">{four.requested?.state ?? "—"}{four.requested !== null ? ` · ${four.requested.command_id}` : ""}</div></div>
          <div className="dash-step"><div className="step-label">{t("four.executing")}</div><div className="step-val">{four.executing?.state ?? "—"}</div></div>
          <div className="dash-step"><div className="step-label">{t("four.observed")}</div><div className="step-val">{four.observed ?? "—"}{four.divergence ? " · DIVERGENT" : ""}</div></div>
        </div>
      </section>

      <div className="dash-controls">
        <button className="dash-take" disabled={busy || runningSession !== null} onClick={onStart}>{t("dash.btn_start")}</button>
        <button className="secondary" disabled={busy || runningSession === null} onClick={onStop}>{t("dash.btn_stop")}</button>
        {cmd.polling ? <span className="dash-dim">{t("sessions.polling")}</span> : null}
        {cmd.command !== null ? <span className="dash-dim">{cmd.command.command_id} · {cmd.command.state}</span> : null}
        {cmd.error !== null ? <span className="error-banner">{cmd.error}</span> : null}
      </div>

      <section className="dash-panel dash-alarms">
        <h3>{t("dash.alarms")}</h3>
        {alarms.length === 0 ? (
          <p className="dash-dim">{t("alarms.none")}</p>
        ) : (
          <table>
            <thead>
              <tr><th>{t("alarms.col_severity")}</th><th>{t("alarms.col_kind")}</th><th>{t("alarms.col_domain")}</th><th>{t("alarms.col_summary")}</th></tr>
            </thead>
            <tbody>
              {alarms.map((a) => (
                <tr key={a.id}>
                  <td><span className={`state-pill ${a.severity === "error" ? "err" : "warn"}`}>{a.severity}</span></td>
                  <td>{a.kind}</td>
                  <td>{a.failure_domain}</td>
                  <td>{a.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {error !== null ? <div className="error-banner">{error}</div> : null}
    </div>
  );
}

function StateItem({ dot, label, value }: { dot: "green" | "yellow" | "red" | "gray"; label: string; value: string }): React.JSX.Element {
  return (
    <div className="dash-item">
      <span className={`dash-dot ${dot}`} />
      <div className="label">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}
