import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { openEventStream, type StreamHandle } from "../api/sse.ts";
import { getRuntime } from "../api/client.ts";
import type { RuntimeSnapshot, SseFramePayload } from "../api/schemas.ts";

type ConnState = "connecting" | "live" | "reconnecting";

interface DisplayedEvent {
  sequence: number;
  observedAtMs: number;
  weakOrdering: boolean;
  payloadPreview: string;
}

const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 5000, 10000] as const;

export function EventsPage(): React.JSX.Element {
  const [conn, setConn] = useState<ConnState>("connecting");
  const [events, setEvents] = useState<DisplayedEvent[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [weakOrdering, setWeakOrdering] = useState(true);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const handleRef = useRef<StreamHandle | null>(null);
  const seenRef = useRef<Set<number>>(new Set());
  const lastSeqRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot(): Promise<void> {
      const res = await getRuntime();
      if (cancelled) return;
      if (res.kind === "ok") {
        setSnapshot(res.body);
        setSnapshotError(null);
      } else {
        setSnapshotError(res.envelope.error.message);
      }
    }
    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  // 稳定长连接：effect 只在 mount 时运行一次。正常 payload 只推进
  // lastSeqRef/cursor（不重建连接）；只有真实 disconnect/error/EOF 才按
  // backoff 重连，且重连携带 cursor=lastSequence（strictly-after 续传）。
  useEffect(() => {
    aliveRef.current = true;
    function connect(): void {
      if (!aliveRef.current) return;
      // 单 active transport 保证：开新流前显式关闭旧 handle（malformed
      // 帧等场景旧流可能尚未退出读循环）。
      handleRef.current?.close();
      handleRef.current = null;
      const lastSeq = lastSeqRef.current;
      const opts = {
        ...(lastSeq !== null ? { cursor: lastSeq } : {}),
        onPayload: (payload: SseFramePayload) => {
          // 页面级去重跨重连接存活（at-least-once + strictly-after replay）。
          if (seenRef.current.has(payload.sequence)) return;
          seenRef.current.add(payload.sequence);
          setEvents((prev) => [
            ...prev,
            {
              sequence: payload.sequence,
              observedAtMs: payload.observed_at_ms,
              weakOrdering: true,
              payloadPreview: JSON.stringify(payload.snapshot).slice(0, 240),
            },
          ].slice(-200));
          setCursor(payload.sequence);
          lastSeqRef.current = payload.sequence;
          setWeakOrdering(true);
          setConn("live");
          attemptRef.current = 0;
        },
        onError: (err: Error) => {
          if (!aliveRef.current) return;
          setConn("reconnecting");
          const attempt = attemptRef.current;
          const delay = RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)] ?? 10000;
          attemptRef.current = attempt + 1;
          if (timerRef.current !== null) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (aliveRef.current) connect();
          }, delay);
          console.warn(`SSE reconnect attempt=${attempt} delay=${delay}ms err=${err.message}`);
        },
      };
      setConn(lastSeq !== null ? "reconnecting" : "connecting");
      handleRef.current = openEventStream(opts);
    }
    connect();
    return () => {
      aliveRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, []);

  return (
    <>
      <div className="panel">
        <h2>SSE connection</h2>
        <div className="kv">
          <div className="k">state</div>
          <div className="v">
            <span className={`state-pill ${conn === "live" ? "ok" : "warn"}`}>{conn}</span>
          </div>
          <div className="k">cursor (last sequence)</div>
          <div className="v">{cursor ?? "—"}</div>
          <div className="k">weak_ordering</div>
          <div className="v">{weakOrdering ? "true (projection is content-based; no global order)" : "false"}</div>
          <div className="k">distinct seen</div>
          <div className="v">{seenRef.current.size}</div>
          <div className="k">next reconnect</div>
          <div className="v">exponential backoff ({RECONNECT_BACKOFF_MS.join("/")}ms)</div>
        </div>
      </div>

      <div className="panel">
        <h2>Canonical runtime snapshot (reloaded every reload)</h2>
        {snapshotError !== null ? (
          <div className="error-banner">/api/v1/runtime: {snapshotError}</div>
        ) : snapshot !== null ? (
          <div className="kv">
            <div className="k">observation_revision</div>
            <div className="v">{snapshot.observation_revision}</div>
            <div className="k">observation_lineage</div>
            <div className="v">{snapshot.observation_lineage}</div>
            <div className="k">sessions</div>
            <div className="v">{snapshot.sessions.length}</div>
            <div className="k">devices</div>
            <div className="v">{snapshot.devices.length}</div>
          </div>
        ) : (
          <div style={{ color: "var(--muted)" }}>loading…</div>
        )}
      </div>

      <div className="panel">
        <h2>Event stream (last 200)</h2>
        {events.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>no events yet</div>
        ) : (
          <div>
            {events.slice().reverse().map((e) => (
              <div key={e.sequence} className="event-row">
                <span className="seq">#{e.sequence}</span>{" "}
                <span className="ts">{new Date(e.observedAtMs).toISOString()}</span>{" "}
                <span>weak_ordering=true</span>{" "}
                <span style={{ color: "var(--muted)" }}>{e.payloadPreview}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="warn-banner">
        On page reload, the UI re-fetches the canonical runtime snapshot first;
        SSE is only the increment. Reconnect resumes from the last successfully
        consumed sequence with strictly-after semantics.
      </div>
    </>
  );
}
