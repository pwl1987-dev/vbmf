#!/usr/bin/env node
/**
 * SDK-ENTRY-01 — vbmf-sdk 静态红线 gate（planning S2/S8/§6）。
 *
 * 1. 依赖红线：SDK production source（src/，generated 除外）不得出现
 *    产品内部面字面量：/internal/v1/、:50051、media-agent:、DeckLinkAPI、
 *    /dev/blackmagic、gst-launch、ffmpeg、drizzle、better-auth、
 *    event_outbox、commands SQL —— SDK 只是 Product/Event/Health consumer。
 * 2. Handwriting 红线：SDK 不得手写已由 generated 派生的 wire 类型
 *    （ErrorCode/CommandState/SessionState/ErrorEnvelope/RuntimeSnapshot/
 *    CommandOperationBody/GraphRuntimeIntent/SseFramePayload）—— 单源纪律。
 * 3. Authority 红线：SDK 不得内嵌第二份 JSON Schema（schema 常量手写）。
 *
 * Exit 0 = PASS；1 = violations（file:line 锚点输出，适配 CI annotations）。
 * 文档字符串（注释内提及）同样拦截——红线词在注释里出现即说明源文件在
 * 谈论被禁面，写明例外豁免文件清单。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

const FORBIDDEN_LITERALS = [
  "/internal/v1/",
  ":50051",
  "media-agent:",
  "DeckLinkAPI",
  "/dev/blackmagic",
  "gst-launch",
  "ffmpeg",
  "drizzle",
  "better-auth",
  "event_outbox",
];

const HANDWRITTEN_TYPE_PATTERNS = [
  /^\s*export\s+type\s+(ErrorCode|CommandState|SessionState|SessionPhase|SinkKind|SourceKind)\s*=/,
  /^\s*export\s+interface\s+(ErrorEnvelope|RuntimeSnapshot|CommandOperationBody|GraphRuntimeIntent|StartSessionBody|SseFramePayload|ProductSession)\s/,
];

const SCHEMA_LITERAL_PATTERN = /additionalProperties\s*:/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      yield* walk(p);
    } else if (name.endsWith(".ts")) {
      yield p;
    }
  }
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (rel !== "src/generated/types.ts") {
    lines.forEach((line, i) => {
      for (const lit of FORBIDDEN_LITERALS) {
        if (line.toLowerCase().includes(lit.toLowerCase())) {
          violations.push(`${rel}:${i + 1}: forbidden product-internal literal "${lit}"`);
        }
      }
      for (const pat of HANDWRITTEN_TYPE_PATTERNS) {
        if (pat.test(line)) {
          violations.push(`${rel}:${i + 1}: handwritten wire type (must derive from generated/): ${line.trim().slice(0, 60)}`);
        }
      }
      if (SCHEMA_LITERAL_PATTERN.test(line)) {
        violations.push(`${rel}:${i + 1}: inline JSON Schema literal (single authority = apps/api schemas.ts)`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error("vbmf-sdk red-line gate: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log("vbmf-sdk red-line gate: PASS (dependency + handwriting + single-schema-authority)");
