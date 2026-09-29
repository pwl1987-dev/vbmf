import type * as React from "react";
import { useState } from "react";
import { assertNoPersistentStorage, setApiKey } from "../auth/credentials.ts";

interface Props {
  onAuthenticated(): void;
}

/**
 * Operator credential bootstrap (WCE-01B · §5)。
 * - 仅在运行时内存；reload = 清空（UI 必须显式回到这里）；
 * - 不写 URL / log / telemetry；
 * - 不持久化到 localStorage / sessionStorage（assertNoPersistentStorage 自检）。
 */
export function CredentialGate(props: Props): React.JSX.Element {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      assertNoPersistentStorage();
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setError("API key required");
        return;
      }
      setApiKey(trimmed);
      props.onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="main" style={{ maxWidth: 480, margin: "80px auto" }}>
      <div className="panel">
        <h2>Operator credential required</h2>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          VBMF Web Console observes and commands the Runtime. Enter the operator API key
          provisioned for this control plane.
        </p>
        <div className="credential-banner">
          Credential is held in memory only. It will be cleared on page reload.
        </div>
        <form onSubmit={onSubmit}>
          <input
            className="credential"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="vbmf_…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="primary" type="submit" disabled={submitting}>
              Authenticate
            </button>
          </div>
        </form>
        {error !== null ? <div className="error-banner">{error}</div> : null}
      </div>
    </div>
  );
}
