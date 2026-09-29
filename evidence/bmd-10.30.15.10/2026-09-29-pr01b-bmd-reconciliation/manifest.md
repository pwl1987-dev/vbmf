# PR-01B — Current-main BMD Deployment Reconciliation（2026-09-29）

## Provenance

- live main HEAD：`885b7661c2669f7025a42a2d223f120e684b61e7`（PR-01A 收口 commit；exact-head CI 双绿：media-agent `36547932378` + control-plane `36547932562`）
- exact archive：`git archive 885b766` → `vbmf-885b766.tar.gz`（sha256 `fa71dae3c67847cb8deb6e98475ffbf561152ed72d6b2a9e7c77757c3bcc082a`；embedded commit id 经 `git get-tar-commit-id` 读取 = `885b7661…`）
- CI artifact `media-agent-linux-gst-bin`（bmd,gstreamer debug）：sha256 `3426108dd9e117bce0d7c50dfbab74376112fc0179b42f2fb6df5db814d7eb06` —— 与 dc780c8/144ea60 位元一致（Rust 面零改动的独立实证）
- 安装：`bash ops/standalone/install.sh /tmp/vbmf-885b766.tar.gz 0.1.0-885b766 36547932378`（BMD native release build `bmd,ffmpeg-backend`，形态与既有 current 0.1.0-06bc01a 连续）
- install-manifest：`git_commit_sha=885b7661…` / `media_agent_sha256=564a6d95dfcac970d9a3a4721d22694809dafee631d65d509547125f0e26a63b` / `ci_run_id=36547932378`；staging 原子落成 + current 原子切换

## 验收记录（全部 exact 885b766）

1. **安装树 startup/health**：`/opt/vbmf/current/bin/media-agent`（release）+ device manifest `a2-8-02i-v5.manifest.json`（需显式 `VBMF_MACHINE_ID=10.30.15.10`——manifest machine-pin 拒绝宿主 `/etc/machine-id` 为 SE-01D 语义，负 pin 行为正确）；`/health` = `{"state":"Ready","devices":3,…}`；prototype `/api/v1/*` 按契约 503（真实产品面经 internal RPC）。
2. **Web Console 全栈**（native gstreamer agent 绑 `172.18.0.1:50051` + compose db/fastify/web/nginx，bmd-acceptance overlay）：
   - 分层健康：api up / runtime up（Ready, devices=3）/ db up / auth up / events running
   - **SDK 真机旅程 7/7 PASS**：start DeckLink 输入（SDI-IN-1）→ actual `state=running phase=running` → SSE 投影帧（lease_granted/session_created/identity_resolved/resource_allocated/source_materialized/session_state_changed）→ stop → released → release → gone → reload fresh read 一致（rev=5, sessions=0）
   - **Browser 旅程 9/9 PASS**（真实 Chromium）：credential gate → 真实 API 认证 → Health/Runtime/Sessions/Events 四表面 canonical 数据 → health Ready devices=3 → reload 重认证收敛 → localStorage/sessionStorage 零凭证（WCE 红线）
   - **failure/recovery**：kill native agent → `/healthz` runtime layer `unreachable` + `/api/v1/runtime` 503（诚实 DEPENDENCY_UNAVAILABLE）；重启同 binary → `up Ready devices=3` + API 200 收敛
   - **restart**：`docker restart ops-fastify-1` → healthy → API 200
3. **rollback/forward**：`switch-current.sh 0.1.0-06bc01a`（provenance verified: commit=06bc01af… digest=ok）→ `switch-current.sh 0.1.0-885b766`（provenance verified: commit=885b7661… digest=ok）；最终 current → `/opt/vbmf/0.1.0-885b766`，binary sha256 前 16 hex = `564a6d95dfcac970`（与 manifest 一致）
4. **teardown 零残留**：acceptance key 官方 revoke（key_id `hWilHgPWWTGmILdAso8wDt2Ji0rr64jN`）；native agent 停止；compose `down -v`（含卷）；UFW 50051 规则删除；BMD/VM 双端 /tmp 验收工件清理；无 `.staging-*` 残留；0 容器。
5. **device-2 红线 before/after**：PID `992634`（gst-launch-1.0 … decklinkvideosink device-number=2 mode=1080p25，owner lytv）全程存活、argv/owner 不变；`/opt/vbmf-dev/repo`（7cc33dd）未触碰；旧版本目录全部保留。

## 对账结论

`/opt/vbmf/current` 从 `0.1.0-06bc01a`（2026-09-21，RCE-01A/B）对账至 `0.1.0-885b766`（live main @ PR-01A 收口），经 install-manifest provenance 六环链 + rollback/forward 双向演练 + 全栈旅程验收。安装/升级/回滚/运行/观察/恢复全旅程在 exact commit 上成立。
