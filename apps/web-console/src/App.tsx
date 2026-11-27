import type * as React from "react";
import { useState, useSyncExternalStore } from "react";
import { CredentialGate } from "./components/CredentialGate.tsx";
import { isDevNoAuth } from "./auth/devNoAuth.ts";
import { LocaleToggle } from "./i18n/LocaleToggle.tsx";
import { getLocale, subscribeLocale, t } from "./i18n/index.ts";
import { HealthPage } from "./pages/HealthPage.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { SourcesPage } from "./pages/SourcesPage.tsx";
import { RuntimePage } from "./pages/RuntimePage.tsx";
import { SessionsPage } from "./pages/SessionsPage.tsx";
import { EventsPage } from "./pages/EventsPage.tsx";
import { AlarmsPage } from "./pages/AlarmsPage.tsx";

type PageId = "dashboard" | "sources" | "health" | "runtime" | "sessions" | "events" | "alarms";

export function App(): React.JSX.Element {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  // dev-only：VITE_DEV_NO_AUTH=1 时跳过凭据门（凭据由 dev proxy 在服务端注入，浏览器不持有）。
  // 生产构建 import.meta.env.DEV=false ⇒ 凭据门始终强制（见 auth/devNoAuth.ts）。
  const [authed, setAuthed] = useState(isDevNoAuth());
  const [page, setPage] = useState<PageId>("dashboard");

  if (!authed) {
    return <CredentialGate onAuthenticated={() => setAuthed(true)} />;
  }

  return (
    <div className="app" key={locale}>
      <aside className="sidebar">
        <h1>{t("app.title")}</h1>
        <nav>
          <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>
            {t("nav.dashboard")}
          </button>
          <button className={page === "sources" ? "active" : ""} onClick={() => setPage("sources")}>
            {t("nav.sources")}
          </button>
          <button className={page === "health" ? "active" : ""} onClick={() => setPage("health")}>
            {t("nav.health")}
          </button>
          <button className={page === "runtime" ? "active" : ""} onClick={() => setPage("runtime")}>
            {t("nav.runtime")}
          </button>
          <button className={page === "sessions" ? "active" : ""} onClick={() => setPage("sessions")}>
            {t("nav.sessions")}
          </button>
          <button className={page === "events" ? "active" : ""} onClick={() => setPage("events")}>
            {t("nav.events")}
          </button>
          <button className={page === "alarms" ? "active" : ""} onClick={() => setPage("alarms")}>
            {t("nav.alarms")}
          </button>
        </nav>
        <div className="sidebar-locale">
          <LocaleToggle />
        </div>
        <div className="meta">
          {t("app.build")}
          <br />
          {t("app.operator")}
        </div>
      </aside>
      <main className="main">
        {page === "dashboard" ? <DashboardPage /> : null}
        {page === "sources" ? <SourcesPage /> : null}
        {page === "health" ? <HealthPage /> : null}
        {page === "runtime" ? <RuntimePage /> : null}
        {page === "sessions" ? <SessionsPage /> : null}
        {page === "events" ? <EventsPage /> : null}
        {page === "alarms" ? <AlarmsPage /> : null}
      </main>
    </div>
  );
}
