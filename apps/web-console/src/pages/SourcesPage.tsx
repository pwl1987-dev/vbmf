/**
 * WCO-01C — 02-sources 源管理（LOCK 表面 docs/phase-0.5/operator/02-sources.html）。
 * MVP 映射（LOCK 偏差已登记）：
 * - V0.2 runtime 无 PCI/connector/format/signal-lock/QC 观测面 ⇒ 对应列显式 N/A（不放假数据）；
 * - Network/Internal 段暂无源数据（E-40 创建分支 = 后续包）⇒ 空态提示；
 * - device-binding 清单仍 systemd/env 权威（01C forbidden 写操作）⇒ Add Source 只读禁用；
 * - 数据只来自 /api/v1/runtime；Used By = sessions[].inputs[] 真引用（id8·state）。
 */
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { getRuntime } from "../api/client.ts";
import type { RuntimeSnapshot } from "../api/schemas.ts";
import { t } from "../i18n/index.ts";

const NA = "N/A";

type TabId = "local" | "network" | "internal";

// devices/ports/resources 在 wire schema 里是开放对象（同 DashboardPage），按证据字段取值。
function strField(obj: unknown, key: string): string | null {
  if (typeof obj === "object" && obj !== null) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return null;
}

export function SourcesPage(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("local");

  const refresh = useCallback(async (): Promise<void> => {
    const rt = await getRuntime();
    if (rt.kind === "ok") {
      setRuntime(rt.body);
      setError(null);
    } else {
      setError(rt.envelope.error.code + ": " + rt.envelope.error.message);
    }
  }, []);

  // 2s 轮询（与 dashboard 同型；SSE = 后续包）。shortcut: 无 SSE, 轮询延迟上限 2s
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const devices = runtime?.devices ?? [];

  function portDirection(deviceId: string): string {
    const p = runtime?.ports.find((x) => strField(x, "device_id") === deviceId);
    return strField(p, "direction") ?? NA;
  }

  function resourceState(deviceId: string): string | null {
    const r = runtime?.resources.find((x) => strField(x, "device_id") === deviceId);
    return strField(r, "state");
  }

  /** Adapter 列 = binding 真内容（match_kind · confidence）；binding null = N/A（诚实缺观测）。 */
  function adapterText(deviceId: string): string {
    const d = devices.find((x) => strField(x, "id") === deviceId);
    const b = strField(d, "binding");
    if (b === null) return NA;
    const m = b.match(/match_kind:\s*(\w+),\s*confidence:\s*(\w+)/);
    return m === null ? b : m[1] + " · " + m[2];
  }

  /** Used By = 引用该设备作 inputs 的会话（id8·state 真观测；无 channel 字段用会话 id 代替）。 */
  function usedByText(deviceId: string): string {
    if (runtime === null) return "—";
    const hits = runtime.sessions.filter((s) => s.inputs.some((i) => i.id === deviceId));
    if (hits.length === 0) return "—";
    return hits.map((s) => s.id.slice(0, 8) + "(" + s.state + ")").join(" · ");
  }

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "local", label: t("src.tab_local"), count: devices.length },
    { id: "network", label: t("src.tab_network"), count: 0 },
    { id: "internal", label: t("src.tab_internal"), count: 0 },
  ];

  return (
    <div className="dash">
      <div className="src-tabs">
        {tabs.map((x) => (
          <button
            key={x.id}
            className={tab === x.id ? "active" : ""}
            onClick={() => setTab(x.id)}
          >
            {x.label} <span className="src-count">{x.count}</span>
          </button>
        ))}
      </div>
      {error !== null ? <p className="dash-dim">{error}</p> : null}
      {tab === "local" ? (
        <section className="dash-panel">
          <h3>{t("src.local_title")}</h3>
          <table>
            <thead>
              <tr>
                <th>{t("src.col_id")}</th>
                <th>{t("src.col_device")}</th>
                <th>{t("src.col_direction")}</th>
                <th>{t("src.col_adapter")}</th>
                <th>{t("src.col_connector")}</th>
                <th>{t("src.col_format")}</th>
                <th>{t("src.col_lock")}</th>
                <th>{t("src.col_qc")}</th>
                <th>{t("src.col_runtime")}</th>
                <th>{t("src.col_usedby")}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const id = strField(d, "id") ?? "";
                const rs = resourceState(id);
                return (
                  <tr key={id}>
                    <td>{id.slice(0, 8)}</td>
                    <td>{strField(d, "model") ?? NA}</td>
                    <td>{portDirection(id)}</td>
                    <td>{adapterText(id)}</td>
                    <td>{NA}</td>
                    <td>{NA}</td>
                    <td>{NA}</td>
                    <td>{NA}</td>
                    <td>{rs === "allocated" ? t("src.in_use") : rs === "available" ? t("src.free") : NA}</td>
                    <td>{usedByText(id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>
            <button disabled title={t("src.add_hint")}>{t("src.add")}</button>
          </p>
        </section>
      ) : (
        <section className="dash-panel">
          <p className="dash-dim">{tab === "network" ? t("src.empty_network") : t("src.empty_internal")}</p>
        </section>
      )}
    </div>
  );
}
