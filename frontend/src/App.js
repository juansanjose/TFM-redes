// src/App.js
import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import SshConsole from "./components/SshConsole";
import LabList from "./components/LabList";
import LabNodeConsole from "./components/LabNodeConsole";
import { useAuth } from "./hooks/useAuth";
import { useUsage } from "./hooks/useUsage";
import HomePage from "./pages/HomePage";
import PlanTogglePage from "./pages/PlanTogglePage";
import "./App.css";

// Build a ws/wss root that matches how the app is served
const wsRoot = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

function Nav() {
  const { isAuthenticated, profile, logout, login, isInitializing } = useAuth();
  const { usage } = useUsage({ refreshInterval: 60000 });
  const linkStyle = ({ isActive }) =>
    `top-nav-link ${isActive ? "top-nav-link--active" : ""}`;
  const displayName = profile?.preferred_username ?? profile?.email ?? profile?.name ?? "user";
  const planLabel = usage?.plan === "PREMIUM" ? "Premium" : "Free";

  const formatRemaining = (seconds) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return null;
    if (seconds <= 0) return "0m left";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m left`;
    if (hours > 0) return `${hours}h left`;
    return `${minutes}m left`;
  };

  const remainingLabel = formatRemaining(usage?.remainingSeconds);

  const navLinks = [
    { to: "/", label: "Overview", needsAuth: false },
    { to: "/labs", label: "Lab Catalog", needsAuth: true },
    { to: "/ssh", label: "Live Console", needsAuth: true },
    { to: "/plan", label: "Plan Toggle", needsAuth: true },
  ];
  const visibleLinks = navLinks.filter((link) => (link.needsAuth ? isAuthenticated : true));

  return (
    <header className="top-nav">
      <div className="top-nav-brand">
        <span className="top-nav-name">Bluewire</span>
        <span className="top-nav-tagline">Network Learning Studio</span>
      </div>
      <nav className="top-nav-links" aria-label="Primary navigation">
        {visibleLinks.map(({ to, label }) => (
          <NavLink key={to} to={to} className={linkStyle} end={to === "/"}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="top-nav-actions">
        {isAuthenticated ? (
          <>
            {usage ? (
              <span className={`top-nav-usage plan-${planLabel?.toLowerCase() ?? "free"}`}>
                {planLabel} · {remainingLabel ?? "loading…"}
              </span>
            ) : null}
            <span className="top-nav-user" aria-live="polite">
              {displayName}
            </span>
            <button
              type="button"
              className="top-nav-logout"
              onClick={logout}
              disabled={isInitializing}
            >
              Logout
            </button>
          </>
        ) : (
          <button
            type="button"
            className="top-nav-login"
            onClick={login}
            disabled={isInitializing}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}

function ProtectedRoute({ children }) {
  const { isInitializing, isAuthenticated, login, error } = useAuth();

  if (isInitializing) {
    return <div className="auth-loading">Connecting to Keycloak…</div>;
  }

  if (error) {
    return (
      <div className="auth-loading">
        Unable to reach Keycloak: {error}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="auth-gate">
        <div className="auth-gate-card">
          <h3>Sign in required</h3>
          <p>Access to labs and consoles needs an authenticated session. Continue to Keycloak to sign in.</p>
          <button type="button" onClick={login} className="auth-gate-login">
            Login
          </button>
        </div>
      </section>
    );
  }

  return children;
}

export default function App() {
  return (
    <div className="App">
      <Nav />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Page 1: connects to backend SSH node */}
          <Route
            path="/ssh"
            element={
              <ProtectedRoute>
                <SshConsole wsUrl={`${wsRoot}/ws/sshterm/default`} />
              </ProtectedRoute>
            }
          />

          {/* Dynamic lab overview & nodes */}
          <Route
            path="/labs"
            element={
              <ProtectedRoute>
                <LabList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/labs/:labId/nodes/:nodeId"
            element={
              <ProtectedRoute>
                <LabNodeConsole />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan"
            element={
              <ProtectedRoute>
                <PlanTogglePage />
              </ProtectedRoute>
            }
          />

          {/* Backwards compat: static r1 page */}
          <Route
            path="/r1"
            element={
              <ProtectedRoute>
                <SshConsole wsUrl={`${wsRoot}/ws/sshterm/r1`} />
              </ProtectedRoute>
            }
          />

          {/* Default -> /ssh */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
