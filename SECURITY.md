# 安全策略

## 支持的版本

| 版本 | 支持状态 |
|---|---|
| V0.2.x | ✅ 活跃 |
| V0.1.x | ❌ 已停止维护 |

> VBMF 目前处于 1.0 之前的开发阶段（Phase 0.5 完成；Phase 0.6 即将启动）。
> 安全更新将应用到最新的 V0.2.x 分支。

## 报告漏洞

**请勿通过公开的 GitHub Issues 报告安全漏洞。**

请通过以下私密渠道报告：

- **GitHub Security Advisories（首选）**：[github.com/pwl1987-dev/vbmf/security/advisories/new](../../security/advisories/new)
- **Email**：待配置（开仓库前替换为真实安全邮箱；配置前请只用 Security Advisories）

### 报告内容

- **漏洞类型**（如 SQL 注入、XSS、RCE、认证绕过）
- **影响组件**（如 Media Agent、Graph Designer、REST API）
- **影响版本**（V0.2.x）
- **攻击向量**（本地 / 网络 / 物理）
- **复现步骤**（最小化）
- **影响评估**（攻击者能达成什么）
- **建议修复**（如有）
- **你的名字 / 标识**（用于在 Advisory 中署名，可选）

### 响应时间

| 阶段 | SLA |
|---|---|
| 确认 | 72 小时内 |
| 初步评估 | 7 天内 |
| 修复 / 补丁 | 30 天内（严重），90 天内（高危） |
| 公开披露 | 与报告人协调 |

## 范围

### 范围内

- Media Agent（Rust）— Phase 1 落地后
- Backend（Fastify / Drizzle）— Phase 2 落地后
- Web Console（TypeScript）— Phase 4 落地后
- GraphSpec / GraphRuntime / Configuration Versioning 数据
- Health Tree 数据暴露 / API 访问控制
- BMD SDI 输入处理（NDI / RIST / Zixi 为 V0.3+ 计划范围，落地后纳入）
- FFmpeg 命令构建（避免命令注入）
- PostgreSQL / Valkey / SRS / RustFS 部署脚本

### 范围外

- BMD Desktop Video SDK（第三方；向 Blackmagic Design 报告）
- FFmpeg（第三方；向 FFmpeg 项目报告）
- SRS（第三方；向 ossrs/srs 报告）
- V0.2 架构文档中的已知限制（V0.2 LOCK FINAL；以 issue 报告）

## 自托管部署的安全最佳实践

> 适用于 self-hosted 部署。

### 网络

- UFW：仅开放 22 (SSH) + 必要管理端口
- SSH：仅 key 认证，禁用密码
- 媒体端口（SRS 1935/1985/8080）：限制来源 IP
- fail2ban：SSH jail 启用（参考 `docs/SYSTEM_AND_PROJECT_PLAN.md`）

### 主机

- 操作系统硬化：`/etc/sysctl.d/99-hardening.conf`
- sudo 限定：passwordless 仅限指定运维用户（部署细节见 `docs/SYSTEM_AND_PROJECT_PLAN.md`）
- 文件权限：`/opt` owner 限定

### 应用

- 所有配置走 `change_set`（X3 Configuration Versioning），不要直接改库
- `secrets/` 目录权限 700
- API key 轮换周期：90 天
- 数据库密码使用强随机（≥ 32 字符）

### Secrets

- 禁止将 secrets 提交到 git
- 使用 `.env` + `.gitignore`（已配置）
- CI / CD 使用 GitHub Secrets / 部署环境变量

## 报告非安全 Bug

请用 [GitHub Issues](../../issues) 报告普通 bug。安全相关务必用上述私有渠道。

## 致谢

感谢所有负责任地披露安全问题的安全研究者。

---

**VBMF Contributors** · V0.2 LOCK FINAL · Apache 2.0
