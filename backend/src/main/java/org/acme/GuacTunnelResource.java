package org.acme;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.ServerEndpoint;

import java.io.IOException;
import java.net.InetAddress;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.*;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.logging.Log;

@ServerEndpoint("/ws/tunnel")
@ApplicationScoped
public class GuacTunnelResource {

    // private static final Logger LOG = Logger.getLogger(GuacTunnelResource.class);

    // private static final String GUACD_HOST = System.getenv().getOrDefault("GUACD_HOST", "guacd");
    // private static final int GUACD_PORT = Integer.parseInt(System.getenv().getOrDefault("GUACD_PORT", "4822"));

    // private static final String SSH_HOST = System.getenv().getOrDefault("SSH_HOST", "test-ssh-server");
    // private static final int SSH_PORT = Integer.parseInt(System.getenv().getOrDefault("SSH_PORT", "22"));
    // private static final String SSH_USER = System.getenv().getOrDefault("SSH_USER", "user");
    // private static final String SSH_PASS = System.getenv().getOrDefault("SSH_PASS", "password");

  @ConfigProperty(name = "app.guacd.host", defaultValue = "guacd") String guacdHost;
  @ConfigProperty(name = "app.guacd.port", defaultValue = "4822")   int guacdPort;
  @ConfigProperty(name = "app.ssh.host",   defaultValue = "sshd")   String sshHost;
  @ConfigProperty(name = "app.ssh.port",   defaultValue = "2222")   int sshPort;
  @ConfigProperty(name = "app.ssh.user",   defaultValue = "user")   String sshUser;
  @ConfigProperty(name = "app.ssh.pass",   defaultValue = "password") String sshPass;


    private static final class Conn {
        final GuacamoleSocket socket;
        final GuacamoleReader reader;
        final GuacamoleWriter writer;
        final Future<?> pumpTask;
        Conn(GuacamoleSocket s, GuacamoleReader r, GuacamoleWriter w, Future<?> t) {
            socket = s; reader = r; writer = w; pumpTask = t;
        }
    }

    private final Map<String, Conn> sessions = new ConcurrentHashMap<>();
    private final ExecutorService pumps = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "guac-pump"); t.setDaemon(true); return t;
    });
    
    @OnOpen
    public void onOpen(Session ws) {
        try {
            final String resolvedSsh = InetAddress.getByName(sshHost).getHostAddress();
            Log.infof("Starting tunnel %s: guacd %s:%d -> ssh %s:%d (%s), user=%s",
            ws.getId(), guacdHost, guacdPort, sshHost, sshPort, resolvedSsh, sshUser);
          
            GuacamoleConfiguration cfg = new GuacamoleConfiguration();
            cfg.setProtocol("ssh");
            cfg.setParameter("hostname", sshHost);
            cfg.setParameter("port", String.valueOf(sshPort));
            cfg.setParameter("username", sshUser);
            cfg.setParameter("password", sshPass);
            cfg.setParameter("ignore-host-key", "true"); // demo SSH containers rotate host keys

            GuacamoleClientInformation info = new GuacamoleClientInformation();
            info.setOptimalResolution(1280);
            info.setOptimalScreenHeight(720);
            info.setOptimalScreenWidth(1280);
            info.setOptimalResolution(96);
            Log.infof("Using SSH %s:%d via guacd %s:%d", sshHost, sshPort, guacdHost, guacdPort);


        //     GuacamoleSocket raw = new InetGuacamoleSocket(guacdHost, guacdPort);
        //     GuacamoleSocket configured = new ConfiguredGuacamoleSocket(raw, cfg, info);

        //     GuacamoleReader reader = configured.getReader();
        //     GuacamoleWriter writer = configured.getWriter();

        //     Future<?> task = pumps.submit(() -> pumpGuacToBrowser(ws, reader));

        //     sessions.put(ws.getId(), new Conn(configured, reader, writer, task));
        //     Log.infof("Tunnel up for %s -> %s:%d", ws.getId(), sshHost, sshPort);
        // } catch (Exception e) {
        //     Log.error("Failed to open tunnel", e);
        //     safeClose(ws);
        // }
        Log.infof("WS %s connecting guacd %s:%d ...", ws.getId(), guacdHost, guacdPort);
        GuacamoleSocket raw = new InetGuacamoleSocket(guacdHost, guacdPort); // may throw
        GuacamoleSocket configured = new ConfiguredGuacamoleSocket(raw, cfg, info);

        var reader = configured.getReader();
        var writer = configured.getWriter();
        var task = pumps.submit(() -> pumpGuacToBrowser(ws, reader));
        sessions.put(ws.getId(), new Conn(configured, reader, writer, task));

        Log.infof("Tunnel up for %s -> %s:%d", ws.getId(), sshHost, sshPort);

        } catch (GuacamoleException e) {
            Log.errorf(e, "WS %s GuacamoleException: %s", ws.getId(), e.getMessage());
            safeClose(ws);
        } catch (Throwable t) {
            Log.errorf(t, "WS %s failed to open tunnel", ws.getId());
            safeClose(ws);
        }
    }

        // @OnMessage
        // public void onMessage(String msg, Session ws) {
        //     Conn c = sessions.get(ws.getId());
        //     if (c == null) { safeClose(ws); return; }
        //     try {
        //         char[] data = msg.toCharArray();
        //         c.writer.write(data, 0, data.length);
        //     } catch (GuacamoleException e) {
        //         LOG.warn("Write to guacd failed", e);
        //         onClose(ws);
        //     }
        // }
   
    @OnMessage
    public void onMessage(String msg, Session ws) {
        Conn c = sessions.get(ws.getId());
        if (c == null) { safeClose(ws); return; }
        try {
            System.out.println("WS IN " + msg.length() + " chars: " +
                (msg.length() > 40 ? msg.substring(0,40) + "..." : msg));
            char[] data = msg.toCharArray();
            c.writer.write(data, 0, data.length);
        } catch (GuacamoleException e) {
            Log.warn("Error writing to guacd", e);
            onClose(ws);
        }
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
        Log.infof("Service name %s", guacdHost);

    }
    public void onClose(Session ws, CloseReason reason) {
    var c = sessions.remove(ws.getId());
    if (c != null) {
        try { if (c.pumpTask != null) c.pumpTask.cancel(true); } catch (Exception ignored) {}
        try { c.socket.close(); } catch (Exception ignored) {}
    }
    Log.infof("Tunnel closed for %s reason=%s (%s)", ws.getId(),
        reason != null ? reason.getReasonPhrase() : "n/a",
        reason != null ? reason.getCloseCode() : "n/a");
    safeClose(ws);
    }

    // @OnError
    // public void onError(Session ws, Throwable t) {
    //     Log.errorf(t, "WS error on %s", ws != null ? ws.getId() : "n/a");
    //     if (ws != null) onClose(ws);
    // }
    @OnError
    public void onError(Session ws, Throwable t) {
    Log.errorf(t, "WS error on %s", ws != null ? ws.getId() : "n/a");
    if (ws != null) onClose(ws, new CloseReason(CloseReason.CloseCodes.UNEXPECTED_CONDITION, t.getMessage()));
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

    private void safeClose(Session ws) {
        try { if (ws != null && ws.isOpen()) ws.close(); } catch (IOException ignored) {}
    }

}
