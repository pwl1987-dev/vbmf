/**
 * media-agent internal Runtime Control wire 类型（`/internal/v1/agent`
 * JSON-RPC 2.0 四方法的 result 形状；来源 `api_boundary.rs` / `transport.rs`）。
 * 只声明 CP-01A 消费的字段；透传字段以 unknown 保留原始内容。
 */

export interface AgentSessionWire {
  /** 显示形态 `session-<hex32>`（session.rs Display）；adapter 规范化为 UUID。 */
  id: string;
  /** "reserved"/"running"/"paused"/"releasing"/"released"/"terminated"。 */
  state: string;
  /** "requested"/"provisioning"/"binding"/"leased"/"starting"/"running"/"stopping"/"released"/"failed"。 */
  phase: string;
  outputs: string[];
  inputs: { id: string; handle: number }[];
}

export interface AgentQuerySnapshotWire {
  devices: unknown[];
  ports: unknown[];
  resources: unknown[];
  sessions: AgentSessionWire[];
  capabilities: unknown[];
  generated_at_ms: number;
  observation_revision: number;
  observation_lineage: string;
  program_switch: unknown;
}

/** `agent.health` result（`health_snapshot_json`）。 */
export interface AgentHealthWire {
  state: string;
  devices: number;
  active_pipelines: number;
  dropped_bus_events: number;
  clock_lost_events: number;
}

/** `command.dispatch` params（CP-01B 起消费；形状冻结自 ApiCommandRequest）。 */
export interface AgentCommandDispatchParams {
  command_id: string;
  kind: string;
  target: Record<string, unknown>;
  requested_by: string;
}

/** `events.projection` result（CP-01D 起消费；含守门字段）。 */
export interface AgentProjectionWire {
  snapshot_kind: "event_projection_snapshot";
  total: number;
  kind_counts: Record<string, number>;
  session_states: Record<string, string>;
  session_failures: Record<string, number>;
  has_critical: boolean;
  /**
   * HEALTH-INCIDENT-ENTRY-01 D1（additive；旧 agent 载荷无此字段）：故障类
   * 事件 canonical 摘要。字段照抄 RuntimeEvent 载荷（无翻译/无归并）；
   * 仅 fault 词表（pipeline_fault/hardware_fault/ambiguous_identity/
   * session_failed），顺序 = 事件序。
   */
  faults?: AgentFaultDigest[];
}

/** agent `events.projection` 的故障摘要块（canonical 照抄；非 Runtime truth）。 */
export interface AgentFaultDigest {
  kind: string;
  device_id?: string | null;
  pipeline?: string | null;
  session_id?: string | null;
  summary: string;
  retryable?: boolean | null;
}
