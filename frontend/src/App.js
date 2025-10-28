// src/App.js
import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import GuacConsole from "./components/GuacConsole";
import LabList from "./components/LabList";
import LabNodeConsole from "./components/LabNodeConsole";
import "./App.css";

// Build a ws/wss root that matches how the app is served
const wsRoot = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

function Nav() {
  const linkStyle = ({ isActive }) =>
    `px-3 py-2 rounded ${isActive ? "bg-black/10" : "hover:bg-black/5"}`;
  return (
    <nav className="app-nav">
      <NavLink to="/ssh" className={linkStyle}>SSH Node</NavLink>
      <NavLink to="/labs" className={linkStyle}>Lab Nodes</NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <div className="App app-shell">
      <header className="app-header">
        <h2>Guacamole Console</h2>
        <small>
          Default SSH: <code>/ws/tunnel</code> • Lab node: <code>/ws/cont/&lt;lab-node&gt;</code>
        </small>
      </header>

      <Nav />

      <main className="app-main">
        <Routes>
          {/* Page 1: connects to backend SSH node */}
          <Route
            path="/ssh"
            element={<GuacConsole wsUrl={`${wsRoot}/ws/tunnel`} />}
          />

          {/* Dynamic lab overview & nodes */}
          <Route path="/labs" element={<LabList />} />
          <Route path="/labs/:labId/nodes/:nodeId" element={<LabNodeConsole />} />

          {/* Backwards compat: static r1 page */}
          <Route
            path="/r1"
            element={<GuacConsole wsUrl={`${wsRoot}/ws/cont/r1`} />}
          />

          {/* Default -> /ssh */}
          <Route path="*" element={<Navigate to="/labs" replace />} />
        </Routes>
      </main>
    </div>
  );
}
