import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useAuth } from "../hooks/useAuth";

const MSG_DATA = "0";
const MSG_RESIZE = "1";

export default function SshConsole({ wsUrl }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const resizeTimerRef = useRef(null);
  const { isAuthenticated, fetchWithAuth } = useAuth();

  const [status, setStatus] = useState("disconnected");
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [plan, setPlan] = useState(null);
  const [usage, setUsage] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const formatRemaining = (snapshot) => {
    if (!snapshot) return null;
    const seconds = snapshot.remainingSeconds;
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return null;
    if (seconds <= 0) return "0m left";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m left`;
    if (hours > 0) return `${hours}h left`;
    return `${minutes}m left`;
  };

  useEffect(() => {
    let cancelled = false;
    if (!wsUrl || !isAuthenticated) {
      setResolvedUrl(null);
      setPlan(null);
      setUsage(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        setStatus("authorizing");
        setErrorMessage("");
        const response = await fetchWithAuth("/api/ws-ticket", { method: "POST" });
        if (cancelled) return;
        const ticket = response?.ticket;
        if (!ticket) throw new Error("No ticket returned");
        setPlan(response?.plan ?? null);
        setUsage(response?.usage ?? null);
        const url = new URL(wsUrl);
        url.searchParams.set("ticket", ticket);
        setResolvedUrl(url.toString());
      } catch (err) {
        console.error("Failed to obtain WebSocket ticket", err);
        if (!cancelled) {
          setResolvedUrl(null);
          setPlan(null);
          setUsage(null);
          const message = err instanceof Error ? err.message : String(err);
          setErrorMessage(message);
          setStatus(message.toLowerCase().includes("hours") ? "exhausted" : "error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wsUrl, isAuthenticated, fetchWithAuth]);

  useEffect(() => {
    if (!resolvedUrl) return;
    let disposed = false;
    const terminal = new Terminal({
      cursorBlink: true,
      scrollback: 4000,
      convertEol: true,
      fontSize: 14,
      theme: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        cursor: "#38bdf8",
        selection: "#1f2937"
      }
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    termRef.current = terminal;
    fitRef.current = fitAddon;

    const socket = new WebSocket(resolvedUrl);
    wsRef.current = socket;
    setStatus("connecting");

    const sendResize = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN || !terminal) return;
      if (fitAddon) fitAddon.fit();
      const cols = terminal.cols;
      const rows = terminal.rows;
      socket.send(`${MSG_RESIZE}${cols}x${rows}`);
    };

    const scheduleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(sendResize, 60);
    };

    const dataDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(MSG_DATA + data);
      }
    });

    socket.onopen = () => {
      setStatus("connected");
      sendResize();
    };

    socket.onclose = async () => {
      setStatus("disconnected");
      try {
        const snapshot = await fetchWithAuth("/api/usage");
        if (!disposed) {
          setUsage(snapshot ?? null);
        }
      } catch (err) {
        if (!disposed) {
          console.error("Failed to refresh usage after disconnect", err);
        }
      }
    };

    socket.onerror = () => {
      setStatus("error");
    };

    socket.onmessage = (event) => {
      const message = event.data ?? "";
      if (!message) return;
      const type = message.charAt(0);
      const body = message.substring(1);
      if (type === MSG_DATA) {
        terminal.write(body);
      }
    };

    const handleResize = () => scheduleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      dataDisposable?.dispose?.();
      window.removeEventListener("resize", handleResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
      setStatus("disconnected");
    };
  }, [resolvedUrl, fetchWithAuth]);

  return (
    <div className="console-root">
      <div className={`console-status status-${status}`}>
        Status: {status}
        {plan ? ` · ${plan === "PREMIUM" ? "Premium" : "Free"} plan` : null}
        {usage ? ` · ${formatRemaining(usage) || ""}` : null}
        {status === "exhausted" && errorMessage ? (
          <>&nbsp;·&nbsp;<span className="console-error">{errorMessage}</span></>
        ) : null}
        <br />
        <small>{resolvedUrl ?? "authenticating"}</small>
      </div>
      <div className="console-display">
        <div ref={containerRef} className="console-xterm-host" />
      </div>
    </div>
  );
}
