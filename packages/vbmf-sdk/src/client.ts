/**
 * VbmfClient —— Product API / Health API consumer（SDK-01B）。
 *
 * Command semantics（planning S5，红线）：
 * - startSession()/stopSession()/releaseSession() 返回 CommandOperation ——
 *   表达的是"命令旅程事实"（accepted/pending/terminal），**不是** Runtime
 *   actual state；HTTP 200 ≠ session running。
 * - actual 状态必须另行 getRuntime() 观察；SDK 不提供任何
 *   "assumeRunning" 类 API。
 * - getCommand() 同语义（Operation 查询 ≠ Runtime 真相）。
 *
 * Idempotency（S6）：write 方法要求显式 idempotencyKey（Idempotency-Key
 * 头）；v0.1 无自动 write retry —— 重试决策与键管理归调用方。
 */
import type {
  AlarmItem,
  CommandOperationBody,
  HealthLayersResponse,
  HealthLiveResponse,
  RuntimeSnapshot,
  StartSessionBody,
} from "./generated/types.ts";
import { VbmfTransport, type CredentialProvider } from "./transport.ts";

export interface VbmfClientOptions {
  baseUrl: string;
  credentialProvider: CredentialProvider;
  fetchImpl?: typeof fetch;
}

export class VbmfClient {
  private readonly transport: VbmfTransport;

  constructor(opts: VbmfClientOptions) {
    this.transport = new VbmfTransport({
      baseUrl: opts.baseUrl,
      credentialProvider: opts.credentialProvider,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
    });
  }

  /** 进程存活（非依赖健康）。 */
  healthLive(signal?: AbortSignal): Promise<HealthLiveResponse> {
    return this.transport.request<HealthLiveResponse>("/health/live", { signal });
  }

  /** 分层依赖健康（api/runtime/db/auth/events；层内如实降级）。 */
  health(signal?: AbortSignal): Promise<HealthLayersResponse> {
    return this.transport.request<HealthLayersResponse>("/healthz", { signal });
  }

  /** Runtime 现状唯一 live 来源（SDK 不缓存可变状态 —— Runtime owns truth）。 */
  getRuntime(sessionId?: string, signal?: AbortSignal): Promise<RuntimeSnapshot> {
    const query = sessionId !== undefined ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    return this.transport.request<RuntimeSnapshot>(`/api/v1/runtime${query}`, { signal });
  }

  /**
   * 提交 Start 命令（intent 必须是 canonical GraphRuntimeIntent —— 类型由
   * schema 机械派生；缺 pipeline 的请求会在 Product 面被 400 拒绝）。
   */
  startSession(body: StartSessionBody, idempotencyKey: string, signal?: AbortSignal): Promise<CommandOperationBody> {
    return this.commandPost("/api/v1/sessions", body, idempotencyKey, signal);
  }

  stopSession(sessionId: string, idempotencyKey: string, signal?: AbortSignal): Promise<CommandOperationBody> {
    return this.commandPost(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/stop`,
      {},
      idempotencyKey,
      signal,
    );
  }

  releaseSession(sessionId: string, idempotencyKey: string, signal?: AbortSignal): Promise<CommandOperationBody> {
    return this.commandPost(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/release`,
      {},
      idempotencyKey,
      signal,
    );
  }

  /** Operation 查询（命令旅程真相；≠ Runtime actual state）。 */
  getCommand(commandId: string, signal?: AbortSignal): Promise<CommandOperationBody> {
    return this.transport.request<CommandOperationBody>(`/api/v1/commands/${encodeURIComponent(commandId)}`, { signal });
  }

  private commandPost(
    path: string,
    body: unknown,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CommandOperationBody> {
    if (idempotencyKey.length === 0) {
      return Promise.reject(new Error("VbmfClient: idempotencyKey must be a non-empty string (S6 explicit idempotency)"));
    }
    return this.transport.request<CommandOperationBody>(path, {
      method: "POST",
      body,
      headers: { "idempotency-key": idempotencyKey },
      signal,
    });
  }

  // ---------- HI-01C: alarms（投影派生事实；只读 + awareness ack） ----------

  /**
   * Alarm 列表（keyset 分页）。返回的是控制面投影事实，**不是** Runtime
   * truth；`AlarmItem.ack_*` 是 operator awareness only——acked ≠ healthy。
   */
  async listAlarms(
    opts: { active?: boolean; severity?: "warning" | "error"; limit?: number; beforeId?: string } = {},
    signal?: AbortSignal,
  ): Promise<{ alarms: AlarmItem[]; count: number }> {
    const params = new URLSearchParams();
    if (opts.active !== undefined) params.set("active", String(opts.active));
    if (opts.severity !== undefined) params.set("severity", opts.severity);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.beforeId !== undefined) params.set("before_id", opts.beforeId);
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    return this.transport.request<{ alarms: AlarmItem[]; count: number }>(
      `/api/v1/alarms${qs}`,
      { signal },
    );
  }

  /** 单条 alarm（404 → VbmfApiError RESOURCE_NOT_FOUND）。 */
  getAlarm(alarmId: string, signal?: AbortSignal): Promise<AlarmItem> {
    return this.transport.request<AlarmItem>(`/api/v1/alarms/${encodeURIComponent(alarmId)}`, { signal });
  }

  /**
   * Operator awareness ACK（幂等）。只写 ack_* 三字段；**绝不**改变 alarm
   * active/恢复状态，也绝不代表 Runtime healthy——UI 必须与 Runtime 真实
   * 状态并列展示（HI 红线）。
   */
  ackAlarm(alarmId: string, note?: string, signal?: AbortSignal): Promise<AlarmItem> {
    return this.transport.request<AlarmItem>(`/api/v1/alarms/${encodeURIComponent(alarmId)}/ack`, {
      method: "POST",
      ...(note !== undefined ? { body: { note } } : {}),
      signal,
    });
  }
}
