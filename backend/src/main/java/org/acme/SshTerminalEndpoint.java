package org.acme;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.channel.ChannelShell;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.client.future.ConnectFuture;
import org.apache.sshd.client.keyverifier.AcceptAllServerKeyVerifier;
import org.apache.sshd.client.channel.ClientChannel;
import org.acme.SshTargetRegistry.Target;

import io.quarkus.logging.Log;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;

@ServerEndpoint("/ws/sshterm/{node}")
@ApplicationScoped
public class SshTerminalEndpoint {

    private static final char MSG_DATA = '0';
    private static final char MSG_RESIZE = '1';
    private static final Duration SSH_TIMEOUT = Duration.ofSeconds(10);

    private final ExecutorService pumps = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "ssh-term-pump");
        t.setDaemon(true);
        return t;
    });

    private final Map<String, ClientConnection> activeConnections = new ConcurrentHashMap<>();

    private SshClient sshClient;

    @Inject
    SshTargetRegistry registry;

    @PostConstruct
    void startClient() {
        sshClient = SshClient.setUpDefaultClient();
        sshClient.setServerKeyVerifier(AcceptAllServerKeyVerifier.INSTANCE);
        sshClient.start();
    }

    @PreDestroy
    void stopClient() {
        activeConnections.values().forEach(ClientConnection::close);
        activeConnections.clear();
        pumps.shutdownNow();
        if (sshClient != null && !sshClient.isClosed()) {
            try {
                sshClient.close();
            } catch (Exception ignored) {
            }
        }
    }

    @OnOpen
    public void onOpen(Session ws, @PathParam("node") String nodeId) {
        registry.find(nodeId).ifPresentOrElse(target -> openSsh(ws, nodeId, target), () -> {
            Log.warnf("WS %s rejected: unknown node '%s'", safeId(ws), nodeId);
            safeClose(ws, CloseReason.CloseCodes.CANNOT_ACCEPT, "Unknown node");
        });
    }

    private void openSsh(Session ws, String nodeId, Target target) {
        try {
            ws.setMaxTextMessageBufferSize(65536);
            Log.infof("WS %s connecting SSH node=%s host=%s:%d", safeId(ws), nodeId, target.host(), target.port());

            ConnectFuture connectFuture = sshClient.connect(target.user(), target.host(), target.port());
            ClientSession session = connectFuture.verify(SSH_TIMEOUT).getSession();
            session.addPasswordIdentity(target.password());
            session.auth().verify(SSH_TIMEOUT);

            ChannelShell shell = session.createShellChannel();
            shell.setEnv("TERM", "xterm-256color");
            shell.setPtyType("xterm");
            shell.setPtyColumns(120);
            shell.setPtyLines(32);
            shell.open().verify(SSH_TIMEOUT);

            ClientConnection connection = new ClientConnection(ws, session, shell);
            connection.start(pumps);
            activeConnections.put(ws.getId(), connection);
            Log.infof("WS %s SSH tunnel ready -> %s", safeId(ws), nodeId);

        } catch (Exception e) {
            Log.errorf(e, "WS %s failed to open SSH tunnel for node=%s", safeId(ws), nodeId);
            safeClose(ws, CloseReason.CloseCodes.UNEXPECTED_CONDITION, e.getMessage());
        }
    }

    @OnMessage
    public void onMessage(Session ws, String payload) {
        ClientConnection connection = activeConnections.get(ws.getId());
        if (connection == null) {
            safeClose(ws, CloseReason.CloseCodes.CANNOT_ACCEPT, "No SSH session");
            return;
        }
        if (payload == null || payload.isEmpty()) return;

        char type = payload.charAt(0);
        String data = payload.substring(1);
        try {
            if (type == MSG_DATA) {
                connection.write(data);
            } else if (type == MSG_RESIZE) {
                connection.resize(data);
            }
        } catch (Exception e) {
            Log.errorf(e, "WS %s error handling message type=%s", safeId(ws), type);
            safeClose(ws, CloseReason.CloseCodes.UNEXPECTED_CONDITION, e.getMessage());
        }
    }

    @OnClose
    public void onClose(Session ws) {
        ClientConnection connection = activeConnections.remove(ws.getId());
        if (connection != null) {
            connection.close();
        }
        Log.infof("WS %s closed", safeId(ws));
    }

    @OnError
    public void onError(Session ws, Throwable error) {
        Log.errorf(error, "WS %s error", safeId(ws));
        safeClose(ws, CloseReason.CloseCodes.UNEXPECTED_CONDITION, error.getMessage());
    }

    private void safeClose(Session ws, CloseReason.CloseCodes code, String message) {
        try {
            if (ws != null && ws.isOpen()) {
                ws.close(new CloseReason(code, message != null ? message : code.name()));
            }
        } catch (Exception ignored) {
        }
    }

    private String safeId(Session ws) {
        return ws != null ? ws.getId() : "n/a";
    }

    private class ClientConnection {
        private final Session socket;
        private final ClientSession sshSession;
        private final ChannelShell shell;
        private final OutputStream stdin;
        private final InputStream stdout;
        private final InputStream stderr;
        private Future<?> stdoutPump;
        private Future<?> stderrPump;

        ClientConnection(Session socket, ClientSession sshSession, ChannelShell shell) throws Exception {
            this.socket = socket;
            this.sshSession = sshSession;
            this.shell = shell;
            this.stdin = Objects.requireNonNull(shell.getInvertedIn(), "stdin");
            this.stdout = Objects.requireNonNull(shell.getInvertedOut(), "stdout");
            this.stderr = Objects.requireNonNull(shell.getInvertedErr(), "stderr");
        }

        void start(ExecutorService executor) {
            stdoutPump = executor.submit(() -> pump(stdout, MSG_DATA));
            stderrPump = executor.submit(() -> pump(stderr, MSG_DATA));
        }

        void write(String data) throws Exception {
            if (data == null || data.isEmpty()) return;
            stdin.write(data.getBytes(StandardCharsets.UTF_8));
            stdin.flush();
        }

        void resize(String dims) {
            if (dims == null || dims.isBlank()) return;
            String[] parts = dims.split("x");
            if (parts.length != 2) return;
            try {
                int cols = Integer.parseInt(parts[0]);
                int rows = Integer.parseInt(parts[1]);
                cols = Math.max(cols, 20);
                rows = Math.max(rows, 10);
                shell.sendWindowChange(cols, rows, cols * 8, rows * 16);
            } catch (NumberFormatException e) {
                Log.debugf("Invalid resize payload '%s'", dims);
            } catch (IOException e) {
                Log.errorf("Failed to resize terminal: %s", e.getMessage());
            }
        }

        private void pump(InputStream stream, char type) {
            byte[] buffer = new byte[8192];
            try {
                int read;
                while ((read = stream.read(buffer)) != -1) {
                    if (read <= 0) continue;
                    if (!socket.isOpen()) break;
                    String text = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    socket.getAsyncRemote().sendText(String.valueOf(type) + text);
                }
            } catch (Exception e) {
                Log.debugf(e, "SSH pump ended");
            } finally {
                close();
                safeClose(socket, CloseReason.CloseCodes.NORMAL_CLOSURE, "SSH stream closed");
            }
        }

        void close() {
            if (stdoutPump != null) stdoutPump.cancel(true);
            if (stderrPump != null) stderrPump.cancel(true);
            try {
                shell.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), Duration.ofSeconds(5));
            } catch (Exception ignored) {
            }
            try {
                shell.close(false);
            } catch (Exception ignored) {
            }
            try {
                sshSession.close();
            } catch (Exception ignored) {
            }
        }
    }
}
