/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT BY HAND（SDK-01A 机械派生）。
 *
 * Source of truth: apps/api/src/routes/schemas.ts（Product API JSON Schema
 * authority）。修改 schema 后必须重新运行 `npm run gen:types` 并提交本文件；
 * CI drift gate（gen + git diff --exit-code）拦截未同步的派生类型。
 *
 * SDK 内禁止手写本文件已有的类型（ErrorCode/CommandState/SessionState/
 * envelope/intent 等）——handwriting gate 静态拦截。
 */

export type ErrorCode =
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_DENIED"
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_CONFLICT"
  | "RESOURCE_UNAVAILABLE"
  | "CAPABILITY_UNSUPPORTED"
  | "COMMAND_REJECTED"
  | "COMMAND_FAILED"
  | "DEPENDENCY_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";


export interface ErrorEnvelope {
  error: {
    code:
      | "AUTHENTICATION_FAILED"
      | "AUTHORIZATION_DENIED"
      | "VALIDATION_ERROR"
      | "RESOURCE_NOT_FOUND"
      | "RESOURCE_CONFLICT"
      | "RESOURCE_UNAVAILABLE"
      | "CAPABILITY_UNSUPPORTED"
      | "COMMAND_REJECTED"
      | "COMMAND_FAILED"
      | "DEPENDENCY_UNAVAILABLE"
      | "RATE_LIMITED"
      | "INTERNAL_ERROR";
    message: string;
    details?: {
      [k: string]: unknown;
    };
    request_id: string;
    retryable: boolean;
  };
}

export interface RuntimeSnapshot {
  devices: {
    [k: string]: unknown;
  }[];
  ports: {
    [k: string]: unknown;
  }[];
  resources: {
    [k: string]: unknown;
  }[];
  sessions: {
    id: string;
    label: string;
    state: "reserved" | "running" | "paused" | "releasing" | "released" | "terminated";
    phase:
      "requested" | "provisioning" | "binding" | "leased" | "starting" | "running" | "stopping" | "released" | "failed";
    outputs: string[];
    inputs: {
      id: string;
      handle: number;
    }[];
  }[];
  capabilities: {
    [k: string]: unknown;
  }[];
  program_switch: {
    [k: string]: unknown;
  } | null;
  generated_at_ms: number;
  observation_revision: number;
  observation_lineage: string;
}

export interface CommandOperationBody {
  command_id: string;
  state: "pending" | "completed" | "failed" | "timeout" | "conflict" | "rejected";
  kind: "start_session" | "stop_session" | "release_session";
  created_at: string;
  classification?: string;
  detail?: string;
  verdict?: {
    [k: string]: unknown;
  };
  terminal_at?: string;
}

export interface GraphRuntimeIntent {
  version: string;
  /**
   * @minItems 1
   */
  devices: [
    {
      device_id: string;
      role: string;
      pipeline: {
        source:
          | {
              kind: "decklink";
              device_id: string;
              port_id?: string;
            }
          | {
              kind: "rtmp";
              source_id: string;
              endpoint: {
                protocol: "rtmp";
                host: string;
                port: number;
                path: string;
              };
            }
          | {
              kind: "self_test";
            };
        sink: {
          kind: "appsink" | "hls" | "rtmp";
        };
      };
    },
    ...{
      device_id: string;
      role: string;
      pipeline: {
        source:
          | {
              kind: "decklink";
              device_id: string;
              port_id?: string;
            }
          | {
              kind: "rtmp";
              source_id: string;
              endpoint: {
                protocol: "rtmp";
                host: string;
                port: number;
                path: string;
              };
            }
          | {
              kind: "self_test";
            };
        sink: {
          kind: "appsink" | "hls" | "rtmp";
        };
      };
    }[]
  ];
}

export interface StartSessionBody {
  intent: {
    version: string;
    /**
     * @minItems 1
     */
    devices: [
      {
        device_id: string;
        role: string;
        pipeline: {
          source:
            | {
                kind: "decklink";
                device_id: string;
                port_id?: string;
              }
            | {
                kind: "rtmp";
                source_id: string;
                endpoint: {
                  protocol: "rtmp";
                  host: string;
                  port: number;
                  path: string;
                };
              }
            | {
                kind: "self_test";
              };
          sink: {
            kind: "appsink" | "hls" | "rtmp";
          };
        };
      },
      ...{
        device_id: string;
        role: string;
        pipeline: {
          source:
            | {
                kind: "decklink";
                device_id: string;
                port_id?: string;
              }
            | {
                kind: "rtmp";
                source_id: string;
                endpoint: {
                  protocol: "rtmp";
                  host: string;
                  port: number;
                  path: string;
                };
              }
            | {
                kind: "self_test";
              };
          sink: {
            kind: "appsink" | "hls" | "rtmp";
          };
        };
      }[]
    ];
  };
  command_id?: string;
}

export interface HealthLayersResponse {
  checked_at_ms: number;
  layers: {
    api: {
      status:
        | "up"
        | "down"
        | "unreachable"
        | "not_configured"
        | "running"
        | "locked_by_other_instance"
        | "stopped"
        | "not_started";
      observed_at_ms?: number;
      [k: string]: unknown;
    };
    runtime: {
      status:
        | "up"
        | "down"
        | "unreachable"
        | "not_configured"
        | "running"
        | "locked_by_other_instance"
        | "stopped"
        | "not_started";
      observed_at_ms?: number;
      [k: string]: unknown;
    };
    db: {
      status:
        | "up"
        | "down"
        | "unreachable"
        | "not_configured"
        | "running"
        | "locked_by_other_instance"
        | "stopped"
        | "not_started";
      observed_at_ms?: number;
      [k: string]: unknown;
    };
    auth: {
      status:
        | "up"
        | "down"
        | "unreachable"
        | "not_configured"
        | "running"
        | "locked_by_other_instance"
        | "stopped"
        | "not_started";
      observed_at_ms?: number;
      [k: string]: unknown;
    };
    events: {
      status:
        | "up"
        | "down"
        | "unreachable"
        | "not_configured"
        | "running"
        | "locked_by_other_instance"
        | "stopped"
        | "not_started";
      observed_at_ms?: number;
      [k: string]: unknown;
    };
  };
}

export interface HealthLiveResponse {
  status: "live";
}

export interface SseFramePayload {
  sequence: number;
  observed_at_ms: number;
  weak_ordering: true;
  snapshot: {
    [k: string]: unknown;
  };
}

export interface AlarmItem {
  id: string;
  fingerprint: string;
  severity: "warning" | "error";
  kind: string;
  failure_domain: string;
  related_session_id: string | null;
  related_device_id: string | null;
  related_pipeline_id: string | null;
  summary: string;
  retryable: boolean | null;
  recovery_status: "active" | "escalating" | "recovered";
  first_seen_at: string;
  last_seen_at: string;
  event_count: number;
  active: boolean;
  cleared_at: string | null;
  clear_reason: string | null;
  ack_at: string | null;
  ack_by: string | null;
  ack_note: string | null;
}
