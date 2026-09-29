import type * as React from "react";
import { useState } from "react";
import { CredentialGate } from "./components/CredentialGate.tsx";
import { HealthPage } from "./pages/HealthPage.tsx";
import { RuntimePage } from "./pages/RuntimePage.tsx";
import { SessionsPage } from "./pages/SessionsPage.tsx";
import { EventsPage } from "./pages/EventsPage.tsx";
import { AlarmsPage } from "./pages/AlarmsPage.tsx";

type PageId = "health" | "runtime" | "sessions" | "events" | "alarms";

export function App(): React.JSX.Element {
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState<PageId>("health");

  if (!authed) {
    return <CredentialGate onAuthenticated={() => setAuthed(true)} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>VBMF Web Console</h1>
        <nav>
          <button className={page === "health" ? "active" : ""} onClick={() => setPage("health")}>
            Health
          </button>
          <button className={page === "runtime" ? "active" : ""} onClick={() => setPage("runtime")}>
            Runtime
          </button>
          <button className={page === "sessions" ? "active" : ""} onClick={() => setPage("sessions")}>
            Sessions
          </button>
          <button className={page === "events" ? "active" : ""} onClick={() => setPage("events")}>
            Events
          </button>
          <button className={page === "alarms" ? "active" : ""} onClick={() => setPage("alarms")}>
            Alarms
          </button>
        </nav>
        <div className="meta">
          Build: dev
          <br />
          Operator: configured
        </div>
      </aside>
      <main className="main">
        {page === "health" ? <HealthPage /> : null}
        {page === "runtime" ? <RuntimePage /> : null}
        {page === "sessions" ? <SessionsPage /> : null}
        {page === "events" ? <EventsPage /> : null}
        {page === "alarms" ? <AlarmsPage /> : null}
      </main>
    </div>
  );
}
