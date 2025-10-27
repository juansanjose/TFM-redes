// src/App.js
import React, { useRef, useState, useEffect } from "react";
import Guacamole from "guacamole-client";
import "./App.css";

export default function App() {
  const displayHostRef = useRef(null);
  const displayElRef = useRef(null);
  const clientRef = useRef(null);
  const tunnelRef = useRef(null);
  const keyboardRef = useRef(null);

  const [status, setStatus] = useState("disconnected");
  const [wsUrl, setWsUrl] = useState("");

  const defaultWs = (() => {
    const { protocol, host } = window.location;
    const wsProto = protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${host}/ws/tunnel`;
  })();
  const [tunnelEndpoint, setTunnelEndpoint] = useState(defaultWs);

  // keep remote size in sync
  useEffect(() => {
    function sendSize() {
      const client = clientRef.current;
      const el = displayElRef.current;
      if (!client || !el) return;
      const r = el.getBoundingClientRect();
      client.sendSize(Math.floor(r.width), Math.floor(r.height));
    }
    window.addEventListener("resize", sendSize);
    const onVis = () => { if (document.hidden) keyboardRef.current?.reset(); };
    const onBlur = () => keyboardRef.current?.reset();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("resize", sendSize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  async function connect() {
    try {
      setStatus("connecting");

      const ws = tunnelEndpoint;
      setWsUrl(ws);

      const tunnel = new Guacamole.WebSocketTunnel(ws);
      const client = new Guacamole.Client(tunnel);
      tunnelRef.current = tunnel;
      clientRef.current = client;
      window._guac = { tunnel, client };

      // Mount display
      const host = displayHostRef.current;
      host.innerHTML = "";
      const displayEl = client.getDisplay().getElement();
      displayEl.tabIndex = 0;
      displayEl.style.width = "100%";
      displayEl.style.height = "100%";
      displayEl.style.userSelect = "none";
      displayEl.style.touchAction = "none";
      host.appendChild(displayEl);
      displayElRef.current = displayEl;

      // Tunnel/client events
      tunnel.onstatechange = (s) => {
        // 0=connecting, 1=open, 2=closed
        setStatus(s === 1 ? "connected" : s === 0 ? "connecting" : "disconnected");
      };
      tunnel.onerror = (code) => { console.error("tunnel error code =", code); setStatus("error"); };
      client.onerror = (st) => { console.error("client error status =", st); setStatus("error"); };

      // Mouse input
      const mouse = new Guacamole.Mouse(displayEl);
      mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (state) => client.sendMouseState(state);

      // Keyboard on DOCUMENT (more reliable focus)
      const keyboard = new Guacamole.Keyboard(document);
      keyboard.onkeydown = (keysym) => { client.sendKeyEvent(1, keysym); return false; };
      keyboard.onkeyup   = (keysym) => { client.sendKeyEvent(0, keysym); return false; };
      keyboardRef.current = keyboard;

      // Focus helpers
      const focusIt = () => displayEl.focus();
      displayEl.addEventListener("mousedown", focusIt);
      window.addEventListener("click", focusIt, { once: true });

      // Initial size + connect the CLIENT
      requestAnimationFrame(() => {
        focusIt();
        const r = displayEl.getBoundingClientRect();
        client.sendSize(Math.floor(r.width), Math.floor(r.height));
      });

      client.connect(); // <<< important: start the Guac client (opens the tunnel)

      // Clean up these listeners when disconnecting
      clientRef.current._cleanupFocus = () => {
        displayEl.removeEventListener("mousedown", focusIt);
        window.removeEventListener("click", focusIt, { once: true });
      };
    } catch (err) {
      console.error(err);
      setStatus("error");
      alert(err.message || String(err));
    }
  }

  function disconnect() {
    try { keyboardRef.current?.reset(); } catch {}
    try { clientRef.current?._cleanupFocus?.(); } catch {}
    try { clientRef.current?.disconnect(); } catch {}
    try { tunnelRef.current?.disconnect(); } catch {}
    clientRef.current = null;
    tunnelRef.current = null;
    setStatus("disconnected");
  }

  // also disconnect on unload to be tidy
  useEffect(() => {
    const onUnload = () => disconnect();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  return (
    <div className="App">
      <h2>Guac via Quarkus Tunnel</h2>

      <div className="controls" style={{ gap: 8, padding: 10, display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center" }}>
        <input value={tunnelEndpoint} onChange={(e) => setTunnelEndpoint(e.target.value)} placeholder="ws://localhost:8080/ws/tunnel" />
        <button onClick={connect} disabled={status === "connected" || status === "connecting"}>Connect</button>
        <button onClick={disconnect} disabled={status !== "connected" && status !== "error"}>Disconnect</button>
        <div style={{ gridColumn: "1 / -1" }}>
          <span className={`status ${status}`}>Status: {status}</span>
          {wsUrl && <code style={{ marginLeft: 12, wordBreak: "break-all" }}>WS: {wsUrl}</code>}
        </div>
      </div>

      <div className="display" ref={displayHostRef} />
    </div>
  );
}
