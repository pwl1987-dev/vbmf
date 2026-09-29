/**
 * SDK transport（planning S3 冻结）。
 *
 * - 统一 fetch 包装：Product 平面相对路径 + baseUrl；credential 经
 *   provider callback 每请求解析（支持 rotation）；SDK 不持久化 credential
 *   （不写 storage/cookie/URL/logs —— x-api-key 只进请求头）。
 * - 测试注入：custom fetchImpl（S3）；AbortSignal 透传。
 * - 错误语义：S4（VbmfApiError，绝不吞错、绝不假成功）。
 */
import type { ErrorEnvelope } from "./generated/types.ts";
import {
  VbmfApiError,
  malformedResponseError,
  networkFailureError,
  parseRetryAfterMs,
} from "./errors.ts";

export type CredentialProvider = () => string | Promise<string>;

export interface VbmfTransportOptions {
  /** Product 平面入口（如 "https://vbmf.example"；末尾斜杠会被规范化）。 */
  baseUrl: string;
  /** x-api-key 提供者（每请求调用一次；返回空串 = 不带凭证 → 401 面）。 */
  credentialProvider: CredentialProvider;
  /** 测试注入；生产缺省 globalThis.fetch（browser/Node 通用）。 */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
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

export class VbmfTransport {
  private readonly baseUrl: string;
  private readonly credentialProvider: CredentialProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: VbmfTransportOptions) {
    if (!/^[a-z][a-z0-9+.-]*:\/\/|^\/(?!\/)/i.test(opts.baseUrl) && !opts.baseUrl.startsWith("/")) {
      // 允许绝对 URL 与 same-origin 相对根（"" 视为 same-origin 根）。
      if (opts.baseUrl !== "") {
        throw new Error(`VbmfClient: baseUrl must be an absolute URL or a root-relative path, got ${JSON.stringify(opts.baseUrl)}`);
      }
    }
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.credentialProvider = opts.credentialProvider;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    if (!path.startsWith("/")) {
      throw new Error(`VbmfClient: request path must be root-relative, got ${JSON.stringify(path)}`);
    }
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    const apiKey = await this.credentialProvider();
    if (apiKey.length > 0) headers["x-api-key"] = apiKey;
    if (opts.body !== undefined && headers["content-type"] === undefined) {
      headers["content-type"] = "application/json";
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: opts.method ?? "GET",
        headers,
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
      });
    } catch (err) {
      throw networkFailureError(err);
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text.length === 0 ? null : JSON.parse(text);
    } catch {
      throw malformedResponseError(response.status, `body is not JSON (${text.slice(0, 80)})`);
    }

    if (response.ok && parsed !== null) {
      return parsed as T;
    }
    if (isErrorEnvelope(parsed)) {
      throw new VbmfApiError(
        response.status,
        parsed,
        parseRetryAfterMs(response.headers.get("retry-after")),
      );
    }
    throw malformedResponseError(
      response.status,
      typeof parsed === "object" && parsed !== null
        ? JSON.stringify(parsed).slice(0, 160)
        : String(parsed).slice(0, 160),
    );
  }
}
