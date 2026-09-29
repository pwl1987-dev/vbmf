/**
 * SDK-01A — 机械类型生成（drift-gated codegen）。
 *
 * 单一 authority = apps/api/src/routes/schemas.ts（Product API JSON Schema）。
 * 本脚本把 schema 常量编译为自包含 TS interface（json-schema-to-typescript
 * 的 compile），物化到 src/generated/types.ts —— 发布物（dist/*.d.ts）不依赖
 * apps/api 源码；消费方零运行时依赖。
 *
 * Drift gate（CI / 本地）：
 *   node scripts/gen-types.ts && git diff --exit-code src/generated/
 * schema 改动后忘记再生成 → generated 与 authority 不一致 → CI FAIL。
 *
 * 本文件是工具（非发布物）；发布物只含 dist/。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";
import {
  ERROR_CODE_VALUES,
  errorEnvelopeSchema,
  runtimeSnapshotSchema,
  commandOperationBodySchema,
  startSessionBodySchema,
  graphRuntimeIntentSchema,
  healthLayersSchema,
  healthLiveSchema,
  sseFramePayloadSchema,
  alarmItemSchema,
} from "../../../apps/api/src/routes/schemas.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "generated", "types.ts");

const banner = `/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT BY HAND（SDK-01A 机械派生）。
 *
 * Source of truth: apps/api/src/routes/schemas.ts（Product API JSON Schema
 * authority）。修改 schema 后必须重新运行 \`npm run gen:types\` 并提交本文件；
 * CI drift gate（gen + git diff --exit-code）拦截未同步的派生类型。
 *
 * SDK 内禁止手写本文件已有的类型（ErrorCode/CommandState/SessionState/
 * envelope/intent 等）——handwriting gate 静态拦截。
 */

export type ErrorCode =
${ERROR_CODE_VALUES.map((c) => `  | "${c}"`).join("\n")};
`;

async function main(): Promise<void> {
  const parts: string[] = [banner];
  const jobs: Array<[unknown, string, { bannerComment?: string }]> = [
    [errorEnvelopeSchema, "ErrorEnvelope", { bannerComment: "" }],
    [runtimeSnapshotSchema, "RuntimeSnapshot", { bannerComment: "" }],
    [commandOperationBodySchema, "CommandOperationBody", { bannerComment: "" }],
    [graphRuntimeIntentSchema, "GraphRuntimeIntent", { bannerComment: "" }],
    [startSessionBodySchema, "StartSessionBody", { bannerComment: "" }],
    [healthLayersSchema, "HealthLayersResponse", { bannerComment: "" }],
    [healthLiveSchema, "HealthLiveResponse", { bannerComment: "" }],
    [sseFramePayloadSchema, "SseFramePayload", { bannerComment: "" }],
    // HI-01C: alarm wire 行（GET/ack 响应载荷）。
    [alarmItemSchema, "AlarmItem", { bannerComment: "" }],
  ];
  for (const [schema, name, opts] of jobs) {
    // json-schema-to-typescript 处理整棵子 schema（含引用展开），输出为
    // interface + 依赖子类型（inline/并列 export）。
    const ts = await compile(schema as never, name, opts);
    parts.push(ts.trim());
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${parts.join("\n\n")}\n`, "utf8");
  console.log(`generated ${outPath}`);
}

await main();
