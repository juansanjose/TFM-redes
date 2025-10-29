import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

const MSG_DATA = "0";
const MSG_RESIZE = "1";

export default function SshConsole({ wsUrl }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const resizeTimerRef = useRef(null);

  const [status, setStatus] = useState("disconnected");
  useEffect(() => {
    if (!wsUrl) return;
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

    const socket = new WebSocket(wsUrl);
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

    socket.onclose = () => {
      setStatus("disconnected");
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
  }, [wsUrl]);

  return (
    <div className="console-root">
      <div className={`console-status status-${status}`}>
        Status: {status} &nbsp; <small>{wsUrl}</small>
      </div>
      <div className="console-display">
        <div ref={containerRef} className="console-xterm-host" />
      </div>
    </div>
  );
}
