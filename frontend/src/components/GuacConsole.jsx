import { useCallback, useEffect, useId, useRef, useState } from "react";
import Guacamole from "guacamole-client";

export default function GuacConsole({ wsUrl }) {
  const containerRef = useRef(null);
  const hostRef = useRef(null);
  const displayElRef = useRef(null);
  const clientRef = useRef(null);
  const tunnelRef = useRef(null);
  const keyboardRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const mutationObserverRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const focusStateRef = useRef(false);
  const [isConsoleFocused, setIsConsoleFocused] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [clipboardMessage, setClipboardMessage] = useState("");
  const [clipboardFallback, setClipboardFallback] = useState("");
  const [inputValue, setInputValue] = useState("");
  const textareaId = useId();

  const setNotice = useCallback((message, duration = 3000) => {
    setClipboardMessage(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (message) {
      noticeTimerRef.current = setTimeout(() => setClipboardMessage(""), duration);
    }
  }, []);

  const activateFocus = useCallback(() => {
    if (focusStateRef.current) return;
    focusStateRef.current = true;
    setIsConsoleFocused(true);
    requestAnimationFrame(() => {
      hostRef.current?.focus({ preventScroll: true });
      displayElRef.current?.focus?.();
    });
  }, []);

  const releaseFocus = useCallback(() => {
    if (!focusStateRef.current) return;
    focusStateRef.current = false;
    setIsConsoleFocused(false);
    try { keyboardRef.current?.reset(); } catch {}
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    const host = hostRef.current;
    const container = containerRef.current;
    if (!host || !container) return;

    host.setAttribute("tabindex", "-1");
    host.style.outline = "none";

    const handleHostMouseDown = () => activateFocus();
    host.addEventListener("mousedown", handleHostMouseDown);

    const handleFocusOut = (event) => {
      if (!focusStateRef.current) return;
      if (!host.contains(event.relatedTarget)) releaseFocus();
    };
    host.addEventListener("focusout", handleFocusOut);

    const handleDocumentMouseDown = (event) => {
      if (!focusStateRef.current) return;
      if (!container.contains(event.target)) releaseFocus();
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("blur", releaseFocus);

    const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
    const client = new Guacamole.Client(tunnel);
    tunnelRef.current = tunnel;
    clientRef.current = client;

    host.innerHTML = "";
    const el = client.getDisplay().getElement();
    el.tabIndex = 0;
    el.style.userSelect = "none";
    el.style.touchAction = "none";
    el.style.maxWidth = "100%";
    el.style.maxHeight = "100%";
    el.style.display = "block";
    host.appendChild(el);
    displayElRef.current = el;

    tunnel.onstatechange = (s) => setStatus(s === 1 ? "connected" : s === 0 ? "connecting" : "disconnected");
    tunnel.onerror = () => setStatus("error");
    client.onerror = () => setStatus("error");

    const autoScroll = () => {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const overflow = containerEl.scrollHeight - containerEl.clientHeight;
      if (overflow > 4) {
        containerEl.scrollTop = containerEl.scrollHeight;
      }
    };

    const updateDisplayScale = () => {
      const container = containerRef.current;
      const display = client.getDisplay();
      if (!container || !display) return;
      const width = display.getWidth();
      const height = display.getHeight();
      if (!width || !height) return;
      const rawScale = Math.min(
        container.clientWidth / width,
        container.clientHeight / height
      );
      const scale = !rawScale || !isFinite(rawScale)
        ? 1
        : Math.max(0.1, Math.round(rawScale * 1000) / 1000);
      display.scale(scale);
    };

    const handleClipboardStream = (stream, mimetype) => {
      if (!mimetype || !mimetype.startsWith("text/")) return;
      const reader = new Guacamole.StringReader(stream);
      let data = "";
      reader.ontext = (text) => { data += text; };
      reader.onend = async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(data);
            setClipboardFallback("");
            setNotice("Copied remote clipboard");
          } else {
            throw new Error("Clipboard API unavailable");
          }
        } catch {
          setClipboardFallback(data);
          setNotice("Clipboard ready below");
        }
      };
    };

    client.onclipboard = handleClipboardStream;

    const sendClipboardText = (text) => {
      if (!text) return;
      const stream = client.createClipboardStream("text/plain");
      const writer = new Guacamole.StringWriter(stream);
      writer.sendText(text);
      writer.sendEnd();
      setNotice("Sent clipboard to remote");
    };

    const handlePaste = (event) => {
      if (!event?.clipboardData) return;
      const text = event.clipboardData.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      sendClipboardText(text);
    };

    host.addEventListener("paste", handlePaste);

    const mouse = new Guacamole.Mouse(el);
    mouse.onmousedown = (st) => {
      if (!focusStateRef.current) activateFocus();
      client.sendMouseState(st);
    };
    mouse.onmouseup = (st) => {
      if (!focusStateRef.current) return;
      client.sendMouseState(st);
    };
    mouse.onmousemove = (st) => {
      if (!focusStateRef.current) return;
      client.sendMouseState(st);
    };

    const keyboard = new Guacamole.Keyboard(document);
    keyboard.onkeydown = (k) => {
      if (!focusStateRef.current) return true;
      if (k === 0xff1b) { // Escape
        releaseFocus();
        return false;
      }
      client.sendKeyEvent(1, k);
      return false;
    };
    keyboard.onkeyup = (k) => {
      if (!focusStateRef.current) return true;
      client.sendKeyEvent(0, k);
      return false;
    };
    keyboardRef.current = keyboard;

    const sendSize = () => {
      const container = containerRef.current;
      if (!container) return;
      client.sendSize(
        Math.max(64, Math.floor(container.clientWidth)),
        Math.max(64, Math.floor(container.clientHeight))
      );
      updateDisplayScale();
    };

    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      resizeObserverRef.current = new ResizeObserver(() => {
        sendSize();
        updateDisplayScale();
      });
      resizeObserverRef.current.observe(container);
    }

    mutationObserverRef.current = new MutationObserver(() => {
      autoScroll();
      updateDisplayScale();
    });
    mutationObserverRef.current.observe(el, { childList: true, subtree: true });

    client.getDisplay().onresize = () => {
      updateDisplayScale();
      autoScroll();
    };

    window.addEventListener("resize", sendSize);
    requestAnimationFrame(() => {
      el.focus();
      sendSize();
      updateDisplayScale();
      autoScroll();
    });

    client.connect(); // connect NOW

    return () => {
      host.removeEventListener("paste", handlePaste);
      host.removeEventListener("mousedown", handleHostMouseDown);
      host.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("blur", releaseFocus);
      try { keyboardRef.current?.reset(); } catch {}
      if (client) client.onclipboard = null;
      try { client.disconnect(); } catch {}
      try { tunnel.disconnect(); } catch {}
      window.removeEventListener("resize", sendSize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [wsUrl, setNotice, activateFocus, releaseFocus]);

  const sendViaClipboard = (text) => {
    if (!text) return;
    const client = clientRef.current;
    if (!client) return;
    if (!focusStateRef.current) activateFocus();

    const stream = client.createClipboardStream("text/plain");
    const writer = new Guacamole.StringWriter(stream);
    writer.sendText(text);
    writer.sendEnd();
    setNotice("Sent clipboard to remote");

    // Attempt to trigger paste (Ctrl+Shift+V) after clipboard update propagates
    const CTRL = 0xffe3;
    const SHIFT = 0xffe1;
    const V = "v".charCodeAt(0);
    setTimeout(() => {
      client.sendKeyEvent(1, CTRL);
      client.sendKeyEvent(1, SHIFT);
      client.sendKeyEvent(1, V);
      client.sendKeyEvent(0, V);
      client.sendKeyEvent(0, SHIFT);
      client.sendKeyEvent(0, CTRL);
    }, 30);
  };

  const handleSubmitInput = (e) => {
    e.preventDefault();
    const text = inputValue;
    if (!text.trim()) return;
    sendViaClipboard(text);
    setInputValue("");
  };

  return (
    <div className="console-root">
      <div className="console-status">Status: {status} &nbsp; <small>{wsUrl}</small></div>
      <div
        ref={containerRef}
        className={`console-display ${isConsoleFocused ? "is-focused" : ""}`}
      >
        <div ref={hostRef} className="console-display-host" />
        {!isConsoleFocused && (
          <div className="console-focus-hint">
            Click to enter console · Press Esc to release
          </div>
        )}
      </div>
      {clipboardMessage && (
        <div className="console-clipboard-message">{clipboardMessage}</div>
      )}
      {clipboardFallback && (
        <div className="console-clipboard-fallback">
          <p>Copy manually:</p>
          <textarea
            value={clipboardFallback}
            readOnly
            onFocus={(e) => {
              releaseFocus();
              e.target.select();
            }}
          />
        </div>
      )}
      <form className="console-input-panel" onSubmit={handleSubmitInput}>
        <label htmlFor={textareaId}>Send text to node</label>
        <textarea
          id={textareaId}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={releaseFocus}
          placeholder="Paste commands here..."
        />
        <div className="console-input-actions">
          <button type="submit" disabled={!inputValue.trim()}>
            Paste into session
          </button>
        </div>
      </form>
    </div>
  );
}
