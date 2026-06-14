import { useState, type CSSProperties } from "react";
import { Button, Input } from "../components";
import { login } from "../api/planner";
import type { UserOut } from "../types/models";

export function Login({ t, onLogin }: { t: (k: string) => string; onLogin: (u: UserOut) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const tok = await login(username.trim(), password);
      onLogin(tok.user);
    } catch {
      setError("Invalid username or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <form
        style={card}
        onSubmit={(e) => {
          e.preventDefault();
          if (username && password) void submit();
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <svg width={30} height={30} viewBox="0 0 40 40" fill="none" aria-hidden>
            <polygon points="20,2 34,10 34,26 20,34 6,26 6,10" fill="#0F2540" />
            <polygon points="20,7 30,13 30,23 20,29 10,23 10,13" fill="#1B3A5C" />
            <path d="M20 12 C20 12 13 19 20 28 C27 19 20 12 20 12Z" fill="#C9A227" opacity={0.95} />
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{t("app_name")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>GrowFlow</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={t("username")} value={username} onChange={setUsername} />
          <Input label={t("password")} value={password} onChange={setPassword} type="password" />
          {error && <div style={errBox}>{error}</div>}
          <Button variant="primary" size="lg" fullWidth disabled={busy || !username || !password}>
            {t("sign_in")}
          </Button>
        </div>
      </form>
    </div>
  );
}

const wrap: CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-app)", padding: 24 };
const card: CSSProperties = { width: 340, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-md, 0 4px 20px rgba(15,37,64,0.08))" };
const errBox: CSSProperties = { fontSize: 12, color: "var(--status-fail)", background: "var(--status-fail-bg)", border: "1px solid var(--status-fail-border)", borderRadius: "var(--radius-md)", padding: "6px 10px" };
