import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { DEFAULT_BRANDING } from "./lib/types";
import { useAppConfig } from "./hooks/useQueries";
import { useAuth } from "./hooks/useSession";
import { useRealtimeSync } from "./hooks/useWebSocket";

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

  const isLogin = location.pathname === "/";

  // Login page owns its own layout
  if (isLogin) return <Outlet />;

  return (
    <div className="mx-auto w-full px-4 sm:px-6 pb-16 pt-8" style={{ maxWidth: 960 }}>
      {/* Header */}
      <header className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="serial">◼ Operations Terminal // Rev 2026.04</span>
          <span className="serial">
            {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        </div>

        <div className="grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, var(--color-border-strong))" }} />
          <h1
            className="wordmark"
            style={{ fontSize: "clamp(3.5rem, 11vw, 6rem)", whiteSpace: "nowrap", margin: 0 }}
          >
            {branding.name.toUpperCase()}
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
        {auth.status === "judge" && <TabLink to="/judge" label="Score" />}
        {auth.status === "admin" && <TabLink to="/admin" label="Admin" />}
        <TabLink to="/leaderboard" label="Leaderboard" />
      </nav>

      <Outlet />

      <footer className="mt-16">
        <div className="hazard-stripes mb-4" style={{ height: 3, borderRadius: 1, opacity: 0.6 }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="serial">◼ {branding.footer}</span>
          <span className="serial">Plant No. 01 // Fort Worth, TX</span>
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
