# HI-01E — BMD bounded acceptance（2026-09-29，HEALTH-INCIDENT-ENTRY-01 收口）

## Provenance

- live main `fa837f19912e3b6fae10fb103d77f5269d17287a`（STATE 收口 commit；实现链 `a55c671`→`af19563`→`6444d8d`→`adfab99`→`534f51e` 全部 exact-head 双 lane CI 绿）
- native agent = CI artifact `media-agent-linux-gst-bin` @ `adfab99`（sha256 `28cb30a7ada6d65a6dfcd1a6b64a28db3098345aa4111d6d11a461158b982129`——Rust faults-wire 变更后新位元）绑 `172.18.0.1:50051`，manifest `a2-8-02i-v5` + `VBMF_MACHINE_ID=10.30.15.10`
- compose 控制面 = fa837f1 exact archive（含 alarms 迁移 0004，MIGRATE_ON_BOOT 应用）

## 验收记录

1. **分层健康**：api/runtime（Ready devices=3）/db/auth/events 全 up。
2. **正常 DeckLink 旅程**：start（SDI-IN-1 `6ede00d0`）→ **actual RUNNING** → stop → release → 无 live 残留。
3. **alarms canonical 面**：初始 zero-alarm 为真值；旅程中健康会话零新 alarm；R1 期间一次**真实故障**（agent 启动 60s bootstrap 占位 lease 未过期 → LeaseConflict preflight 拒绝）被如实记录为 `session_failed` alarm（severity=error、domain=session、canonical preflight summary）；R2 健康会话 running 的恢复观察经**宽路径**将其 clear（recovered，evidence 含观察快照）——真机完整走过 fault→alarm→recovery→clear 链（fault 为真实事件非注入）。
4. **Browser（真实 Chromium）4/4 PASS**：credential gate 真实认证；nav 第五表面 Alarms；页面显示 canonical 状态（No active alarms + Cleared history，页首明示 "Ack = operator awareness only — it never clears an alarm and never means the runtime is healthy"）；reload 重认证收敛同一 canonical 真值。
5. **teardown 零残留**：agent 按显式 PID kill（`ss -tlnp` 反查）+ 端口复核；compose `down -v`；UFW 50051 规则删除；BMD /tmp 工件清理；0 容器。验收身份随 ephemeral db 销毁。
6. **device-2 红线 before/after**：PID 992634（gst-launch decklinkvideosink device-number=2 mode=1080p25，owner lytv）全程存活（至收口连续 uptime 25d7h+）。

## 诚实边界（登记）

- 真机**可控注入**的 RuntimeEvent fault 缝不存在（fault 注入器仅在 gates binary；agent 停止 = 依赖不可达，不发事件）。§16 fault 链的注入式软件面证据 = VM 全栈旅程（STATE §3.86）；真机由真实 lease-conflict 故障提供等效链证据。
- bootstrap 占位 lease 60s TTL 窗口内的会话创建会被 LeaseConflict 拒绝（R1 现象）——语义为启动期防抢占，属已知行为非缺陷；alarm 如实记录。
