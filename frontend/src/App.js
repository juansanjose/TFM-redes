// src/App.js
import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import SshConsole from "./components/SshConsole";
import LabList from "./components/LabList";
import LabNodeConsole from "./components/LabNodeConsole";
import { useAuth } from "./hooks/useAuth";
import "./App.css";

// Build a ws/wss root that matches how the app is served
const wsRoot = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

function Nav() {
  const { isAuthenticated, profile, logout, isInitializing } = useAuth();
  const linkStyle = ({ isActive }) =>
    `px-3 py-2 rounded ${isActive ? "bg-black/10" : "hover:bg-black/5"}`;
  const displayName = profile?.preferred_username ?? profile?.email ?? profile?.name ?? "user";

  return (
    <nav className="app-nav">
      {isAuthenticated ? (
        <>
          <NavLink to="/ssh" className={linkStyle}>SSH Node</NavLink>
          <NavLink to="/labs" className={linkStyle}>Lab Nodes</NavLink>
          <div className="auth-nav">
            <span className="auth-user">Signed in as {displayName}</span>
            <button
              type="button"
              className="auth-logout"
              onClick={logout}
              disabled={isInitializing}
            >
              Logout
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="auth-user">Redirecting to login…</span>
        </>
      )}
    </nav>
  );
}

function ProtectedRoute({ children }) {
  const { isInitializing, isAuthenticated, login, error } = useAuth();

  React.useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      login();
    }
  }, [isInitializing, isAuthenticated, login]);

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
    return <div className="auth-loading">Redirecting to Keycloak…</div>;
  }

  return children;
}

export default function App() {
  return (
    <div className="App app-shell">
      <header className="app-header">
        <h2>SSH Console</h2>
        <small>
          Default SSH: <code>/ws/sshterm/default</code> • Lab node: <code>/ws/sshterm/&lt;node&gt;</code>
        </small>
      </header>

      <Nav />

      <main className="app-main">
        <Routes>
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
          <Route path="*" element={<Navigate to="/labs" replace />} />
        </Routes>
      </main>
    </div>
  );
}
