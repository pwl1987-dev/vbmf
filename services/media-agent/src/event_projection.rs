//! Phase 0.7C-6: Event Projection Foundation — **Runtime→Event→Projection 第一条生产边**。
//!
//! 设计原则（终审 0.7C-5 Gate 裁定 + probe 报告 Q4 四语义基线）:
//! - `project()` 是**纯函数**: 只读事件切片 → 只读快照; 零副作用、确定性、
//!   绝不写回 Runtime (**Observation ≠ Configuration** 红线);
//! - `EventProjection` 字段仅由消费语义需要驱动 (组合非展开, **禁万能 struct**);
//! - 四语义零偷改: 顺序 (投影序=发射序 FIFO) / 丢失 (两级丢弃+计数在 log,
//!   投影只反映 drain 所见, 不伪造) / 重复 (双发容忍, 投影不崩) /
//!   projection failure (纯函数无 panic 路径, 消费失败不影响事件流);
//! - **Event Projection (内部架构边界) ≠ External API (外部契约边界)** —
//!   本模块不提供任何 transport/RPC 面。
//!
//! 红线延续: 零 vendor 依赖; 事件词表 14 变体封闭零改动。

#![allow(dead_code)]

use std::collections::BTreeMap;

use crate::events::RuntimeEvent;

/// 事件流只读投影快照。
///
/// 字段依据 (design.md §3.1): total/kind_counts 验证顺序与完整性;
/// session_states 验证最新态投影; session_failures 验证失败汇聚;
/// has_critical 验证故障可见。BTreeMap 保证投影确定性 (同输入同输出);
/// session_id 以 canonical UUID 字符串为键 (serde 友好, 稳定序)。
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct EventProjection {
    /// 投影输入事件总数。
    pub total: usize,
    /// 各事件 kind 计数 (canonical kind 字符串, 与 serde tag 一致)。
    pub kind_counts: BTreeMap<String, usize>,
    /// 每会话最新状态 (session_id → 最后一条 SessionStateChanged 的 to)。
    pub session_states: BTreeMap<String, String>,
    /// 每会话 SessionFailed 计数。
    pub session_failures: BTreeMap<String, usize>,
    /// 输入中存在过故障类事件 (`RuntimeEvent::is_fault()`)。
    pub has_critical: bool,
    /// 故障类事件摘要 (HEALTH-INCIDENT-ENTRY-01 D1 修正: additive wire 扩展)。
    /// 字段照抄 RuntimeEvent canonical 载荷 (无翻译/无归并); 顺序 = 事件序。
    /// 仅 fault 词表 (`is_fault()`): pipeline_fault / hardware_fault /
    /// ambiguous_identity / session_failed。观测类事件不入此块。
    pub faults: Vec<FaultDigest>,
}

/// 故障类事件的 canonical 摘要 (wire 投影, 供控制面 Alarm 派生; 非 Runtime truth)。
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct FaultDigest {
    /// canonical kind 字符串 (与 RuntimeEvent serde tag 一致)。
    pub kind: String,
    /// related device (hardware_fault / ambiguous_identity)。
    pub device_id: Option<String>,
    /// related pipeline (pipeline_fault)。
    pub pipeline: Option<String>,
    /// related session (session_failed)。
    pub session_id: Option<String>,
    /// 故障摘要/原因原文 (canonical 字符串, vendor 细节已在映射时消化)。
    pub summary: String,
    /// 可重试标志 (pipeline_fault 携带; 其余 fault kind 无此语义)。
    pub retryable: Option<bool>,
}

/// 纯函数: 事件切片 → 投影。不改事件流、无副作用 (消费侧行为, drain 之后调用)。
pub fn project(events: &[RuntimeEvent]) -> EventProjection {
    let mut p = EventProjection {
        total: events.len(),
        ..Default::default()
    };
    for ev in events {
        let kind = ev.kind().to_string();
        *p.kind_counts.entry(kind.clone()).or_insert(0) += 1;
        if ev.is_fault() {
            p.has_critical = true;
            p.faults.push(fault_digest(ev, kind));
        }
        match ev {
            RuntimeEvent::SessionStateChanged { session_id, to, .. } => {
                p.session_states.insert(session_id.to_string(), to.clone());
            }
            RuntimeEvent::SessionFailed { session_id, .. } => {
                *p.session_failures
                    .entry(session_id.to_string())
                    .or_insert(0) += 1;
            }
            _ => {}
        }
    }
    p
}

/// fault 词表事件 → FaultDigest (字段照抄; 非词表事件不可达——`project` 只对
/// `is_fault()` 事件调用本函数)。
fn fault_digest(ev: &RuntimeEvent, kind: String) -> FaultDigest {
    match ev {
        RuntimeEvent::PipelineFault {
            pipeline,
            summary,
            retryable,
        } => FaultDigest {
            kind,
            device_id: None,
            pipeline: Some(pipeline.to_string()),
            session_id: None,
            summary: summary.clone(),
            retryable: Some(*retryable),
        },
        RuntimeEvent::HardwareFault { device_id, summary } => FaultDigest {
            kind,
            device_id: Some(device_id.to_string()),
            pipeline: None,
            session_id: None,
            summary: summary.clone(),
            retryable: None,
        },
        RuntimeEvent::AmbiguousIdentity {
            device_id,
            candidates,
        } => FaultDigest {
            kind,
            device_id: Some(device_id.to_string()),
            pipeline: None,
            session_id: None,
            summary: format!("ambiguous identity: {} candidates", candidates.len()),
            retryable: None,
        },
        RuntimeEvent::SessionFailed { session_id, reason } => FaultDigest {
            kind,
            device_id: None,
            pipeline: None,
            session_id: Some(session_id.to_string()),
            summary: reason.clone(),
            retryable: None,
        },
        // 非词表事件: project() 只对 is_fault() 事件折叠 faults——不可达。
        // 返回带原始 kind 的占位摘要 (防御性, 不 panic)。
        _ => FaultDigest {
            kind,
            device_id: None,
            pipeline: None,
            session_id: None,
            summary: String::new(),
            retryable: None,
        },
    }
}

#[cfg(all(test, feature = "mock"))]
mod tests {
    use super::*;
    use crate::events::{RuntimeEventLog, RuntimeEventSink};
    use crate::session::SessionManager;
    use std::sync::{Arc, Mutex};
    use uuid::Uuid;

    fn ev_state_changed(session: Uuid, to: &str) -> RuntimeEvent {
        RuntimeEvent::SessionStateChanged {
            session_id: session,
            from: "Starting".into(),
            to: to.into(),
        }
    }

    fn ev_failed(session: Uuid) -> RuntimeEvent {
        RuntimeEvent::SessionFailed {
            session_id: session,
            reason: "materialize failed".into(),
        }
    }

    /// **词表零改动回归** — 14 变体 kind() 词表 (解耦与投影不碰词表);
    /// 投影 kind_counts 键域 ⊆ 词表。
    #[test]
    fn evt_proj_rt_01_vocabulary_snapshot() {
        let kinds = [
            "identity_resolved",
            "source_materialized",
            "signal_verified",
            "loopback_verified",
            "lease_granted",
            "resource_allocated",
            "resource_reservation_expired",
            "pipeline_fault",
            "hardware_fault",
            "health_changed",
            "ambiguous_identity",
            "session_created",
            "session_state_changed",
            "session_failed",
        ];
        assert_eq!(kinds.len(), 14);
        let ev = ev_state_changed(Uuid::nil(), "Running");
        let p = project(&[ev]);
        assert!(kinds.contains(&p.kind_counts.keys().next().unwrap().as_str()));
    }

    /// **顺序 + 纯度** — 投影序=输入序 (FIFO 语义: 最新态最后生效);
    /// 同输入两次投影相等; 零副作用。
    #[test]
    fn evt_proj_rt_01_project_is_pure_and_fifo() {
        let s1 = Uuid::new_v4();
        let s2 = Uuid::new_v4();
        let events = vec![
            ev_state_changed(s1, "Running"),
            RuntimeEvent::PipelineFault {
                pipeline: Uuid::nil(),
                summary: "bus error".into(),
                retryable: true,
            },
            ev_state_changed(s1, "Released"),
            ev_failed(s2),
        ];
        let p1 = project(&events);
        let p2 = project(&events);
        assert_eq!(p1, p2, "纯函数: 同输入同输出");
        assert_eq!(p1.total, 4);
        // FIFO: s1 最新态是最后一次迁移 (Released), 不是第一次 (Running)。
        assert_eq!(p1.session_states.get(&s1.to_string()).unwrap(), "Released");
        // kind 计数精确。
        assert_eq!(p1.kind_counts.get("session_state_changed"), Some(&2));
        assert_eq!(p1.kind_counts.get("pipeline_fault"), Some(&1));
        assert_eq!(p1.kind_counts.get("session_failed"), Some(&1));
        // 汇聚: 失败计数按 session。
        assert_eq!(p1.session_failures.get(&s2.to_string()), Some(&1));
        // 故障可见 (PipelineFault 为 fault 类)。
        assert!(p1.has_critical);
        // 零副作用: 输入切片仍完整可用 (借用语义 + 未被消费)。
        assert_eq!(events.len(), 4);
    }

    /// **HEALTH-INCIDENT-ENTRY-01 D1** — faults 摘要块: 仅 fault 词表入块,
    /// 字段照抄 canonical 载荷 (kind/related/retryable), 顺序 = 事件序,
    /// 观测类事件不入块; ApiProjectionResponse 透传 (additive wire)。
    #[test]
    fn evt_proj_hi01_faults_digest_additive() {
        let s1 = Uuid::new_v4();
        let dev = Uuid::new_v4();
        let pipe = Uuid::new_v4();
        let events = vec![
            ev_state_changed(s1, "Running"),
            RuntimeEvent::PipelineFault {
                pipeline: pipe,
                summary: "bus error".into(),
                retryable: true,
            },
            RuntimeEvent::HardwareFault {
                device_id: dev,
                summary: "decklink lost".into(),
            },
            RuntimeEvent::AmbiguousIdentity {
                device_id: dev,
                candidates: vec!["a".into(), "b".into()],
            },
            ev_failed(s1),
        ];
        let p = project(&events);
        assert_eq!(p.faults.len(), 4, "仅 fault 词表入块; state_changed 不入");
        assert_eq!(p.faults[0].kind, "pipeline_fault");
        assert_eq!(
            p.faults[0].pipeline.as_deref(),
            Some(pipe.to_string().as_str())
        );
        assert_eq!(p.faults[0].device_id, None);
        assert_eq!(p.faults[0].summary, "bus error");
        assert_eq!(p.faults[0].retryable, Some(true));
        assert_eq!(p.faults[1].kind, "hardware_fault");
        assert_eq!(
            p.faults[1].device_id.as_deref(),
            Some(dev.to_string().as_str())
        );
        assert_eq!(
            p.faults[1].retryable, None,
            "hardware fault 无 retryable 语义"
        );
        assert_eq!(p.faults[2].kind, "ambiguous_identity");
        assert_eq!(
            p.faults[2].device_id.as_deref(),
            Some(dev.to_string().as_str())
        );
        assert_eq!(p.faults[3].kind, "session_failed");
        assert_eq!(
            p.faults[3].session_id.as_deref(),
            Some(s1.to_string().as_str())
        );
        // wire 透传 + 旧载荷兼容 (serde default → 空 faults)。
        let api = crate::api_boundary::ApiProjectionResponse::from(&p);
        assert_eq!(api.faults, p.faults);
        let legacy = serde_json::json!({
            "snapshot_kind": "event_projection_snapshot",
            "total": 1,
            "kind_counts": {},
            "session_states": {},
            "session_failures": {},
            "has_critical": false
        });
        let decoded: crate::api_boundary::ApiProjectionResponse =
            serde_json::from_value(legacy).expect("旧载荷 (无 faults 字段) 必须可解码");
        assert!(decoded.faults.is_empty());
    }

    /// **丢失语义** — log 满时两级丢弃行为不变; 投影只反映 drain 所见,
    /// drop 计数在 log 上 (不伪造进投影)。
    #[test]
    fn evt_proj_rt_01_loss_semantics_visible() {
        let log = Arc::new(RuntimeEventLog::with_capacity(2));
        let sink: Arc<dyn RuntimeEventSink> = log.clone();
        sink.emit(ev_state_changed(Uuid::new_v4(), "Running"));
        sink.emit(ev_state_changed(Uuid::new_v4(), "Released"));
        sink.emit(ev_state_changed(Uuid::new_v4(), "Running"));
        let dropped = log.dropped_observations();
        let drained = log.drain();
        assert_eq!(drained.len(), 2, "有界: 最旧被挤出");
        // 既有两级策略语义: Observation 被挤出时不计数 (计数器只记"全 Critical 拒收");
        // 此处断言锁定该既有行为 — 若演进为"挤出不静默"须同步改 events.rs 契约。
        assert_eq!(dropped, 0, "挤出属正常容量行为, 非拒收 (既有语义)");
        let p = project(&drained);
        assert_eq!(p.total, 2, "投影 total = drain 所见, 不含被丢事件");
        assert_eq!(p.kind_counts.get("session_state_changed"), Some(&2));
    }

    /// **重复容忍** — 同事件双发: 计数 ×3, 投影状态一致不崩 (事件≠命令, 无去重)。
    #[test]
    fn evt_proj_rt_01_duplicate_tolerant() {
        let s = Uuid::new_v4();
        let e = ev_state_changed(s, "Running");
        let p = project(&[e.clone(), e, ev_state_changed(s, "Running")]);
        assert_eq!(p.total, 3);
        assert_eq!(p.kind_counts.get("session_state_changed"), Some(&3));
        assert_eq!(p.session_states.get(&s.to_string()).unwrap(), "Running");
    }

    /// **failure 隔离** — drain 后投影: 事件流已空不受影响;
    /// project 无 panic 路径 (纯函数, 空切片得 Default)。
    #[test]
    fn evt_proj_rt_01_projection_failure_isolation() {
        let log = Arc::new(RuntimeEventLog::new());
        let sink: Arc<dyn RuntimeEventSink> = log.clone();
        let s = Uuid::new_v4();
        sink.emit(ev_failed(s));
        let drained = log.drain();
        assert_eq!(drained.len(), 1);
        let p = project(&drained);
        assert_eq!(p.session_failures.get(&s.to_string()), Some(&1));
        // drain 后再投影空流: 事件流不受消费影响。
        assert!(log.drain().is_empty());
        assert_eq!(project(&[]), EventProjection::default());
    }

    /// **D8 解耦 Simulation** — SessionManager + Supervisor 双生产者, 组合根
    /// 单表汇聚: 两类事件按发射序全量落表; SessionManager 不再穿 Supervisor。
    #[test]
    fn evt_proj_rt_01_decoupled_single_table() {
        use crate::adapters::mock::{MockBackend, MockProvider};
        use crate::contracts::provider::HardwareProvider as _;
        use crate::lease::InMemoryLeaseManager;
        use crate::port::*;
        use crate::supervisor::{RestartPolicy, Supervisor};

        let log = Arc::new(RuntimeEventLog::new());
        let devices: Vec<crate::device::DeviceInfo> = MockProvider
            .discover()
            .expect("mock discover")
            .into_iter()
            .map(|d| d.device)
            .collect();
        let pid = PortIdentity::derive(
            &devices[0].device_id,
            ConnectorType::Sdi,
            PortOrdinal::Known(1),
        );
        let registry = PortRegistry {
            ports: vec![PortInfo {
                device_id: devices[0].device_id,
                provider_binding_ref: None,
                identity: PortIdentity {
                    port_id: pid,
                    connector: ConnectorType::Sdi,
                    ordinal: PortOrdinal::Known(1),
                },
                direction: PortDirection::Input,
                capabilities: PortCapabilities::default(),
                runtime_binding: None,
                signal: SignalStatus::default(),
                content: VideoContentState::Unknown,
            }],
        };
        let sup = Arc::new(Mutex::new(Supervisor::new(
            RestartPolicy::default(),
            log.clone() as Arc<dyn RuntimeEventSink>,
        )));
        let mgr = SessionManager::new(
            crate::resource::SharedResourceRegistry::new(
                crate::resource::ResourceRegistry::derive_from_discovery(&registry),
            ),
            Arc::new(InMemoryLeaseManager::new()),
            sup.clone(),
            Arc::new(MockBackend),
            Arc::new(devices),
            Arc::new(std::collections::HashMap::new()),
            None,
            Some(registry),
            crate::pipeline::MaterializeMode::Diagnostic,
            crate::session::SessionTuning::default(),
            log.clone() as Arc<dyn RuntimeEventSink>,
        );
        // 交替发射: session create → supervisor 决策 → session start 迁移。
        let dev = mgr.runtime_state().devices[0].device_id;
        let sid = mgr
            .create(crate::graph_intent::GraphRuntimeIntent {
                version: "1.0".into(),
                devices: vec![crate::graph_intent::DeviceIntent {
                    device_id: dev.to_string(),
                    role: "CAPTURE".into(),
                    pipeline: crate::graph_intent::PipelineIntent {
                        source: crate::graph_intent::SourceIntent::decklink(dev.to_string(), None),
                        sink: crate::graph_intent::SinkIntent {
                            kind: "appsink".into(),
                        },
                    },
                }],
            })
            .expect("create");
        sup.lock().unwrap().register(sid.0);
        let _ = sup.lock().unwrap().report_failure(&sid.0, None, None);
        let _ = mgr.start(&sid);
        let drained = log.drain();
        let kinds: Vec<&str> = drained.iter().map(|e| e.kind()).collect();
        // 发射序保持 (全局 FIFO 跨生产者): create 事件 < supervisor fault <
        // 其后的 start 相位迁移 (create 内部先发相位迁移再发 created — 取
        // fault 之后存在 state_changed 表达 start 迁移在 fault 之后)。
        let created = kinds
            .iter()
            .position(|k| *k == "session_created")
            .expect("create 事件应已发射");
        let fault = kinds
            .iter()
            .position(|k| *k == "pipeline_fault")
            .expect("supervisor 决策事件应进同一张表");
        let migrated_after_fault = kinds
            .iter()
            .enumerate()
            .any(|(i, k)| i > fault && *k == "session_state_changed");
        assert!(
            created < fault && migrated_after_fault,
            "全局 FIFO 跨生产者保持: {kinds:?}"
        );
        // 投影消费。
        let p = project(&drained);
        assert!(p.total >= 3);
        assert!(p.has_critical, "supervisor PipelineFault 为故障类");
        assert!(
            p.session_states
                .values()
                .any(|s| s == "running" || s == "starting"),
            "投影含 start 迁移态 (canonical 小写相位)"
        );
    }
}
