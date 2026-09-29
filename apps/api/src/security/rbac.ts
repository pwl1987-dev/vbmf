/**
 * CP-01C 应用层 RBAC（planning C11 + EXTERNAL_API_CONTRACT §6）。
 *
 * - CASL 是应用层 AuthZ evaluator；Fastify 是 enforcement owner；权限完全由
 *   Product API action/resource 语义驱动（不发明 Web Console 权限模型）。
 * - 默认 fail-closed：CASL 无匹配规则即拒绝；未知 role → 空 ability；未知
 *   action/resource 组合无规则可匹配 → 拒绝。只有显式 allow 才放行。
 * - 最小可扩展：role → rules 映射一处定义；新增 action/resource/role 只改
 *   本模块（route → permission 映射见 ROUTE_PERMISSIONS）。
 */
import { Ability, AbilityBuilder } from "@casl/ability";

export type ProductAction = "read" | "start" | "stop" | "release" | "ack";
export type ProductResource = "runtime" | "command" | "session" | "events" | "alarm";

export interface PermissionSpec {
  readonly action: ProductAction;
  readonly resource: ProductResource;
}

/** Product API 每条路由的 (action, resource) 语义（RBAC 唯一输入形态）。 */
export const ROUTE_PERMISSIONS = {
  runtimeRead: { action: "read", resource: "runtime" },
  commandRead: { action: "read", resource: "command" },
  sessionStart: { action: "start", resource: "session" },
  sessionStop: { action: "stop", resource: "session" },
  sessionRelease: { action: "release", resource: "session" },
  eventsRead: { action: "read", resource: "events" },
  // HI-01B: alarm 读/知悉（ack = operator awareness only，非媒体操作）。
  alarmRead: { action: "read", resource: "alarm" },
  alarmAck: { action: "ack", resource: "alarm" },
} as const satisfies Record<string, PermissionSpec>;

type ProductAbility = Ability<[ProductAction, ProductResource]>;

function rulesFor(builder: AbilityBuilder<ProductAbility>, role: string): void {
  switch (role) {
    case "viewer":
      builder.can("read", "runtime");
      builder.can("read", "command");
      builder.can("read", "events");
      builder.can("read", "alarm");
      return;
    case "operator":
      builder.can("read", "runtime");
      builder.can("read", "command");
      builder.can("read", "events");
      builder.can("read", "alarm");
      builder.can("ack", "alarm");
      builder.can("start", "session");
      builder.can("stop", "session");
      builder.can("release", "session");
      return;
    default:
      // 未知角色：不授予任何规则（fail-closed；不抛异常以便审计统一记录）。
      return;
  }
}

/** 未知 role 返回空 ability（对一切 action/resource 拒绝）。 */
export function buildAbilityForRole(role: string): ProductAbility {
  const builder = new AbilityBuilder<ProductAbility>(Ability);
  rulesFor(builder, role);
  return builder.build();
}

export function authorizationDecision(
  role: string,
  spec: PermissionSpec,
): { allowed: boolean } {
  const ability = buildAbilityForRole(role);
  return { allowed: ability.can(spec.action, spec.resource) };
}
