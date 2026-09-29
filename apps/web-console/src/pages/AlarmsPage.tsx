/**
 * HI-01D — Alarms 页（投影派生事实 + operator awareness ack）。
 *
 * 红线（HEALTH-INCIDENT planning §1）：
 * - Alarm 是控制面投影，不是 Runtime truth；本页数据全部来自
 *   `/api/v1/alarms`（canonical，PG 持久）——**绝不本地 React 状态伪造**。
 * - ACK 只是 operator awareness（ack_at/ack_by/ack_note）；acked 行继续以
 *   active/recovery_status 真实展示（acked ≠ healthy）。
 */
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { getAlarms, postAckAlarm } from "../api/client.ts";
import type { AlarmItem } from "../api/schemas.ts";

type State =
  | { kind: "loading" }
  | {
      kind: "ok";
      active: AlarmItem[];
      history: AlarmItem[];
      error: string | null;
      ackBusy: string | null;
    };

function severityClass(s: string): string {
  if (s === "error") return "err";
  if (s === "warning") return "warn";
  return "";
}

function AlarmRow(props: {
  alarm: AlarmItem;
  ackBusy: string | null;
  onAck: (id: string) => void;
}): React.JSX.Element {
  const a = props.alarm;
  const related = a.related_session_id ?? a.related_device_id ?? a.related_pipeline_id;
  return (
    <tr>
      <td>
        <span className={`state-pill ${severityClass(a.severity)}`}>{a.severity}</span>
      </td>
      <td>{a.kind}</td>
      <td>{a.failure_domain}</td>
      <td className="mono">{related ?? "—"}</td>
      <td>{a.summary}</td>
      <td>{a.recovery_status}{a.event_count > 1 ? ` ×${a.event_count}` : ""}</td>
      <td>{a.active ? "ACTIVE" : a.clear_reason ?? "cleared"}</td>
      <td>
        {a.ack_at === null ? (
          a.active ? (
            <button
              type="button"
              disabled={props.ackBusy === a.id}
              onClick={() => props.onAck(a.id)}
              title="Operator awareness only — does NOT clear the alarm or change runtime state"
            >
              Ack
            </button>
          ) : (
            <span>—</span>
          )
        ) : (
          <span title={a.ack_note ?? ""}>acked{a.ack_note !== null ? " ✎" : ""}</span>
        )}
      </td>
    </tr>
  );
}

export function AlarmsPage(): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: "loading" });

  const refresh = useCallback(async (): Promise<void> => {
    const [activeRes, historyRes] = await Promise.all([
      getAlarms({ active: true, limit: 100 }),
      getAlarms({ active: false, limit: 50 }),
    ]);
    if (activeRes.kind === "ok" && historyRes.kind === "ok") {
      setState({
        kind: "ok",
        active: activeRes.body.alarms,
        history: historyRes.body.alarms,
        error: null,
        ackBusy: null,
      });
    } else {
      const failed = activeRes.kind === "error" ? activeRes : historyRes;
      setState((prev) => ({
        kind: "ok",
        active: prev.kind === "ok" ? prev.active : [],
        history: prev.kind === "ok" ? prev.history : [],
        error: failed.kind === "error" ? `${failed.envelope.error.code}: ${failed.envelope.error.message}` : null,
        ackBusy: null,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAck = useCallback(
    async (id: string): Promise<void> => {
      setState((prev) => (prev.kind === "ok" ? { ...prev, ackBusy: id } : prev));
      const res = await postAckAlarm(id, "acknowledged from web console");
      if (res.kind === "error") {
        setState((prev) =>
          prev.kind === "ok"
            ? { ...prev, error: `${res.envelope.error.code}: ${res.envelope.error.message}`, ackBusy: null }
            : prev,
        );
        return;
      }
      await refresh();
    },
    [refresh],
  );

  if (state.kind === "loading") {
    return <p>Loading alarms…</p>;
  }

  return (
    <div>
      <h2>Alarms</h2>
      <p className="meta">
        Projection-derived alarm facts (canonical, PG-persisted). Ack = operator awareness
        only — it never clears an alarm and never means the runtime is healthy.
      </p>
      {state.error !== null && <p className="error">API error — {state.error}</p>}
      {state.active.length === 0 ? (
        <p>No active alarms.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>severity</th><th>kind</th><th>domain</th><th>related</th>
              <th>summary</th><th>recovery</th><th>state</th><th>ack</th>
            </tr>
          </thead>
          <tbody>
            {state.active.map((a) => (
              <AlarmRow key={a.id} alarm={a} ackBusy={state.ackBusy} onAck={(id) => void onAck(id)} />
            ))}
          </tbody>
        </table>
      )}
      {state.history.length > 0 && (
        <details>
          <summary>Cleared history ({state.history.length})</summary>
          <table>
            <thead>
              <tr>
                <th>severity</th><th>kind</th><th>domain</th><th>related</th>
                <th>summary</th><th>recovery</th><th>state</th><th>ack</th>
              </tr>
            </thead>
            <tbody>
              {state.history.map((a) => (
                <AlarmRow key={a.id} alarm={a} ackBusy={state.ackBusy} onAck={() => undefined} />
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
