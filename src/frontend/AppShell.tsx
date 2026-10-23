import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { DEFAULT_BRANDING } from "./lib/types";
import { useAppConfig } from "./hooks/useQueries";
import { useAuth } from "./hooks/useSession";
import { useRealtimeSync } from "./hooks/useWebSocket";
import { LiveJudgingSync } from "./components/LiveJudgingSync";

/**
 * Outer shell — header, hazard strip, operator status bar, tab bar, footer.
 * Pages render into <Outlet />.  The login page opts out visually by
 * receiving `onLoginSurface` context — we just render the shell on every
 * non-login route.
 */
export function AppShell() {
  const { auth, logout } = useAuth();
  const location = useLocation();
  const configQ = useAppConfig();
  const branding = configQ.data?.branding ?? DEFAULT_BRANDING;

  // One WebSocket connection for the whole app — invalidates queries.
  useRealtimeSync();

  useEffect(() => {
    document.title = `${branding.name} // ${branding.title_line}`;
  }, [branding.name, branding.title_line]);

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--color-amber", branding.palette.primary);
    style.setProperty("--color-amber-bright", branding.palette.primary_bright);
    style.setProperty("--color-cyber", branding.palette.accent);
  }, [branding.palette.primary, branding.palette.primary_bright, branding.palette.accent]);

  const isLogin = location.pathname === "/";
  const isLeaderboard = location.pathname === "/leaderboard";
  const presentation = new URLSearchParams(location.search).get("display") === "1";

  // Login page owns its own layout
  if (isLogin) return <Outlet />;

  if (isLeaderboard) return (
    <div className={`standings-shell ${presentation ? "standings-shell--display" : ""}`}>
      {auth.status === "judge" && !presentation && <LiveJudgingSync />}
      <header className="standings-brandbar">
        <div className="flex flex-wrap items-center gap-3">
          <span className="wordmark" style={{ fontSize: 30 }}>{branding.name}</span>
          <span className="standings-caption">{branding.title_line}</span>
        </div>
        {!presentation && <nav aria-label="Display controls" className="standings-controls">
          {auth.status === "admin" && <NavLink to="/admin">Admin console</NavLink>}
          {auth.status === "judge" && <NavLink to="/judge">Live judging</NavLink>}
          {auth.status === "anon" && <NavLink to="/">Judge sign in</NavLink>}
          <a href="/leaderboard?display=1" target="_blank" rel="noreferrer">Presentation view ↗</a>
        </nav>}
      </header>
      <main><Outlet /></main>
      <footer className="standings-footer">{branding.footer} · {branding.tagline}</footer>
    </div>
  );

  if (location.pathname === "/judge" && auth.status === "judge") return (
    <div className="judge-shell">
      <LiveJudgingSync />
      <header className="judge-header">
        <div className="judge-brand-row">
          <div><span className="wordmark" style={{ fontSize: 28 }}>{branding.name}</span><p>{branding.title_line}</p></div>
          <button onClick={logout} className="btn-secondary">Log Out</button>
        </div>
        <nav aria-label="Judge navigation" className="judge-nav">
          <NavLink to="/judge" onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}>Submissions</NavLink>
          <NavLink to="/leaderboard">Standings</NavLink>
          <a href="#judge-guide">Judge guide</a>
        </nav>
        <p className="judge-identity">Judging as {auth.judge.name}</p>
      </header>
      <main><Outlet /></main>
      <footer className="standings-footer">{branding.footer}</footer>
    </div>
  );

  return (
    <div className="mx-auto w-full px-4 sm:px-6 pb-16 pt-8" style={{ maxWidth: 960 }}>
      {auth.status === "judge" && <LiveJudgingSync />}
      {/* Header */}
      <header className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="serial">◼ Demo Day // Judging Panel</span>
          <span className="serial">
            {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        </div>

        <div className="grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, var(--color-border-strong))" }} />
          <h1
            className="wordmark"
            style={{ fontSize: "clamp(2rem, 9vw, 5rem)", whiteSpace: "nowrap", margin: 0 }}
          >
            {branding.name}
          </h1>
          <div style={{ height: 2, background: "linear-gradient(90deg, var(--color-border-strong), transparent)" }} />
        </div>

        <p
          className="stencil text-center mt-2"
          style={{ fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.28em" }}
        >
          {branding.title_line}
        </p>
      </header>

      <div className="hazard-stripes mb-6" style={{ height: 4, borderRadius: 1 }} />

      {/* Operator status bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-6"
        style={{
          background: "linear-gradient(180deg, var(--color-steel-raised) 0%, var(--color-steel) 100%)",
          border: "1px solid var(--color-border-strong)",
          boxShadow: "inset 0 1px 0 rgba(239,231,214,0.04), inset 0 -1px 0 rgba(0,0,0,0.5)",
          borderRadius: 2,
        }}
      >
        <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 11 }}>
          {auth.status === "judge" && (
            <>
              <span className="serial-plate serial-plate--cyber"><span className="dot" />Judge</span>
              <span className="stencil" style={{ color: "var(--color-bone)", fontSize: 16, letterSpacing: "0.04em" }}>
                {auth.judge.name}
              </span>
            </>
          )}
          {auth.status === "admin" && (
            <>
              <span className="serial-plate" style={{ color: "var(--color-rust)", borderColor: "rgba(210,64,30,0.45)" }}>
                <span className="dot" style={{ background: "var(--color-rust)", boxShadow: "0 0 6px var(--glow-rust)" }} />
                Admin Console
              </span>
              <span className="serial">root access enabled</span>
            </>
          )}
          {auth.status === "anon" && (
            <>
              <span className="serial-plate"><span className="dot" />Public View</span>
              <span className="serial">standings // read-only</span>
            </>
          )}
        </div>
        {auth.status !== "anon" ? (
          <button onClick={logout} className="btn-danger">Log Out</button>
        ) : (
          <NavLink to="/" className="btn-secondary" style={{ textDecoration: "none" }}>
            Sign In
          </NavLink>
        )}
      </div>

      {/* Tab bar */}
      <nav
        className="inline-flex mb-6"
        style={{
          gap: 2,
          padding: 2,
          background: "var(--color-ink)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 2,
        }}
      >
        {auth.status === "judge" && <TabLink to="/judge" label="Live Judging" />}
        {auth.status === "admin" && <TabLink to="/admin" label="Admin" />}
        <TabLink to="/leaderboard" label="Leaderboard" />
      </nav>

      <Outlet />

      <footer className="mt-16">
        <div className="hazard-stripes mb-4" style={{ height: 3, borderRadius: 1, opacity: 0.6 }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="serial">◼ {branding.footer}</span>
          <span className="serial">Rebuilding System Density // Fort Worth, TX</span>
        </div>
      </footer>
    </div>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.24em",
        padding: "10px 20px",
        border: "none",
        borderRadius: 1,
        cursor: "pointer",
        textDecoration: "none",
        color: isActive ? "var(--color-void)" : "var(--color-text-secondary)",
        background: isActive
          ? "linear-gradient(180deg, var(--color-amber-bright) 0%, var(--color-amber) 100%)"
          : "transparent",
        boxShadow: isActive
          ? "inset 0 1px 0 rgba(255,255,255,0.3), 0 0 12px var(--glow-amber)"
          : "none",
        transition: "color 0.2s, background 0.2s",
      })}
    >
      {label}
    </NavLink>
  );
}
