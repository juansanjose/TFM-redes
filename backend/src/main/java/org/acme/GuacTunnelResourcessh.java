// src/main/java/org/acme/GuacTunnelResource.java
package org.acme;

import java.io.IOException;
import java.net.InetAddress;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;

@ServerEndpoint("/ws/cont/{node}")
@ApplicationScoped
public class GuacTunnelResourcessh {

  // guacd location (same for all nodes)
  @ConfigProperty(name = "app.guacd.host", defaultValue = "guacd") String guacdHost;
  @ConfigProperty(name = "app.guacd.port", defaultValue = "4822")   int    guacdPort;

  /** Allow-list of lab nodes -> SSH parameters.
   *  Adjust hostnames to match your Containerlab names exactly.
   *  Containerlab usually uses "clab-<labname>-<node>".
   * 
   * info.setOptimalResolution(1280);
            info.setOptimalScreenHeight(720);
            info.setOptimalScreenWidth(1280);
   */
  private static final Map<String, Target> NODES = Map.of(
      "r1", new Target("clab-bgp01-r1", 22, "clab", "clab"),
      "r2", new Target("clab-bgp01-r2", 22, "clab", "clab"),
      "r3", new Target("clab-bgp01-r3", 22, "clab", "clab")
  );

  private static final class Target {
    final String host; final int port; final String user; final String pass;
    Target(String h,int p,String u,String pw){host=h;port=p;user=u;pass=pw;}
  }
  private static final class Conn {
    final GuacamoleSocket socket;
    final GuacamoleReader reader;
    final GuacamoleWriter writer;
    final Future<?> pumpTask;
    Conn(GuacamoleSocket s, GuacamoleReader r, GuacamoleWriter w, Future<?> t){ socket=s; reader=r; writer=w; pumpTask=t; }
  }

  private final Map<String, Conn> sessions = new ConcurrentHashMap<>();
  private final ExecutorService pumps = Executors.newCachedThreadPool(r -> { Thread t=new Thread(r,"guac-pump"); t.setDaemon(true); return t; });
  
  @OnOpen
public void onOpen(Session ws, @PathParam("node") String node) {
  try {
        Log.infof("WS %s open; node=%s", safeId(ws), node);

      if (node == null || node.isBlank()) {
        Log.warnf("WS %s rejected: missing path node", safeId(ws));
        ws.close(new CloseReason(CloseReason.CloseCodes.CANNOT_ACCEPT, "Missing node"));
        return;
      }

      if (!isAllowedNode(node)) {
        Log.warnf("WS %s rejected: invalid node '%s'", safeId(ws), node);
        ws.close(new CloseReason(CloseReason.CloseCodes.CANNOT_ACCEPT, "Invalid node"));
        return;
      }

      String host = "clab-bgp01-" + node; // containerlab hostname convention
      // Quick DNS sanity
      try {
        InetAddress addr = InetAddress.getByName(host);
        Log.infof("Resolved %s -> %s", host, addr.getHostAddress());
      } catch (Exception e) {
        Log.warnf("DNS failed for %s: %s", host, e.getMessage());
      }
    Target t = NODES.get(node);
    if (t == null) {
      Log.warnf("WS %s rejected: unknown node '%s'. Allowed=%s", ws.getId(), node, NODES.keySet());
      ws.close(new CloseReason(CloseReason.CloseCodes.CANNOT_ACCEPT, "Unknown node"));
      return;
    }
    // Resolve host early (gives a clean error if DNS is off)
    // String sshIp;
    // try {
    //   sshIp = java.net.InetAddress.getByName(t.host).getHostAddress();
    // } catch (Exception dns) {
    //   Log.errorf(dns, "WS %s DNS failed for node=%s host=%s", ws.getId(), node, t.host);
    //   ws.close(new CloseReason(CloseReason.CloseCodes.TRY_AGAIN_LATER, "DNS failure for SSH host"));
    //   return;
    // }

    
    String sshIp;
    try {
      sshIp = InetAddress.getByName(t.host).getHostAddress();
      Log.infof("Resolved %s -> %s", t.host, sshIp);
    } catch (Exception dns) {
      Log.errorf(dns, "WS %s DNS failed for node=%s host=%s", safeId(ws), node, t.host);
      ws.close(new CloseReason(CloseReason.CloseCodes.TRY_AGAIN_LATER, "DNS failure for SSH host"));
      return;
    }
    Log.infof("WS %s config -> guacd=%s:%d, ssh=%s:%d(%s), user=%s",
        ws.getId(), guacdHost, guacdPort, t.host, t.port, sshIp, t.user);

    // Guac configuration
    GuacamoleConfiguration cfg = new GuacamoleConfiguration();
    cfg.setProtocol("ssh");
    cfg.setParameter("hostname", sshIp);
    cfg.setParameter("port", Integer.toString(t.port));
    cfg.setParameter("username", t.user);
    cfg.setParameter("password", t.pass);
    cfg.setParameter("ignore-host-key", "true"); // containerlab nodes regenerate keys on each run

    GuacamoleClientInformation info = new GuacamoleClientInformation();
    info.setOptimalResolution(1280);
    info.setOptimalScreenHeight(720);
    info.setOptimalScreenWidth(1280);
    info.setOptimalResolution(96);

    // Connect to guacd
    GuacamoleSocket raw = new InetGuacamoleSocket(guacdHost, guacdPort);
    GuacamoleSocket configured = new ConfiguredGuacamoleSocket(raw, cfg, info);

    GuacamoleReader reader = configured.getReader();
    GuacamoleWriter writer = configured.getWriter();

    Future<?> task = pumps.submit(() -> pumpGuacToBrowser(ws, reader));
    sessions.put(ws.getId(), new Conn(configured, reader, writer, task));

    Log.infof("Tunnel up for %s -> %s:%d", ws.getId(), t.host, t.port);

    } catch (Throwable e) {
        Log.errorf(e, "WS %s failed to open tunnel", ws != null ? ws.getId() : "n/a");
        safeClose(ws);
    }
    }

    // helper unchanged, but guard against null map robustly
    private static String getFirst(Session ws, String key) {
    if (ws == null) return null;
    var m = ws.getRequestParameterMap();
    if (m == null) return null;
    var list = m.get(key);
    return (list != null && !list.isEmpty()) ? list.get(0) : null;
    }
    

  @OnMessage
  public void onMessage(String msg, Session ws) {
    Conn c = sessions.get(ws.getId());
    if (c == null) { safeClose(ws); return; }
    try { c.writer.write(msg.toCharArray(), 0, msg.length()); }
    catch (GuacamoleException e) { Log.warn("Write to guacd failed", e); onClose(ws); }
  }

  @OnClose
  public void onClose(Session ws) {
    Conn c = sessions.remove(ws.getId());
    if (c != null) {
      try { if (c.pumpTask != null) c.pumpTask.cancel(true); } catch (Exception ignored) {}
      try { c.socket.close(); } catch (Exception ignored) {}
    }
    safeClose(ws);
    Log.infof("Tunnel closed for %s", ws.getId());
  }

  @OnError
  public void onError(Session ws, Throwable t) {
    Log.errorf(t, "WS error on %s", ws != null ? ws.getId() : "n/a");
    if (ws != null) onClose(ws);
  }

  private void pumpGuacToBrowser(Session ws, GuacamoleReader reader) {
    try {
      char[] buf;
      while (ws.isOpen() && (buf = reader.read()) != null) {
        if (buf.length > 0) ws.getBasicRemote().sendText(new String(buf));
      }
    } catch (Exception ignored) {
    } finally {
      safeClose(ws);
    }
  }
    private void safeClose(Session ws){ try { if (ws != null && ws.isOpen()) ws.close(); } catch (IOException ignored) {} }

    private boolean isAllowedNode(String node) {
    return Objects.equals(node, "r1") || Objects.equals(node, "r2") || Objects.equals(node, "r3");
    }

    private String safeId(Session ws) { return ws != null ? ws.getId() : "n/a"; }


}
