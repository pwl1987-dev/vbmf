//! A2-0 (裁定刀 3): Ingest Watchdog — 独立 Runtime Health/Recovery 模块。
//!
//! 自 main.rs 逐字节迁出（签名/行为零变, 2026-09-02 a2-0-runtime-repositioning）。
//! 职责链: observe → acceptance fold → signal 检出闩锁 → 事件 emission →
//! Supervisor 决策（只决策不碰 GStreamer——边界保留）→ backoff → recover。
//! 归属: Runtime 层（main.rs 组合根与 gates bin 同源引用）。
//!
//! MEDIA-RT-01 watchdog (Supervisor → PipelineController.recover 运行时接线):
//! 单向健康链 (回应 #9): GStreamer Bus → PipelineHealth → AgentState → Supervisor → Health API;
//! 周期真 bus 监控 (Error/EOS/StateChanged) + appsink 计数 → MEDIA-RT-01 A1-A4/B1-B4/C1-C4 →
//! 错误报告 Supervisor (决策引擎) → Restart → 重校 lease → recover;
//! Supervisor 仅决策不碰 GStreamer (硬边界); `ctrl` 为 `Arc<dyn MediaBackend>` (C2c)。
//!
//! A2-8-01: **MultiInputWatchdog** —— `execution_group_observe_fold`（纯函数,
//! mock 可测）+ `spawn_execution_group_watchdog`（hw 门控薄壳）。单实例服务
//! 整个 execution group（Input A/B + Switch + Program Output 四观测面,
//! 终裁 §7.3——**禁 for 循环 spawn 多 watchdog**）。`GroupAction` 封闭词表
//! **不含任何切换变体**（T10/T12 类型级反证——自动 failover 不可构造;
//! 切换只经显式 Intent→ExecutionGroup→Adapter 链）。

#[cfg(all(feature = "bmd-provider", feature = "gstreamer-backend"))]
use std::sync::Arc;

#[cfg(all(feature = "bmd-provider", feature = "gstreamer-backend"))]
use uuid::Uuid;

#[cfg(all(feature = "bmd-provider", feature = "gstreamer-backend"))]
use crate::contracts::backend::MediaBackend;
#[cfg(all(feature = "bmd-provider", feature = "gstreamer-backend"))]
use crate::{events, health, lease, supervisor};

#[cfg(all(feature = "bmd-provider", feature = "gstreamer-backend"))]
#[allow(clippy::too_many_arguments)] // P0-7D: +sink 事件接线 + 03-01-B intake 唯一 drain 边界 (watchdog 装配参数, 非领域 API)
pub fn spawn_ingest_watchdog(
    ctrl: Arc<dyn MediaBackend>,
    handle: crate::pipeline::PipelineHandle,
    device_uuid: Uuid,
    sup: Arc<std::sync::Mutex<supervisor::Supervisor>>,
    lm: Arc<lease::InMemoryLeaseManager>,
    agent_state: Arc<std::sync::Mutex<health::AgentState>>,
    sink: Arc<dyn events::RuntimeEventSink>,
    intake: Arc<std::sync::Mutex<crate::event_intake::InternalEventIntake>>,
) {
    std::thread::spawn(move || {
        // A1/A2 在 start 前已由 materialize (身份解析) + lm.is_valid (租约) 保证, 否则不会进 watchdog.
        let _stability_window = std::time::Duration::from_secs(10); // MEDIA-RT-01C 验收窗口
        let mut prev_video = 0u64;
        let mut prev_audio = 0u64;
        let mut tick = 0u64;
        // P0-7D-1.3: reducer 折叠上下文 — bootstrap = 当前实际态 (构造期/乐观写入是输入初值);
        // 环内命令式 agent_state 散写全部收敛为 drain internal → reduce → 写回。
        let mut health_fold = crate::health::HealthFold::bootstrap(*agent_state.lock().unwrap());
        // P0-7D-2.1: SignalVerified 点亮闩锁 (a4 信号检出翻真只发一次)。
        let mut signal_latched = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            // 真实 GStreamer bus 监控 (Error/EOS/StateChanged) —— Supervisor 闭环数据源 (#8).
            let events = ctrl.observe(&handle);
            let mut bus_events: u64 = 0;
            // 在共享 Arc 上就地更新 acceptance 子项: 只读 live 状态→推导→写回 acceptance,
            // 绝不覆盖 appsink 回调写入的 video_frame_count/audio_frame_count/PTS/video_pts_state/audio_pts_state,
            // 否则每轮 snapshot 写回会把实时计数回退, 破坏 c4(计数增长) 判定 (#4 回归).
            let (pass, has_error, a4_signal) =
                if let Some(h) = crate::pipeline_events::health_arc(&handle) {
                    let mut g = h.lock().unwrap();
                    g.acceptance.a1_identity_resolved = true;
                    g.acceptance.a2_lease_acquired = true;
                    g.acceptance.a4_signal_detected = g.first_frame_ok();
                    g.acceptance.b1_first_video = g.video_first_pts.is_some();
                    g.acceptance.b2_first_audio = g.audio_first_pts.is_some();
                    g.acceptance.b3_valid_pts = g.video_first_pts.is_some();
                    g.acceptance.a3_pipeline_playing = g.playing;
                    // b4 由两路 PTS 三态推导 (P1-3): 仅当 video 与 audio 均 ValidMonotonic 才视为 PTS 单调通过.
                    // 绝不回退到单一 bool; Unknown/NonMonotonic 任一即不通过.
                    g.acceptance.b4_pts_monotonic = g.video_pts_state
                        == crate::pipeline::PtsMonotonicity::ValidMonotonic
                        && g.audio_pts_state == crate::pipeline::PtsMonotonicity::ValidMonotonic;
                    g.acceptance.c1_no_unexpected_eos = g.acceptance.c_unexpected_eos == 0;
                    g.acceptance.c2_no_pipeline_error = g.last_error.is_none();
                    g.acceptance.c3_no_repeated_reneg = g.acceptance.c_renegotiations == 0;
                    let v = g.video_frame_count;
                    let a = g.audio_frame_count;
                    g.acceptance.c4_counters_continue = v > prev_video && a > prev_audio;
                    prev_video = v;
                    prev_audio = a;
                    // C 稳定性窗口计时 + 测量字段 (用户复核 §十二).
                    if let Some(started) = g.started_at {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);
                        g.acceptance.c_observed_ms = Some(((now - started).max(0) as u64) * 1000);
                    }
                    g.acceptance.c_video_frames = g.video_frame_count;
                    g.acceptance.c_audio_frames = g.audio_frame_count;
                    // RH-BUS-02 #3: Bus 计数/acceptance 折叠收敛为共享纯函数——
                    // 与组 watchdog 同一函数 (语义漂移防线); 返回值本 watchdog 不
                    // 消费 (下方谓词以 events 原批等价判定, 行为零变化)。
                    let _fatal = fold_bus_events_into_health(&handle, &mut g, &events);
                    bus_events = g.bus_event_count;
                    (
                        g.acceptance.a_pass() && g.acceptance.b_pass() && g.acceptance.c_pass(),
                        g.last_error.is_some(),
                        g.acceptance.a4_signal_detected,
                    )
                } else {
                    (false, false, false)
                };

            // P0-7D-1.4 (ingest 接线): 上游总线观测 → canonical 事件流 (Supervisor.ingest
            // 归一化, C2 契约首次接线; mapper 关键字: "error"→PipelineFault{retryable},
            // "device lost"/"hotplug"→HardwareFault)。**03-01-A**: ingest 携带
            // device_uuid——故障事件携带 canonical 设备身份（非 nil, custody 可归因）。
            // **RH-BUS-02 (review fix)**: Error 与 EOS **均**经 canonical mapper
            // (EOS 以 pipeline-error 语义观测串 ⇒ PipelineFault{pipeline=device});
            // ingest 先于本 tick consume — 事件在产生当 tick 即被消费 (drain 破坏性
            // 单次), 由下方 fault_from_events 驱动同一 if 内至多一次 report_failure,
            // raw Bus 事实不再是第二 Supervisor 决策真路径, 无跨 tick 双计。
            for e in events.iter() {
                if let Some(obs) = bus_fatal_observation(e) {
                    let _ = sup.lock().unwrap().ingest(
                        events::EventSource::Upstream,
                        device_uuid,
                        &obs,
                    );
                }
            }
            // P0-7D-2.1: SignalVerified 点亮 — a4 (信号检出) 翻真即语义时刻 (闩锁去重;
            // 经 FanoutSink 双日志可见, 投影端点 kind_counts 同步可观测)。
            if !signal_latched && a4_signal {
                signal_latched = true;
                sink.emit(events::RuntimeEvent::SignalVerified {
                    device_id: device_uuid,
                    port_id: None,
                });
            }
            // P0-7D-1.3 + 03-01-B (事件内消费): internal 平面唯一 drain 边界——
            // 边界内 custody 全量恰一次累积 (A2-7 桥提取规则: echo 排除/nil 拒收),
            // drained 返回本 tick 批次供本地 fold (health/fault_trigger 分区
            // 语义与既有行为一致) → reduce → 写回 agent_state。
            // 03-01-D (R45 §11): 同一临界区内 custody 归因装配——
            // `attribute_failures` 首个生产消费点 (单输入 watchdog 无
            // Bridge/Program 观测列, 域分类证据缺席 → 不分类, 见
            // assemble_decision_input)。
            let (drained_internal, decision_attributed) = {
                let mut g = intake.lock().unwrap();
                let drained = g.consume();
                let (_, attributed) = assemble_decision_input(
                    device_uuid,
                    None,
                    None,
                    None,
                    &g.observations().failures,
                );
                (drained, attributed)
            };
            // P0-7D-1.4 (事件驱动故障输入): 谓词抽为 supervisor::fault_trigger_from_events
            // (纯函数, mock 面可测 — 见 evt_int_rt_01_fault_trigger_echo_never_retriggers);
            // 自回声排除/归属判定/平面分离语义在彼处锁定。
            let fault_from_events =
                supervisor::fault_trigger_from_events(&drained_internal, device_uuid);
            health_fold = crate::health::reduce(&health_fold, &drained_internal);
            *agent_state.lock().unwrap() = health_fold.agent;

            // 错误 / 事件驱动故障 → Supervisor 决策引擎 (仅决策, 不碰 GStreamer).
            // RH-BUS-02 (review fix): Error/EOS 走上方 canonical ingest 路径, 由
            // fault_from_events（drained PipelineFault, exact device_uuid）触发——
            // raw Bus 事件谓词删除, 决策真路径唯一。
            if has_error || fault_from_events {
                match sup
                    .lock()
                    .unwrap()
                    .report_failure(&device_uuid, None, decision_attributed)
                {
                    Ok(supervisor::SupervisorAction::Restart) => {
                        // Lease→Pipeline: recover 前必须重校租约仍在有效期内 (MEDIA-03 排他不变量).
                        if !lm.is_valid(&device_uuid) {
                            tracing::error!(device = %device_uuid, "recover 中止: lease 失效 (排他不变量)");
                            // P0-7D: 状态迁移必随事件 — 经 sink 发 HealthChanged (决策平面词表),
                            // 由 reducer 折叠派生 (替代原命令式直写)。
                            sink.emit(events::RuntimeEvent::HealthChanged {
                                from: "restarting".into(),
                                to: "manual_required".into(),
                            });
                            continue;
                        }
                        let backoff = sup.lock().unwrap().backoff(&device_uuid);
                        let _ = sup.lock().unwrap().begin_restart(&device_uuid);
                        std::thread::sleep(backoff);
                        match ctrl.recover(&handle) {
                            Ok(()) => {
                                sup.lock().unwrap().report_recovered(&device_uuid).ok();
                                tracing::warn!(handle = %handle.0, "MEDIA-RT-01 watchdog: recover 成功 (Supervisor→PipelineController.recover 闭环)");
                            }
                            Err(e) => tracing::error!(error = %e, "recover 失败"),
                        }
                    }
                    Ok(supervisor::SupervisorAction::Escalate) => {
                        tracing::error!(handle = %handle.0, "MEDIA-RT-01 watchdog: Escalate (MANUAL_REQUIRED)");
                        // P0-7D: report_failure Escalate 路径已发 HealthChanged{manual_required},
                        // ManualRequired 由 reducer 派生 (原命令式直写删除)。
                    }
                    Err(e) => tracing::error!(error = %e, "supervisor report_failure 失败"),
                }
            } else if pass {
                // P0-7D: Capturing 由 reducer 从 SignalVerified/SessionStateChanged{Running}
                // 派生 (原命令式直写删除); 本分支仅保留证据日志。
                tracing::info!(
                    handle = %handle.0,
                    video_frames = prev_video,
                    audio_frames = prev_audio,
                    bus_events,
                    "MEDIA-RT-01: A+B+C 全过 (canonical first-buffer 路径健康)"
                );
            } else if tick.is_multiple_of(20) {
                // 诊断: pass 未达成时打印各子项, 便于现场定位 (每 ~10s 一次, 防刷屏).
                let snap = crate::pipeline_events::read_health(&handle).unwrap_or_default();
                tracing::info!(
                    tick = tick,
                    a1 = snap.acceptance.a1_identity_resolved,
                    a2 = snap.acceptance.a2_lease_acquired,
                    a3 = snap.acceptance.a3_pipeline_playing,
                    a4 = snap.acceptance.a4_signal_detected,
                    b1 = snap.acceptance.b1_first_video,
                    b2 = snap.acceptance.b2_first_audio,
                    b3 = snap.acceptance.b3_valid_pts,
                    b4 = snap.acceptance.b4_pts_monotonic,
                    c1 = snap.acceptance.c1_no_unexpected_eos,
                    c2 = snap.acceptance.c2_no_pipeline_error,
                    c3 = snap.acceptance.c3_no_repeated_reneg,
                    c4 = snap.acceptance.c4_counters_continue,
                    cwin_ms = snap.acceptance.c_observed_ms.unwrap_or(0),
                    cwin_cfg = snap.acceptance.c_configured_window_ms,
                    vframes = snap.video_frame_count,
                    aframes = snap.audio_frame_count,
                    vpts = snap.video_first_pts.unwrap_or(0),
                    apts = snap.audio_first_pts.unwrap_or(0),
                    bus = snap.bus_event_count,
                    "MEDIA-RT-01 诊断 (未全过)"
                );
            }
            tick += 1;
        }
    });
}

// === A2-8-01: Execution Group 观测折叠（MultiInputWatchdog 核心; 纯函数） ===
//
// 四观测面（终裁 §7.3）: Input A · Input B · Switch · Program Output。
// 输入=每输入 read_health 快照 + 上一 tick 计数 + ProgramObservation +
// Desired（薄壳装配, 本函数零 IO）; 输出=分组健康事实 + 封闭动作集。
// 动作**只含故障上报**（沿既有 RuntimeEvent/Supervisor 链）——切换永不
// 在此发生（T10/T12 类型级: GroupAction 无切换变体）。

use crate::contracts::switch::ProgramObservation;
use crate::pipeline::{PipelineHealth, PtsMonotonicity};
use crate::pipeline_events::{bus_event_recovery_policy, PipelineBusEvent, PipelineBusEventKind};
use crate::switch_execution::SwitchDesired;

/// 单输入一个观测 tick（watchdog 薄壳装配）。
pub struct InputTick {
    pub device_id: uuid::Uuid,
    /// `read_health` 快照; None = HEALTH_ARCS 无条目（**观测缺席≠健康**,
    /// absence≠evidence——HealthAbsent 上报）。
    pub health: Option<PipelineHealth>,
    pub prev_video_frames: u64,
    pub prev_audio_frames: u64,
}

/// 组观测 tick 输入包。
pub struct GroupTickInputs {
    pub inputs: Vec<InputTick>,
    pub observation: ProgramObservation,
    pub desired: SwitchDesired,
}

/// 封闭动作词表——**无任何切换/输入倒换变体**（自动 failover 在本 fold
/// 不可构造; 仅故障证据上报, 归因恰好单一设备——跨设备污染不可构造）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupAction {
    ReportInputFailure {
        device_id: uuid::Uuid,
        reason: InputFailureReason,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputFailureReason {
    /// 健康快照缺席（HEALTH_ARCS 无条目）。
    HealthAbsent,
    /// 曾有帧后计数冻结（停滞证据）。
    CountersFrozen,
    /// 管线上报错误。
    PipelineError,
}

/// 单输入健康事实折叠（事实位非结论位——归因结论属 Custody）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InputHealthFold {
    pub device_id: uuid::Uuid,
    pub observed: bool,
    pub advancing: bool,
    /// None = PTS Unknown（无证据）; Some(false) = 观测到回退。
    pub pts_monotonic: Option<bool>,
    /// adapter Observation 停滞事实位。
    pub stalled: bool,
}

/// Switch/Program 观测面折叠（Desired vs Observed 一致性 + AV 成对校验）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SwitchFold {
    pub desired: SwitchDesired,
    pub observed_active: Option<uuid::Uuid>,
    /// video/audio 双平面是否同源（方案 A 成对语义的**观测侧**校验;
    /// 分离态在此可检出——Master Join 前置证据）。
    pub av_paired: bool,
    /// Desired 与 Observed 是否一致（Active(x)↔observed x;
    /// Switching{to}↔observed to = 可落定）。
    pub consistent: bool,
}

/// 一个观测 tick 的组级折叠结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GroupObservation {
    pub per_input: Vec<InputHealthFold>,
    pub switch_state: SwitchFold,
    /// program 出口存活（PTS 在且未回退）。
    pub program_alive: bool,
    pub actions: Vec<GroupAction>,
}

/// 纯函数 fold（零 IO; mock 可测）。首版判定（保守, 事实驱动）:
/// - 输入: 缺席→HealthAbsent / 曾有帧后冻结→CountersFrozen / 上报错误→
///   PipelineError（互斥优先级: 缺席 > 冻结 > 错误; 恰好归因本设备）;
/// - Switch: av_paired = 双平面同源且非 None; consistent 按 Desired 形态;
/// - Program: PTS 在场且双平面均未回退。
pub fn execution_group_observe_fold(tick: &GroupTickInputs) -> GroupObservation {
    let mut actions: Vec<GroupAction> = Vec::new();
    let per_input = tick
        .inputs
        .iter()
        .map(|it| {
            let observed = it.health.is_some();
            let (vf, af) = it
                .health
                .as_ref()
                .map(|h| (h.video_frame_count, h.audio_frame_count))
                .unwrap_or((0, 0));
            let advancing = observed && (vf > it.prev_video_frames || af > it.prev_audio_frames);
            let stalled = tick
                .observation
                .input_pts
                .iter()
                .any(|p| p.device_id == it.device_id && p.stalled);
            let pts_monotonic =
                it.health
                    .as_ref()
                    .and_then(|h| match (h.video_pts_state, h.audio_pts_state) {
                        (PtsMonotonicity::Unknown, _) | (_, PtsMonotonicity::Unknown) => None,
                        (v, a) => Some(
                            v == PtsMonotonicity::ValidMonotonic
                                && a == PtsMonotonicity::ValidMonotonic,
                        ),
                    });
            if !observed {
                actions.push(GroupAction::ReportInputFailure {
                    device_id: it.device_id,
                    reason: InputFailureReason::HealthAbsent,
                });
            } else {
                let had_frames = it.prev_video_frames > 0 || it.prev_audio_frames > 0;
                if had_frames && !advancing {
                    actions.push(GroupAction::ReportInputFailure {
                        device_id: it.device_id,
                        reason: InputFailureReason::CountersFrozen,
                    });
                } else if it.health.as_ref().is_some_and(|h| h.last_error.is_some()) {
                    actions.push(GroupAction::ReportInputFailure {
                        device_id: it.device_id,
                        reason: InputFailureReason::PipelineError,
                    });
                }
            }
            InputHealthFold {
                device_id: it.device_id,
                observed,
                advancing,
                pts_monotonic,
                stalled,
            }
        })
        .collect();

    let obs = &tick.observation;
    let av_paired = obs.video_active.is_some() && obs.video_active == obs.audio_active;
    let consistent = match (&tick.desired, obs.observed_active) {
        (SwitchDesired::ActiveInput(x), Some(o)) => *x == o,
        (SwitchDesired::Switching { to, .. }, Some(o)) => *to == o,
        _ => false,
    };
    let program_alive = obs.program_video_pts.is_some()
        && obs.program_video_pts_state != PtsMonotonicity::NonMonotonic
        && obs.program_audio_pts_state != PtsMonotonicity::NonMonotonic;
    GroupObservation {
        per_input,
        switch_state: SwitchFold {
            desired: tick.desired,
            observed_active: obs.observed_active,
            av_paired,
            consistent,
        },
        program_alive,
        actions,
    }
}

/// 03-01-D/E（R45 §11）: Supervisor 决策输入装配（纯函数, mock 可测）——
/// R45 §11 目标拓扑 `Custody → FailureDomain → Policy input → Supervisor`
/// 的证据装配点。
///
/// - **域证据**（E）: 现有 [`crate::program_execution::classify_failure_domain`]
///   三列进度观测——三列**齐备才分类**; 任一列缺席 → `None`（禁伪造健康
///   臂/故障臂。对照 gate L5d 喂入口径: 行缺席在 L2b 已保证 tap 在场前提
///   下按 not-alive 记账; 运行时无此前提, 按 media_tap.rs `absence≠evidence`
///   契约不分类——差异已在 R45 账本披露）。
/// - **归因证据**（D）: custody 累积观测 → [`crate::custody::attribute_failures`]
///   （A2-7 冻结语义零放宽）; 空 custody 证据 → `None`（absence≠evidence;
///   证据在场但身份不匹配 → 产出零归因结果——"证据在场但零归因"是诚实
///   观测, 与"无证据"区分）。
/// - 本函数只装配证据, **不做任何决策**（Restart/Escalate 判定属 Supervisor,
///   逻辑零变化; 域→恢复策略选择=03-02 Recovery Contract 消费面）。
pub fn assemble_decision_input(
    device: uuid::Uuid,
    input_advancing: Option<bool>,
    bridge_alive: Option<bool>,
    program_advancing: Option<bool>,
    custody_failures: &[crate::custody::FailureObservation],
) -> (
    Option<crate::program_execution::FailureDomain>,
    Option<crate::custody::AttributedFailures>,
) {
    let domain = match (input_advancing, bridge_alive, program_advancing) {
        (Some(i), Some(b), Some(p)) => {
            Some(crate::program_execution::classify_failure_domain(i, b, p))
        }
        _ => None,
    };
    let attributed = if custody_failures.is_empty() {
        None
    } else {
        Some(crate::custody::attribute_failures(device, custody_failures))
    };
    (domain, attributed)
}

// === RH-BUS-02: 多输入 Bus 事件消费 / 故障隔离（纯函数; 单/组 watchdog 共用） ===
//
// 四件套（组 watchdog 薄壳按 tick 顺序消费）:
// 1. `accept_owned_events`——handle 归属校验（fail-closed, 不重归因）;
// 2. `fold_bus_events_into_health`——拥有者 `PipelineHealth` Bus 计数/acceptance
//    折叠（与单管线 watchdog **同一**函数——语义漂移防线; 仅计数/日志,
//    返回 bool 不驱动组决策）;
// 3. `bus_fatal_observation`——Error/EOS → canonical 观测串（经既有 mapper
//    `sup.ingest` ⇒ `PipelineFault{pipeline=device}`; 不新增事件类型）;
// 4. `canonical_fault_devices_from_events` + `union_decision_devices`——drained
//    canonical RuntimeEvents 派生 exact-device 决策候选 ∪ fold 动作设备去重
//    （一设备单 tick 至多一次 report_failure）。raw Bus 事实不是第二决策真路径。

/// RH-BUS-02 #2: handle 归属校验（fail-closed）——`event.handle` ≠ 期望 ⇒ 拒收
/// + 记录（绝不重归因到 drain 循环的当前设备; 错配事件不是该设备的证据）。
// 消费点 = hw 门控组 watchdog 薄壳 + 纯函数测试; default 构建无调用点,
// 与 pipeline_events::bus_event_recovery_policy 同律允许 dead_code。
#[allow(dead_code)]
pub(crate) fn accept_owned_events(
    expected: crate::pipeline::PipelineHandle,
    events: Vec<PipelineBusEvent>,
) -> Vec<PipelineBusEvent> {
    events
        .into_iter()
        .filter(|e| {
            let owned = e.handle == expected;
            if !owned {
                tracing::warn!(
                    expected = %expected.0,
                    got = %e.handle.0,
                    kind = ?e.kind,
                    "RH-BUS-02 Bus 事件 handle 归属校验失败: 拒收 (绝不重归因到当前设备)"
                );
            }
            owned
        })
        .collect()
}

/// RH-BUS-02 #3: 单 tick Bus 事件 → 拥有者 `PipelineHealth` Bus 计数/acceptance
/// 折叠（单管线与组 watchdog 调用**同一**函数——语义漂移防线）。返回本批是否含
/// 致命事件（Error/EOS——决策 union 输入）。
///
/// 策略不变量（P1-4 最低策略, 冻结语义零变化）:
/// - Error/EOS: c_pipeline_errors / c_unexpected_eos 计数 + 致命返回 true;
/// - ClockLost: `CLOCK_LOST_EVENTS` 计数 + degraded 日志, **不**致命（不自动重启）;
/// - Warning/StateChanged: 仅记录（非重启信息路径）。
// 消费点 = hw 门控单/组 watchdog 薄壳 + 纯函数测试; default 构建无调用点,
// 与 pipeline_events::bus_event_recovery_policy 同律允许 dead_code。
#[allow(dead_code)]
pub(crate) fn fold_bus_events_into_health(
    handle: &crate::pipeline::PipelineHandle,
    g: &mut PipelineHealth,
    events: &[PipelineBusEvent],
) -> bool {
    let before = g.bus_event_count;
    g.bus_event_count += events.len() as u64;
    // P1-4 接线证据: 首次接获任意真实 Bus 事件时打一条 info (仅一次)。
    if before == 0 && !events.is_empty() {
        let kinds: Vec<&'static str> = events
            .iter()
            .map(|e| match e.kind {
                PipelineBusEventKind::Error => "Error",
                PipelineBusEventKind::Eos => "Eos",
                PipelineBusEventKind::StateChanged => "StateChanged",
                PipelineBusEventKind::Warning => "Warning",
                PipelineBusEventKind::ClockLost => "ClockLost",
            })
            .collect();
        tracing::info!(
            handle = %handle.0,
            kinds = ?kinds,
            "MEDIA-RT-01 bus watch 首次接获真实 GStreamer Bus 事件 (P1-4 接线生效)"
        );
    }
    let mut fatal = false;
    for e in events {
        match e.kind {
            PipelineBusEventKind::Error => {
                g.acceptance.c_pipeline_errors += 1;
                fatal = true;
            }
            PipelineBusEventKind::Eos => {
                g.acceptance.c_unexpected_eos += 1;
                fatal = true;
            }
            // P1-4 最低策略映射 (bus_event_recovery_policy): ClockLost = degraded, 不自动重启.
            PipelineBusEventKind::ClockLost => {
                crate::pipeline::CLOCK_LOST_EVENTS
                    .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                tracing::warn!(
                    handle = %handle.0,
                    severity = ?e.severity,
                    detail = %e.detail,
                    policy = bus_event_recovery_policy(e.kind),
                    "Bus ClockLost: 标记 degraded, 不触发重启 (完整 Clock Recovery 属 V0.3/P2)"
                );
            }
            PipelineBusEventKind::Warning => {
                tracing::warn!(
                    handle = %handle.0,
                    severity = ?e.severity,
                    detail = %e.detail,
                    "Bus Warning (可恢复异常, 记录不重启)"
                );
            }
            PipelineBusEventKind::StateChanged => {
                tracing::info!(
                    handle = %handle.0,
                    detail = %e.detail,
                    "Bus StateChanged (生命周期事件)"
                );
            }
        }
    }
    // c1/c2 派生随本批计数即时刷新（单管线原下一 tick 才翻转——同源函数后
    // 两组 watchdog 同语义, 致命证据当 tick 即入 acceptance 面）。
    g.acceptance.c1_no_unexpected_eos = g.acceptance.c_unexpected_eos == 0;
    g.acceptance.c2_no_pipeline_error = g.last_error.is_none();
    fatal
}

/// RH-BUS-02 (review fix): Error/EOS → canonical 观测串（共享归一化点——
/// 单/组 watchdog 与测试同一函数, 语义漂移防线）。EOS 经含 pipeline-error
/// 语义的观测串走**既有** mapper（`sup.ingest`）⇒ `PipelineFault{pipeline=device}`;
/// 不新增事件类型。ClockLost/Warning/StateChanged 非致命（P1-4 冻结策略）,
/// 返回 None 不入 mapper 路径。
// 消费点 = hw 门控单/组 watchdog 薄壳 + 纯函数测试; default 构建无调用点,
// 与 pipeline_events::bus_event_recovery_policy 同律允许 dead_code。
#[allow(dead_code)]
pub(crate) fn bus_fatal_observation(e: &PipelineBusEvent) -> Option<String> {
    match e.kind {
        PipelineBusEventKind::Error => Some(format!("pipeline error: {}", e.detail)),
        PipelineBusEventKind::Eos => Some(format!("pipeline error: unexpected eos: {}", e.detail)),
        _ => None,
    }
}

/// RH-BUS-02 (review fix): drained canonical RuntimeEvents → 组决策候选设备
/// （纯函数——Bus 致命设备的**唯一**合法来源, raw `PipelineBusEvent` 不再构成
/// 第二 Supervisor 决策真路径）。exact-device 语义 fail-closed:
/// - nil 拒收（未归属证据不扇出到任何组输入——与 custody 生产桥同律）;
/// - 非本组设备拒收（unrelated 证据不牵连全组）;
/// - `RESTART_ECHO_SUMMARY` 自回声排除（决策回声不得再次触发决策, 否则
///   attempts/backoff 随 tick 自激翻倍——与 `fault_trigger_from_events` 同律）;
/// - 非 fault kind 不在设备决策触发面（HealthChanged/SessionFailed 等）。
// 消费点 = hw 门控组 watchdog 薄壳 + 纯函数测试; default 构建无调用点,
// 与 pipeline_events::bus_event_recovery_policy 同律允许 dead_code。
#[allow(dead_code)]
pub(crate) fn canonical_fault_devices_from_events(
    drained: &[crate::events::RuntimeEvent],
    group_devices: &[uuid::Uuid],
) -> Vec<uuid::Uuid> {
    let mut devices: Vec<uuid::Uuid> = Vec::new();
    for ev in drained {
        let dev = match ev {
            crate::events::RuntimeEvent::PipelineFault {
                pipeline, summary, ..
            } if summary.as_str() != crate::supervisor::RESTART_ECHO_SUMMARY => Some(*pipeline),
            crate::events::RuntimeEvent::HardwareFault { device_id, .. } => Some(*device_id),
            _ => None,
        };
        if let Some(d) = dev.filter(|d| *d != uuid::Uuid::nil() && group_devices.contains(d)) {
            if !devices.contains(&d) {
                devices.push(d);
            }
        }
    }
    devices
}

/// RH-BUS-02 #5: 单 tick 决策设备集（纯函数）——fold 动作设备 ∪ canonical
/// 故障设备（`canonical_fault_devices_from_events` 派生, 非 raw Bus 事实）,
/// 按 device_id 去重: 同一设备本 tick 至多一次 `report_failure`（Bus 致命 +
/// 冻结计数器叠加不双计）; 独立 A+B 致命 = 两个设备各自决策。
/// 恢复动作只查该设备自己的 handle（组输入表 exact-device 检索——跨设备
/// 污染不可构造; nil/无关 canonical 故障证据不进入本集合, 不会牵连全组）。
// 消费点 = hw 门控组 watchdog 薄壳 + 纯函数测试; default 构建无调用点,
// 与 pipeline_events::bus_event_recovery_policy 同律允许 dead_code。
#[allow(dead_code)]
pub(crate) fn union_decision_devices(
    actions: &[GroupAction],
    bus_fatal: &[uuid::Uuid],
) -> Vec<uuid::Uuid> {
    let mut devices: Vec<uuid::Uuid> = actions
        .iter()
        .map(|a| match a {
            GroupAction::ReportInputFailure { device_id, .. } => *device_id,
        })
        .collect();
    for d in bus_fatal {
        if !devices.contains(d) {
            devices.push(*d);
        }
    }
    devices
}

/// A2-8-01: MultiInputWatchdog 薄壳（hw 门控; 单实例服务整个 execution
/// group——禁 for 循环 spawn 多 watchdog, 终裁修正方向）。
///
/// 与单管线 `spawn_ingest_watchdog` 同链: fold → RuntimeEvent/Supervisor
/// （recovery only）→ lease 重校 → `ctrl.recover`（仅故障输入的**自身**
/// handle——绝不切换源）。Observed 确认时推进 Desired 落定
/// （`complete_switch`——Observation 驱动, 非命令回显; 不发起切换）。
#[cfg(all(feature = "bmd-provider", feature = "gstreamer-backend"))]
#[allow(clippy::too_many_arguments)] // 装配参数（组合根一次性接线）, 非领域 API; 03-01-B: intake 唯一 drain 边界
pub fn spawn_execution_group_watchdog(
    ctrl: Arc<dyn MediaBackend>,
    switcher: Arc<dyn crate::contracts::switch::SwitchExecutionAdapter>,
    // 组输入 (device_id, handle)（来自 SessionManager status——零第二 registry）。
    group_inputs: Vec<(Uuid, crate::pipeline::PipelineHandle)>,
    graph: crate::pipeline::PipelineHandle,
    group: Arc<std::sync::Mutex<crate::switch_execution::ExecutionGroup>>,
    sup: Arc<std::sync::Mutex<supervisor::Supervisor>>,
    lm: Arc<lease::InMemoryLeaseManager>,
    agent_state: Arc<std::sync::Mutex<health::AgentState>>,
    sink: Arc<dyn events::RuntimeEventSink>,
    intake: Arc<std::sync::Mutex<crate::event_intake::InternalEventIntake>>,
    // 03-01-E（R45 §11）: 桥 liveness 观测 view（bundle 第三 trait view
    // 同源注入, OQ-G2-2 的最小闭合——不经第二 registry; None=无桥证据 →
    // 域不分类, 禁伪造健康/故障臂）。
    bridge_observation: Option<Arc<dyn crate::contracts::media_tap::BridgeObservationPort>>,
) -> std::sync::Arc<std::sync::atomic::AtomicBool> {
    // A2-8-02-E: 停止旗（ProgramExecutionRuntime teardown 置位——线程随
    // program 生命周期退出, 不再进程常驻）。
    let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_for_thread = stop_flag.clone();
    std::thread::spawn(move || {
        let mut prev: std::collections::HashMap<Uuid, (u64, u64)> =
            group_inputs.iter().map(|(d, _)| (*d, (0, 0))).collect();
        let mut health_fold = crate::health::HealthFold::bootstrap(*agent_state.lock().unwrap());
        let mut signal_latched: std::collections::HashSet<Uuid> = Default::default();
        // 03-01-E: Program 进度列的两采样状态（program_progress_since 语义
        // =帧计数增长, 与 gate L5d 同口径; 首采样前无分类证据）。
        let mut prev_program_frames: Option<(u64, u64)> = None;
        // 03-01-G（R46）: 活体观测行计数（每 20 tick≈10s 一行, 防刷屏）。
        let mut tick: u64 = 0;
        loop {
            if stop_for_thread.load(std::sync::atomic::Ordering::SeqCst) {
                tracing::info!("A2-8-02-E group watchdog: 停止旗置位, 观测线程退出");
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
            // C-TIMELINE-01: observe() 契约演进（ProgramExecutionObservation
            // 组合面）——fold 消费既有 program 平面（timeline 证据行不入
            // fold——观测折叠语义零变化, 机械路径适配）。
            let observation = switcher.observe(&graph).program;
            // 03-01-E: Program 进度列（两采样帧计数增长——classify 的第三列;
            // 首采样 None = 无分类证据, 不伪造）。
            let program_advancing = prev_program_frames.map(|(pv, pa)| {
                observation.program_video_frames > pv || observation.program_audio_frames > pa
            });
            prev_program_frames = Some((
                observation.program_video_frames,
                observation.program_audio_frames,
            ));
            // RH-BUS-02 #2/#3 (review fix): 每 (device_id, handle) Bus drain——
            // `ctrl.observe` 恰每 tick 每 handle 一次; 归属校验 fail-closed
            // (handle 错配拒收, 绝不重归因); 拥有者 `PipelineHealth` Bus 计数/
            // acceptance 经与单管线 watchdog 同一折叠函数更新（**仅计数/日志,
            // 返回 bool 不再驱动组决策**）; Error **与** EOS → canonical
            // `sup.ingest`（精确 canonical device_id, EOS 经 pipeline-error 语义
            // 观测串 ⇒ PipelineFault{pipeline=device}; 先于下方 intake consume——
            // 事件产生当 tick 即被消费, 与单管线同序）。组决策候选只在 consume
            // 后从 drained canonical RuntimeEvents 派生（见
            // canonical_fault_devices_from_events）——raw Gst/Bus 事实不构成第二
            // Supervisor 决策真路径。ClockLost 只计数/记录（degraded, 不重启）。
            for (d, h) in &group_inputs {
                let owned = accept_owned_events(*h, ctrl.observe(h));
                if let Some(hp) = crate::pipeline_events::health_arc(h) {
                    let mut g = hp.lock().unwrap();
                    fold_bus_events_into_health(h, &mut g, &owned);
                }
                for e in &owned {
                    if let Some(obs) = bus_fatal_observation(e) {
                        let _ = sup
                            .lock()
                            .unwrap()
                            .ingest(events::EventSource::Upstream, *d, &obs);
                    }
                }
            }
            let (desired, inputs_tick): (SwitchDesired, Vec<InputTick>) = {
                let g = group.lock().unwrap();
                let tick_inputs = group_inputs
                    .iter()
                    .map(|(d, h)| InputTick {
                        device_id: *d,
                        health: crate::pipeline_events::read_health(h),
                        prev_video_frames: prev.get(d).copied().unwrap_or((0, 0)).0,
                        prev_audio_frames: prev.get(d).copied().unwrap_or((0, 0)).1,
                    })
                    .collect();
                (g.desired, tick_inputs)
            };
            for it in &inputs_tick {
                if let Some(h) = &it.health {
                    prev.insert(it.device_id, (h.video_frame_count, h.audio_frame_count));
                }
            }
            let folded = execution_group_observe_fold(&GroupTickInputs {
                inputs: inputs_tick,
                observation,
                desired,
            });
            // SignalVerified 闩锁（每设备一次——沿单管线 watchdog 语义）。
            if folded.switch_state.consistent {
                if let Some(active) = folded.switch_state.observed_active {
                    if !signal_latched.contains(&active) {
                        signal_latched.insert(active);
                        sink.emit(events::RuntimeEvent::SignalVerified {
                            device_id: active,
                            port_id: None,
                        });
                    }
                }
            }
            // Observed 确认 → Desired 落定（不发起切换——T10）。
            if let SwitchDesired::Switching { to, .. } = folded.switch_state.desired {
                if folded.switch_state.observed_active == Some(to) {
                    group.lock().unwrap().complete_switch(to);
                }
            }
            // 事件内消费: 03-01-B 唯一 drain 边界（边界内 custody 全量恰一次
            // 累积）→ reduce → 写回 agent_state。03-01-D: 同一临界区取出
            // custody 累积证据供决策输入归因装配（只读 clone, 不重新 drain）。
            let (drained, custody_failures) = {
                let mut g = intake.lock().unwrap();
                let d = g.consume();
                (d, g.observations().failures.clone())
            };
            // RH-BUS-02 (review fix): 组决策候选的 Bus 致命来源**只**从 drained
            // canonical RuntimeEvents 派生（exact-device; nil/unrelated/
            // RESTART_ECHO_SUMMARY 自回声 fail-closed 拒收）——上述 ingest 的
            // PipelineFault 当 tick 即在本批, 时序闭合。
            let group_devices: Vec<Uuid> = group_inputs.iter().map(|(d, _)| *d).collect();
            let bus_fatal_devices = canonical_fault_devices_from_events(&drained, &group_devices);
            health_fold = crate::health::reduce(&health_fold, &drained);
            *agent_state.lock().unwrap() = health_fold.agent;
            // 03-01-G（R46）: 组 watchdog 真机活体观测行——**仅诊断输出,
            // 零决策逻辑**（线程活性 + 三列证据实时可得性 + 分类器活体;
            // 分类经同一 assemble_decision_input 纯函数, 结果不入任何状态,
            // 决策输入仍只在故障动作路径装配）。
            if tick.is_multiple_of(20) {
                let diag: Vec<String> = folded
                    .per_input
                    .iter()
                    .map(|f| {
                        let bridge = bridge_observation.as_ref().and_then(|p| {
                            group_inputs
                                .iter()
                                .find(|(d, _)| *d == f.device_id)
                                .and_then(|(_, h)| {
                                    p.bridge_liveness(
                                        h,
                                        crate::program_execution::FAILURE_DOMAIN_LIVENESS_WINDOW_MS,
                                    )
                                    .into_iter()
                                    .find(|l| {
                                        l.channel
                                            == crate::program_execution::tap_channel(f.device_id)
                                    })
                                    .map(|l| l.alive_in_window)
                                })
                        });
                        let (dom, _) = assemble_decision_input(
                            f.device_id,
                            Some(f.advancing),
                            bridge,
                            program_advancing,
                            &custody_failures,
                        );
                        format!(
                            "{} observed={} advancing={} bridge={:?} domain={:?}",
                            f.device_id, f.observed, f.advancing, bridge, dom
                        )
                    })
                    .collect();
                tracing::info!(
                    tick,
                    batch = drained.len(),
                    custody_evidence = custody_failures.len(),
                    program_advancing = ?program_advancing,
                    inputs = ?diag,
                    "A2-8-03-01-G 组 watchdog 活体观测行 (诊断输出, 零决策语义)"
                );
            }
            tick += 1;
            // 故障动作 → Supervisor 决策（recovery only; 切换永不在此发生）。
            // 03-01-D/E: 每决策装配决策输入——三列进度证据（本输入 advancing
            // + 桥 liveness[tap 在场才有证据] + program 进度）+ custody 事件
            // 证据归因; 证据缺席 → 不分类/不归因（assemble_decision_input）。
            // RH-BUS-02 #5 (review fix): 决策设备集 = fold 动作设备 ∪ canonical
            // 故障设备（drained RuntimeEvents 派生; 去重——单设备单 tick 至多一次
            // report_failure; 独立 A+B 致命 = 各自决策; 恢复只查该设备自己的
            // handle, 无关证据不牵连全组）。
            for device_id in union_decision_devices(&folded.actions, &bus_fatal_devices) {
                let input_advancing = folded
                    .per_input
                    .iter()
                    .find(|f| f.device_id == device_id)
                    .map(|f| f.advancing);
                let bridge_alive = match bridge_observation.as_ref() {
                    Some(port) => {
                        group_inputs
                            .iter()
                            .find(|(d, _)| *d == device_id)
                            .and_then(|(_, h)| {
                                port.bridge_liveness(
                                    h,
                                    crate::program_execution::FAILURE_DOMAIN_LIVENESS_WINDOW_MS,
                                )
                                .into_iter()
                                .find(|l| {
                                    l.channel == crate::program_execution::tap_channel(device_id)
                                })
                                .map(|l| l.alive_in_window)
                            })
                    }
                    None => None,
                };
                let (domain, attributed) = assemble_decision_input(
                    device_id,
                    input_advancing,
                    bridge_alive,
                    program_advancing,
                    &custody_failures,
                );
                // 03-01-G（R46）: 决策输入真机活体指纹（域+归因可见; 决策
                // 逻辑零变化——记录与判定分离维持 R45 F 语义）。
                tracing::info!(
                    device = %device_id,
                    domain = ?domain,
                    attributed = ?attributed,
                    "03-01-D/E 组 watchdog 决策输入装配 (真机活体指纹)"
                );
                match sup
                    .lock()
                    .unwrap()
                    .report_failure(&device_id, domain, attributed)
                {
                    Ok(supervisor::SupervisorAction::Restart) => {
                        if !lm.is_valid(&device_id) {
                            tracing::error!(device = %device_id, "recover 中止: lease 失效 (排他不变量)");
                            sink.emit(events::RuntimeEvent::HealthChanged {
                                from: "restarting".into(),
                                to: "manual_required".into(),
                            });
                            continue;
                        }
                        let backoff = sup.lock().unwrap().backoff(&device_id);
                        let _ = sup.lock().unwrap().begin_restart(&device_id);
                        std::thread::sleep(backoff);
                        // 仅恢复故障输入自身管线（handle 来自组输入表——
                        // 归因恰好该设备, 跨设备污染不可构造）。
                        if let Some((_, handle)) =
                            group_inputs.iter().find(|(d, _)| *d == device_id)
                        {
                            match ctrl.recover(handle) {
                                Ok(()) => {
                                    sup.lock().unwrap().report_recovered(&device_id).ok();
                                    tracing::warn!(
                                        handle = handle.0,
                                        "A2-8-01 group watchdog: 输入 recover 成功 (Supervisor→recover 闭环)"
                                    );
                                }
                                Err(e) => tracing::error!(error = %e, "recover 失败"),
                            }
                        }
                    }
                    Ok(supervisor::SupervisorAction::Escalate) => {
                        tracing::error!(device = %device_id, "A2-8-01 group watchdog: Escalate (MANUAL_REQUIRED)");
                    }
                    Err(e) => tracing::error!(error = %e, "supervisor report_failure 失败"),
                }
            }
        }
    });
    stop_flag
}

#[cfg(all(test, feature = "mock"))]
mod group_fold_tests {
    use super::*;
    use crate::contracts::switch::InputPts;
    use crate::pipeline::PtsMonotonicity;
    use uuid::Uuid;

    fn healthy(device: Uuid, video: u64, audio: u64) -> InputTick {
        InputTick {
            device_id: device,
            health: Some(PipelineHealth {
                video_frame_count: video,
                audio_frame_count: audio,
                video_pts_state: PtsMonotonicity::ValidMonotonic,
                audio_pts_state: PtsMonotonicity::ValidMonotonic,
                ..Default::default()
            }),
            prev_video_frames: video.saturating_sub(10),
            prev_audio_frames: audio.saturating_sub(8),
        }
    }

    fn observation(
        observed_active: Option<Uuid>,
        video_active: Option<Uuid>,
        audio_active: Option<Uuid>,
        a: Uuid,
        b: Uuid,
    ) -> ProgramObservation {
        ProgramObservation {
            observed_active,
            video_active,
            audio_active,
            switch_epoch: 0,
            input_pts: vec![
                InputPts {
                    device_id: a,
                    video_pts: Some(1000),
                    audio_pts: Some(800),
                    video_pts_state: PtsMonotonicity::ValidMonotonic,
                    audio_pts_state: PtsMonotonicity::ValidMonotonic,
                    stalled: false,
                },
                InputPts {
                    device_id: b,
                    video_pts: Some(2000),
                    audio_pts: Some(1600),
                    video_pts_state: PtsMonotonicity::ValidMonotonic,
                    audio_pts_state: PtsMonotonicity::ValidMonotonic,
                    stalled: false,
                },
            ],
            program_video_pts: Some(4400),
            program_audio_pts: Some(2200),
            program_video_pts_state: PtsMonotonicity::ValidMonotonic,
            program_audio_pts_state: PtsMonotonicity::ValidMonotonic,
            program_video_frames: 100,
            program_audio_frames: 80,
        }
    }

    #[test]
    fn group_fold_rt_01_standby_b_observed_and_flagged() {
        // T7: B 路曾被观测（prev>0）后计数冻结——fold 检出并恰好归因 B;
        // A 路照常推进零动作。证明组观测覆盖全部输入（非 first() 单视角）。
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut b_frozen = healthy(b, 100, 80);
        b_frozen.prev_video_frames = 100;
        b_frozen.prev_audio_frames = 80; // 计数不再增长
        let folded = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![healthy(a, 110, 88), b_frozen],
            observation: observation(Some(a), Some(a), Some(a), a, b),
            desired: SwitchDesired::ActiveInput(a),
        });
        assert_eq!(folded.per_input.len(), 2, "双输入均在折叠面");
        let fa = folded.per_input.iter().find(|f| f.device_id == a).unwrap();
        let fb = folded.per_input.iter().find(|f| f.device_id == b).unwrap();
        assert!(fa.observed && fa.advancing);
        assert!(fb.observed, "B 在观测面（standby 也被观测）");
        assert!(!fb.advancing, "B 计数冻结被检出");
        assert_eq!(
            folded.actions,
            vec![GroupAction::ReportInputFailure {
                device_id: b,
                reason: InputFailureReason::CountersFrozen,
            }],
            "恰好归因 B, A 零动作"
        );
    }

    #[test]
    fn group_fold_rt_01_fault_attributed_to_own_device_only() {
        // T8: B 上报错误——动作恰好 {B, PipelineError}, A 不受牵连。
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut b_err = healthy(b, 100, 80);
        b_err.health.as_mut().unwrap().last_error = Some("decklink signal lost".into());
        let folded = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![healthy(a, 110, 88), b_err],
            observation: observation(Some(a), Some(a), Some(a), a, b),
            desired: SwitchDesired::ActiveInput(a),
        });
        assert_eq!(
            folded.actions,
            vec![GroupAction::ReportInputFailure {
                device_id: b,
                reason: InputFailureReason::PipelineError,
            }]
        );
        // 健康缺席 → HealthAbsent（absence≠evidence, 上报非猜测健康）。
        let absent = Uuid::new_v4();
        let folded2 = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![InputTick {
                device_id: absent,
                health: None,
                prev_video_frames: 0,
                prev_audio_frames: 0,
            }],
            observation: observation(None, None, None, a, b),
            desired: SwitchDesired::ActiveInput(a),
        });
        assert_eq!(
            folded2.actions,
            vec![GroupAction::ReportInputFailure {
                device_id: absent,
                reason: InputFailureReason::HealthAbsent,
            }]
        );
        assert!(!folded2.per_input[0].observed);
        assert_eq!(folded2.per_input[0].pts_monotonic, None, "无证据≠false");
    }

    #[test]
    fn group_fold_rt_01_switch_success_no_recovery_action() {
        // T10: 切换成功（Desired=Switching→B, Observed=B, AV 成对）——
        // 动作集为空; Supervisor 无从被切换触发（词表无此变体）。
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let folded = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![healthy(a, 110, 88), healthy(b, 100, 80)],
            observation: observation(Some(b), Some(b), Some(b), a, b),
            desired: SwitchDesired::Switching { from: a, to: b },
        });
        assert!(folded.actions.is_empty(), "切换成功零故障动作");
        assert!(folded.switch_state.consistent, "Observed=B 可落定");
        assert!(folded.switch_state.av_paired);
        assert!(folded.program_alive);
    }

    #[test]
    fn group_fold_rt_01_recovery_required_reports_inconsistent_no_settle() {
        // R63-A 钉子: 降级终态 RecoveryRequired 落入 consistent=false 通配臂
        // ——如实上报不一致, 且落定路径（complete_switch）仅匹配 Switching
        // 臂, 对降级态结构性不动作（恢复归会话级故障面, watchdog 不越权）。
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let folded = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![healthy(a, 110, 88), healthy(b, 100, 80)],
            observation: observation(Some(b), Some(b), Some(b), a, b),
            desired: SwitchDesired::RecoveryRequired { from: a, to: b },
        });
        assert!(
            !folded.switch_state.consistent,
            "降级终态不宣称一致（observed 值无关——desired 无可确认目标）"
        );
        assert!(folded.actions.is_empty(), "输入健康则零故障动作（不越权）");
    }

    #[test]
    fn group_fold_rt_01_av_divergence_detected() {
        // T5 观测侧: video=B / audio=A 分离态——av_paired=false 检出
        // （Master Join 前置证据; Mock adapter 结构性构造不出, 折叠面可检）。
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let folded = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![healthy(a, 110, 88), healthy(b, 100, 80)],
            observation: observation(None, Some(b), Some(a), a, b),
            desired: SwitchDesired::ActiveInput(a),
        });
        assert!(!folded.switch_state.av_paired, "双平面分离必须可检出");
        assert!(!folded.switch_state.consistent);
    }

    #[test]
    fn group_fold_rt_01_pts_rollback_breaks_program_alive() {
        // AV continuity（T5/T6 观测侧）: program PTS 回退 → program_alive=false
        //（PTS 单调三态——NonMonotonic 是证据非猜测）。
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut obs = observation(Some(a), Some(a), Some(a), a, b);
        obs.program_video_pts_state = PtsMonotonicity::NonMonotonic;
        let folded = execution_group_observe_fold(&GroupTickInputs {
            inputs: vec![healthy(a, 110, 88), healthy(b, 100, 80)],
            observation: obs,
            desired: SwitchDesired::ActiveInput(a),
        });
        assert!(!folded.program_alive);
        assert!(
            folded.switch_state.av_paired,
            "AV 平面成对性独立于 PTS 回退"
        );
    }

    /// 03-01-D/E（R45 §11）: 决策输入装配证据规则全锁——
    /// 三列齐备 → 分类（镜像 gh_rt_01 矩阵行）; 任一列缺席 → 不分类
    /// （禁伪造健康/故障臂——media_tap.rs absence≠evidence 契约, 与 gate
    /// L5d 喂入口径差异已在账本披露）; custody 空 → 不归因, 非空 →
    /// attribute_failures（A2-7 冻结语义, 身份不匹配=零归因非无证据）。
    #[test]
    fn r45_decision_input_assembly_evidence_rules() {
        use crate::custody::{FailureObservation, FailureScope, FailureSource};
        use crate::program_execution::FailureDomain;
        let dev = Uuid::new_v4();
        // 三列齐备: input 停进 + 桥活 + program 进 → Input 域（单故障优先序）。
        let (d, _) = assemble_decision_input(dev, Some(false), Some(true), Some(true), &[]);
        assert_eq!(d, Some(FailureDomain::Input));
        // 三列齐备: 全健康 → None 域（分类器明确产出 None 变体, 非缺席）。
        let (d, _) = assemble_decision_input(dev, Some(true), Some(true), Some(true), &[]);
        assert_eq!(d, Some(FailureDomain::None));
        // 桥列缺席 → 不分类（运行时按 absence≠evidence 契约——不伪造健康臂）。
        let (d, _) = assemble_decision_input(dev, Some(false), None, Some(true), &[]);
        assert_eq!(d, None, "证据列缺席 → 不分类");
        let (d, _) = assemble_decision_input(dev, None, Some(true), Some(true), &[]);
        assert_eq!(d, None);
        // custody 空 → 不归因（absence≠evidence）。
        let (_, a) = assemble_decision_input(dev, Some(true), Some(true), Some(true), &[]);
        assert_eq!(a, None, "空 custody 证据 → 不归因");
        // 非空 custody + 本设备 SharedPipeline → 双路归因（A2-7 冻结语义）。
        let failures = [FailureObservation {
            pipeline_id: dev,
            source: FailureSource::PipelineFault,
            scope: FailureScope::SharedPipeline,
        }];
        let (_, a) = assemble_decision_input(dev, Some(false), Some(true), Some(true), &failures);
        let attr = a.expect("非空 custody 证据 → 产出归因结果");
        assert!(
            attr.video_failed && attr.audio_failed,
            "SharedPipeline → 双路"
        );
        // 证据在场但身份不匹配 → 产出零归因结果（与"无证据=None"区分——
        // "证据在场但零归因"是诚实观测, identity correlation 零污染）。
        let other = Uuid::new_v4();
        let (_, a2) = assemble_decision_input(other, Some(true), Some(true), Some(true), &failures);
        let attr2 = a2.expect("custody 证据在场 → 产出归因结果（零归因也是结果）");
        assert!(
            !attr2.video_failed && !attr2.audio_failed,
            "跨设备零污染（identity correlation）"
        );
    }
}

// —— RH-BUS-02: 多输入 Bus 事件消费 / 故障隔离（纯函数; 无硬件可跑 = CI 全矩阵） ——
// 覆盖: 致命 Error/EOS 恰设备归因、ClockLost 只计数不重启、handle 错配拒收、
// Bus 致命 ∪ fold 动作去重（单设备单 tick 单决策 / 独立双致命双决策）。
#[cfg(test)]
mod rh_bus_02_tests {
    use super::*;
    use crate::events::{EventSource, RuntimeEvent, RuntimeEventLog};
    use crate::supervisor::{RestartPolicy, Supervisor, RESTART_ECHO_SUMMARY};
    use std::sync::atomic::Ordering;
    use std::sync::Arc;

    fn bus_evt(handle: u64, kind: PipelineBusEventKind) -> PipelineBusEvent {
        PipelineBusEvent {
            handle: crate::pipeline::PipelineHandle(handle),
            kind,
            source: format!("src-{handle}"),
            timestamp: 0,
            detail: format!("detail-{handle}"),
            severity: crate::pipeline_events::BusSeverity::Error,
        }
    }

    fn pf(pipeline: uuid::Uuid, summary: &str) -> RuntimeEvent {
        RuntimeEvent::PipelineFault {
            pipeline,
            summary: summary.into(),
            retryable: true,
        }
    }

    /// 生产 mapper 路径夹具: Supervisor + 注入 log（ingest ⇒ mapper ⇒ sink ⇒ drain）。
    fn sup_with_log() -> (Supervisor, Arc<RuntimeEventLog>) {
        let log = Arc::new(RuntimeEventLog::new());
        (Supervisor::new(RestartPolicy::default(), log.clone()), log)
    }

    #[test]
    fn rh_bus_02_error_and_eos_map_to_exact_canonical_pipeline_fault() {
        // review fix 硬规则: Error **与** EOS 均经既有 canonical mapper
        // (`sup.ingest` — 与生产薄壳同一函数) ⇒ PipelineFault{pipeline=device}
        // 精确 canonical 设备身份; 不新增事件类型。
        let a = uuid::Uuid::new_v4();
        let b = uuid::Uuid::new_v4();
        let (sup, log) = sup_with_log();
        for kind in [PipelineBusEventKind::Error, PipelineBusEventKind::Eos] {
            let obs = bus_fatal_observation(&bus_evt(1, kind))
                .expect("Error/Eos ⇒ canonical 观测串 (EOS 含 pipeline-error 语义)");
            let _ = sup.ingest(EventSource::Upstream, a, &obs);
        }
        let drained = log.drain();
        assert_eq!(drained.len(), 2, "Error+EOS 各产恰一条 canonical 事件");
        assert!(
            drained.iter().all(|ev| matches!(
                ev,
                RuntimeEvent::PipelineFault { pipeline, retryable: true, .. } if *pipeline == a
            )),
            "两条均为 exact-device PipelineFault (EOS 不再缺规范化)"
        );
        // exact-device: B 的 Error ⇒ pipeline=b, A 零牵连。
        let _ = sup.ingest(
            EventSource::Upstream,
            b,
            &bus_fatal_observation(&bus_evt(2, PipelineBusEventKind::Error)).unwrap(),
        );
        let drained_b = log.drain();
        assert!(matches!(
            &drained_b[0],
            RuntimeEvent::PipelineFault { pipeline, .. } if *pipeline == b
        ));
        // 非致命 kind 不入 mapper 路径（ClockLost 策略不变——不重启）。
        for kind in [
            PipelineBusEventKind::ClockLost,
            PipelineBusEventKind::Warning,
            PipelineBusEventKind::StateChanged,
        ] {
            assert!(bus_fatal_observation(&bus_evt(1, kind)).is_none());
        }
    }

    #[test]
    fn rh_bus_02_canonical_events_drive_only_owning_device() {
        // 组决策候选只从 drained canonical RuntimeEvents 派生: A 的
        // PipelineFault ⇒ 恰 A; B 仅由自身 HardwareFault 驱动; 互不牵连。
        let a = uuid::Uuid::new_v4();
        let b = uuid::Uuid::new_v4();
        let drained_a = vec![pf(a, "pipeline error: unexpected eos: x")];
        let got = canonical_fault_devices_from_events(&drained_a, &[a, b]);
        assert_eq!(got, vec![a], "A 的 canonical 故障 ⇒ 恰 A");
        assert!(!got.contains(&b), "B 零决策 (无跨设备污染)");
        let drained_ab = vec![
            pf(a, "pipeline error: x"),
            RuntimeEvent::HardwareFault {
                device_id: b,
                summary: "device lost".into(),
            },
        ];
        assert_eq!(
            canonical_fault_devices_from_events(&drained_ab, &[a, b]),
            vec![a, b],
            "独立 A+B canonical 故障 ⇒ 各自候选"
        );
    }

    #[test]
    fn rh_bus_02_nil_unrelated_echo_excluded_from_group_candidates() {
        // fail-closed: nil（未归属不扇出全组）、unrelated（非本组设备）、
        // RESTART_ECHO_SUMMARY 自回声（决策回声不再触发决策）、非故障 kind
        // 均不成为组决策候选。
        let a = uuid::Uuid::new_v4();
        let b = uuid::Uuid::new_v4();
        let unrelated = uuid::Uuid::new_v4();
        let drained = vec![
            pf(uuid::Uuid::nil(), "pipeline error: nil"),
            pf(unrelated, "pipeline error: other group"),
            pf(a, RESTART_ECHO_SUMMARY),
            RuntimeEvent::HardwareFault {
                device_id: uuid::Uuid::nil(),
                summary: "device lost".into(),
            },
            RuntimeEvent::SignalVerified {
                device_id: a,
                port_id: None,
            },
            RuntimeEvent::HealthChanged {
                from: "running".into(),
                to: "manual_required".into(),
            },
        ];
        assert!(
            canonical_fault_devices_from_events(&drained, &[a, b]).is_empty(),
            "nil/unrelated/自回声/非故障 kind ⇒ 零组候选"
        );
    }

    #[test]
    fn rh_bus_02_clock_lost_attributed_counted_no_restart() {
        // ClockLost: 归因计数 (CLOCK_LOST_EVENTS) + 健康面记录, 但不产生
        // 重启候选（degraded, P1-4 冻结策略）。
        let mut h = PipelineHealth::default();
        let before = crate::pipeline::CLOCK_LOST_EVENTS.load(Ordering::SeqCst);
        let fatal = fold_bus_events_into_health(
            &crate::pipeline::PipelineHandle(4),
            &mut h,
            &[
                bus_evt(4, PipelineBusEventKind::ClockLost),
                bus_evt(4, PipelineBusEventKind::ClockLost),
            ],
        );
        assert!(!fatal, "ClockLost 非致命 (degraded, 不自动重启)");
        assert_eq!(
            crate::pipeline::CLOCK_LOST_EVENTS.load(Ordering::SeqCst),
            before + 2,
            "降级 metric 如实计数"
        );
        assert_eq!(h.acceptance.c_pipeline_errors, 0);
        assert_eq!(h.acceptance.c_unexpected_eos, 0);
        assert!(union_decision_devices(&[], &[]).is_empty(), "零重启候选");
    }

    #[test]
    fn rh_bus_02_mismatched_handle_rejected_not_reattributed() {
        // handle 错配 fail-closed: B 的事件在 A 的 drain 位被拒收, 绝不重归因。
        let kept = accept_owned_events(
            crate::pipeline::PipelineHandle(1),
            vec![
                bus_evt(2, PipelineBusEventKind::Error),
                bus_evt(1, PipelineBusEventKind::Error),
            ],
        );
        assert_eq!(kept.len(), 1, "错配事件被拒收");
        assert_eq!(kept[0].handle, crate::pipeline::PipelineHandle(1));
    }

    #[test]
    fn rh_bus_02_bus_fatal_and_fold_failure_dedup() {
        // 同设备 canonical Bus 致命 + 既有健康 fold 失败 ⇒ 恰一次决策; 独立
        // A+B 致命 ⇒ 两个设备各自决策（一设备一 tick 至多一次 report_failure）。
        let a = uuid::Uuid::new_v4();
        let b = uuid::Uuid::new_v4();
        let actions = vec![GroupAction::ReportInputFailure {
            device_id: a,
            reason: InputFailureReason::CountersFrozen,
        }];
        let bus_fatal =
            canonical_fault_devices_from_events(&[pf(a, "pipeline error: bus")], &[a, b]);
        assert_eq!(
            union_decision_devices(&actions, &bus_fatal),
            vec![a],
            "canonical Bus 致命 + 冻结计数去重 ⇒ 恰一次决策"
        );
        let bus_fatal_ab = canonical_fault_devices_from_events(
            &[pf(a, "pipeline error: a"), pf(b, "pipeline error: b")],
            &[a, b],
        );
        assert_eq!(
            union_decision_devices(&actions, &bus_fatal_ab),
            vec![a, b],
            "独立 A+B 致命 ⇒ 两个设备各自决策"
        );
    }

    #[test]
    fn rh_bus_02_health_bus_counters_and_acceptance() {
        // 计数/acceptance 与单管线 watchdog 同语义（共享折叠函数锁定）。
        let mut h = PipelineHealth::default();
        let fatal = fold_bus_events_into_health(
            &crate::pipeline::PipelineHandle(3),
            &mut h,
            &[
                bus_evt(3, PipelineBusEventKind::Error),
                bus_evt(3, PipelineBusEventKind::Eos),
                bus_evt(3, PipelineBusEventKind::Warning),
                bus_evt(3, PipelineBusEventKind::StateChanged),
            ],
        );
        assert!(fatal, "批内含 Error/EOS ⇒ 致命");
        assert_eq!(h.bus_event_count, 4);
        assert_eq!(h.acceptance.c_pipeline_errors, 1);
        assert_eq!(h.acceptance.c_unexpected_eos, 1);
        assert!(!h.acceptance.c1_no_unexpected_eos);
        assert!(
            h.acceptance.c2_no_pipeline_error,
            "last_error 未设 ⇒ c2 保持"
        );
    }
}
