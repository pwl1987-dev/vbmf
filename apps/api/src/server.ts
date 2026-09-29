/**
 * CP-01A/CP-01B/CP-01C Fastify 应用组合根。Product `/api/v1/*` 与 Rust prototype
 * `/api/v1/*` 完全隔离（C1）——本应用不反代/不转发任何请求到 agent 的
 * prototype 诊断面；对 agent 的唯一消费是 AgentControlClient。
 *
 * CP-01C：Better Auth（AuthN identity owner）+ CASL（应用层 AuthZ）+
 * 应用层限流 + 安全审计由 registerSecurity 统一 enforcement；`x-dev-principal`
 * 开发态桩已从生产路径删除（C11）。测试只能经显式注入的 Authenticator
 * fixture 模拟身份，生产无 dev bypass。
 */
import { fastify, type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { pino } from "pino";
import { pathToFileURL } from "node:url";
import { loadConfig, type AppConfig } from "./config.ts";
import { AgentControlClient } from "./agent/agentControlClient.ts";
import { runtimeRoutes, type RouteDeps } from "./routes/runtime.ts";
import { healthRoutes } from "./routes/health.ts";
import { commandRoutes } from "./routes/commands.ts";
import { alarmRoutes } from "./routes/alarms.ts";
import { ApiError, errorEnvelope, internalError, notFound } from "./lib/errors.ts";
import { AgentWireSessionIdError } from "./lib/sessionIds.ts";
import { CommandService, type CommandPlane } from "./command/commandService.ts";
import { createDb, runMigrations, type Db } from "./db/index.ts";
import { ProjectionDrainLoop } from "./events/eventPlane.ts";
import { eventsRoutes } from "./routes/events.ts";
import { BetterAuthAuthenticator, createAuth, type Authenticator } from "./security/auth.ts";
import { SlidingWindowRateLimiter } from "./security/rateLimit.ts";
import { SecurityAudit } from "./security/audit.ts";
import { registerSecurity } from "./security/fastifySecurity.ts";
import type pg from "pg";

export interface BuildOptions {
  agent?: RouteDeps["agent"];
  /** CP-01B 注入（测试）；CP-01C hermetic 测试可注入显式 CommandPlane stub。 */
  commandService?: CommandPlane;
  /** CP-01C 注入（测试 fixture；生产路径由 db+secret 构建 Better Auth）。 */
  authenticator?: Authenticator;
  /** 显式禁用持久层（默认按 config.databaseUrl 推导）。 */
  withoutDb?: boolean;
  /** 测试注入日志目的地（redact 配置仍取同一来源——机检不削弱）。 */
  logDestination?: NodeJS.WritableStream;
}

/** 日志选项唯一来源：credential redact 管道（安全红线）在此集中定义。 */
export function buildLoggerOptions(level: string): { level: string; redact: { paths: string[]; censor: string } } {
  return {
    level,
    redact: {
      // 安全红线：credential/token 绝不进日志（CP-01C 机检覆盖）。
      paths: ['req.headers["x-api-key"]', "req.headers.authorization", "req.headers.cookie"],
      censor: "[REDACTED]",
    },
  };
}

export interface AppHandle {
  app: FastifyInstance;
  db: Db | null;
  pool: pg.Pool | null;
  /** CP-01C：auth 层实例；null = not_configured（/api/v1 fail-closed 503）。 */
  authenticator: Authenticator | null;
  /** CP-01D：单消费者 drain loop（null = 事件面 not_configured）。 */
  drainLoop: ProjectionDrainLoop | null;
}

export async function buildApp(config: AppConfig, opts: BuildOptions = {}): Promise<FastifyInstance> {
  const handle = await buildAppHandle(config, opts);
  return handle.app;
}

export async function buildAppHandle(config: AppConfig, opts: BuildOptions = {}): Promise<AppHandle> {
  const agent = opts.agent ?? new AgentControlClient({ baseUrl: config.mediaAgentRpcUrl });

  let db: Db | null = null;
  let pool: pg.Pool | null = null;
  if (!opts.withoutDb && config.databaseUrl !== null) {
    const created = createDb(config.databaseUrl);
    db = created.db;
    pool = created.pool;
    if (config.migrateOnBoot) {
      await runMigrations(db);
    }
  }

  const commandService =
    opts.commandService ??
    (db !== null
      ? new CommandService({
          db,
          agent,
          leaseMs: config.commandLeaseMs,
          replayWaitMs: config.commandReplayWaitMs,
        })
      : null);

  // CP-01C auth 层：需要 db + secret；测试可显式注入 authenticator fixture。
  const authenticator: Authenticator | null =
    opts.authenticator ?? (db !== null && config.authSecret !== null ? new BetterAuthAuthenticator(createAuth({ db, secret: config.authSecret }), db) : null);

  const limiter =
    authenticator !== null
      ? new SlidingWindowRateLimiter({
          windowMs: config.rateLimitWindowMs,
          maxByBucket: { read: config.rateLimitReadMax, write: config.rateLimitWriteMax },
        })
      : null;

  const app = fastify({
    // SDK-01A：未知请求字段 fail-closed 拒绝（400），不得静默剥离——
    // Fastify 默认 removeAdditional:true 会把 additionalProperties:false 的
    // 多余字段删掉再放行，对 intent 语义构成静默篡改（dispatch 内容 ≠
    // operator 提交内容；vendor-neutral 红线要求显式拒绝）。
    ajv: { customOptions: { removeAdditional: false } },
    // redact 配置唯一来源 buildLoggerOptions；测试经 logDestination 注入
    // 捕获流（同 redact 配置，机检不削弱）。
    ...(opts.logDestination !== undefined
      ? { loggerInstance: pino(buildLoggerOptions(config.logLevel), opts.logDestination) as FastifyBaseLogger }
      : { logger: buildLoggerOptions(config.logLevel) }),
    ...(config.trustProxy ? { trustProxy: true as const } : {}),
  });

  // 错误处理器必须在路由插件 register 之前挂载（await register 会固化子
  // context 的 handler 链；后挂的根级 handler 不作用于已 boot 的插件路由）。
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      req.log.warn({ code: err.code, status: err.status }, err.message);
      return reply.code(err.status).send(errorEnvelope(err));
    }
    if (err instanceof AgentWireSessionIdError) {
      // server-log 保留原始 wire 值供诊断；响应不泄漏内部细节。
      req.log.error({ rawId: err.rawId }, "agent wire session id rejected");
      const mapped = internalError("runtime snapshot could not be normalized");
      return reply.code(mapped.status).send(errorEnvelope(mapped));
    }
    if (err instanceof SyntaxError && "body" in err) {
      const mapped = new ApiError("VALIDATION_ERROR", 400, "request body is not valid JSON", false);
      return reply.code(mapped.status).send(errorEnvelope(mapped));
    }
    // Fastify JSON-Schema 校验失败（querystring/params/body 模式不匹配）→
    // 映射为 400 VALIDATION_ERROR，与 ApiError 语义统一；避免落回 500。
    const code = (err as { code?: unknown }).code;
    if (
      code === "FST_ERR_VALIDATION" ||
      code === "FST_ERR_VALIDATION_ERROR" ||
      code === "FST_ERR_VALIDATION_CONTEXT"
    ) {
      const message =
        typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "request validation failed";
      const mapped = new ApiError("VALIDATION_ERROR", 400, message, false);
      return reply.code(mapped.status).send(errorEnvelope(mapped));
    }
    // 含 security misconfiguration（/api/v1 路由缺 security config）= fail-closed 500。
    req.log.error({ err }, "unhandled error");
    const mapped = internalError("internal server error");
    return reply.code(mapped.status).send(errorEnvelope(mapped));
  });

  app.setNotFoundHandler((_req, reply) => {
    const mapped = notFound("route not found");
    return reply.code(mapped.status).send(errorEnvelope(mapped));
  });

  // CP-01D：单消费者 drain loop（B9——advisory lock 抢锁失败如实降级）；
  // EVENTS_POLL_MS=0 显式禁用事件面（outbox/SSE 只读路径不受影响）。
  const drainLoop =
    db !== null && pool !== null && config.eventsPollMs > 0
      ? new ProjectionDrainLoop({
          db,
          pool,
          agent,
          pollMs: config.eventsPollMs,
          retentionMs: config.eventsRetentionMs,
          log: app.log,
        })
      : null;

  // CP-01C enforcement 链必须先注册（preHandler 全局钩子；路由随后声明
  // config.security）。
  registerSecurity(app, {
    authenticator,
    limiter,
    audit: db !== null ? new SecurityAudit(db) : null,
  });

  await app.register(runtimeRoutes, { agent });
  await app.register(healthRoutes, { agent, db, authenticator, drainLoop });
  await app.register(commandRoutes, { commandService });
  await app.register(eventsRoutes, { db, ssePollMs: config.eventsSsePollMs });
  // HI-01B: alarms 投影只读面 + awareness ack。
  await app.register(alarmRoutes, {
    db,
    audit: db !== null ? new SecurityAudit(db) : null,
  });

  app.addHook("onClose", async () => {
    if (drainLoop !== null) await drainLoop.stop();
  });

  // CP-01D：抢锁启动单消费者 drain（失败 = 多实例降级，事件面只读仍可用）。
  if (drainLoop !== null) {
    await drainLoop.start();
  }

  // F6：启动时回收上次运行遗留的超龄 pending（租约回收，不猜成功）。
  if (commandService !== null) {
    const recovered = await commandService.recoverStalePending().catch((err: unknown) => {
      app.log.error({ err }, "startup lease recovery failed");
      return -1;
    });
    if (recovered > 0) {
      app.log.warn({ recovered }, "startup lease recovery marked stale pending as timeout");
    }
  }

  return { app, db, pool, authenticator, drainLoop };
}

async function start(): Promise<void> {
  const config = loadConfig();
  const { app, pool } = await buildAppHandle(config);
  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exitCode = 1;
  }
  const shutdown = async (): Promise<void> => {
    await app.close();
    if (pool !== null) await pool.end();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await start();
}
