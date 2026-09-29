/**
 * Same-origin API client (WCE-01B)。
 *
 * 永久边界：
 * - 浏览器只允许打 `/api/v1/*`、`/events/v1/stream`、`/health/*`；
 * - 禁止 http(s):// 远程 host、禁止 `:50051`、禁止 `/internal/*`；
 * - x-api-key 从内存注入；不写 URL，不写日志，不写 telemetry；
 * - HTTP 4xx/5xx 必须真实展示——HTTP 200 ≠ Runtime success；
 * - 所有响应经 ErrorEnvelope surface mapping。
 */
import { getApiKey } from "../auth/credentials.ts";
import type {
  CommandOperationBody,
  ErrorEnvelope,
  HealthLayersResponse,
  HealthLiveResponse,
  RuntimeSnapshot,
  StartSessionBody,
} from "./schemas.ts";

export type ApiResult<T> =
  | { kind: "ok"; status: number; body: T }
  | { kind: "error"; status: number; envelope: ErrorEnvelope };

export class ApiClientError extends Error {
  readonly status: number;
  readonly envelope: ErrorEnvelope;
  constructor(status: number, envelope: ErrorEnvelope) {
    super(`api error ${envelope.error.code} (${status}): ${envelope.error.message}`);
    this.name = "ApiClientError";
    this.status = status;
    this.envelope = envelope;
  }
}

/** 静态机检：禁止任何运行时出现直接连 agent 的字面量。 */
const FORBIDDEN_PATTERNS = [
  /:\/\/[^/]*media-agent/i,
  /:50051\b/,
  /\/internal\//i,
  /localhost:5173\/internal/i,
];

function assertSameOrigin(url: string): void {
  if (!url.startsWith("/")) {
    throw new Error(
      `WEB-CONSOLE-ENTRY-01 red line: api client only accepts same-origin absolute paths, got ${url}`,
    );
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `WEB-CONSOLE-ENTRY-01 red line: api client refused path matching ${pattern} (${url})`,
      );
    }
  }
}

interface RequestInit {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** 测试注入：替代全局 fetch。生产路径不传。 */
  fetchImpl?: typeof fetch;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  assertSameOrigin(path);
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const apiKey = getApiKey();
  if (apiKey !== null) {
    headers["x-api-key"] = apiKey;
  }
  if (init.body !== undefined && headers["content-type"] === undefined) {
    headers["content-type"] = "application/json";
  }

  const fetchImpl = init.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(path, {
      method: init.method ?? "GET",
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      ...(init.signal !== undefined ? { signal: init.signal } : {}),
    });
  } catch (err) {
    // 网络层失败（Fastify 不可达、CORS、abort）→ 统一视为 DEPENDENCY_UNAVAILABLE。
    const message = err instanceof Error ? err.message : String(err);
    const envelope: ErrorEnvelope = {
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: `network failure: ${message.slice(0, 240)}`,
        request_id: "client-generated",
        retryable: true,
      },
    };
    return { kind: "error", status: 0, envelope };
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length === 0 ? null : JSON.parse(text);
  } catch {
    const envelope: ErrorEnvelope = {
      error: {
        code: "INTERNAL_ERROR",
        message: "response body is not JSON",
        request_id: "client-generated",
        retryable: false,
      },
    };
    return { kind: "error", status: response.status, envelope };
  }

  if (response.ok) {
    return { kind: "ok", status: response.status, body: parsed as T };
  }
  if (isErrorEnvelope(parsed)) {
    return { kind: "error", status: response.status, envelope: parsed };
  }
  // 5xx 且非 envelope 形态：兜底 INTERNAL_ERROR envelope，绝不假装成功。
  const envelope: ErrorEnvelope = {
    error: {
      code: response.status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR",
      message: typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed).slice(0, 240) : String(parsed).slice(0, 240),
      request_id: "client-generated",
      retryable: response.status >= 500,
    },
  };
  return { kind: "error", status: response.status, envelope };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const err = (value as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return false;
  const obj = err as Record<string, unknown>;
  return (
    typeof obj["code"] === "string" &&
    typeof obj["message"] === "string" &&
    typeof obj["request_id"] === "string" &&
    typeof obj["retryable"] === "boolean"
  );
}

/**
 * `apiCall` 抛出 ApiClientError（非 2xx）；OK 路径返回 typed body。
 * 调用方应捕获 ApiClientError 并把 envelope 渲染给 operator——不得吞掉。
 */
export async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await apiFetch<T>(path, init);
  if (result.kind === "error") {
    throw new ApiClientError(result.status, result.envelope);
  }
  return result.body;
}

// ---------- 强类型 endpoint helpers（与 ROUTE_SCHEMAS 一一对应） ----------

export function getRuntime(signal?: AbortSignal): Promise<ApiResult<RuntimeSnapshot>> {
  return apiFetch<RuntimeSnapshot>("/api/v1/runtime", { ...(signal !== undefined ? { signal } : {}) });
}

export function postStartSession(
  body: StartSessionBody,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ApiResult<CommandOperationBody>> {
  return apiFetch<CommandOperationBody>("/api/v1/sessions", {
    method: "POST",
    body,
    headers: { "idempotency-key": idempotencyKey },
    ...(signal !== undefined ? { signal } : {}),
  });
}

export function postStopSession(
  sessionId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ApiResult<CommandOperationBody>> {
  return apiFetch<CommandOperationBody>(`/api/v1/sessions/${sessionId}/stop`, {
    method: "POST",
    body: {},
    headers: { "idempotency-key": idempotencyKey },
    ...(signal !== undefined ? { signal } : {}),
  });
}

export function postReleaseSession(
  sessionId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ApiResult<CommandOperationBody>> {
  return apiFetch<CommandOperationBody>(`/api/v1/sessions/${sessionId}/release`, {
    method: "POST",
    body: {},
    headers: { "idempotency-key": idempotencyKey },
    ...(signal !== undefined ? { signal } : {}),
  });
}

export function getCommand(
  commandId: string,
  signal?: AbortSignal,
): Promise<ApiResult<CommandOperationBody>> {
  return apiFetch<CommandOperationBody>(`/api/v1/commands/${commandId}`, {
    ...(signal !== undefined ? { signal } : {}),
  });
}

export function getHealthz(signal?: AbortSignal): Promise<ApiResult<HealthLayersResponse>> {
  return apiFetch<HealthLayersResponse>("/healthz", { ...(signal !== undefined ? { signal } : {}) });
}

export function getHealthLive(signal?: AbortSignal): Promise<ApiResult<HealthLiveResponse>> {
  return apiFetch<HealthLiveResponse>("/health/live", { ...(signal !== undefined ? { signal } : {}) });
}
