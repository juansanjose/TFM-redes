package org.acme;

import java.util.Map;
import java.util.Optional;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class SshTargetRegistry {

    public record Target(String host, int port, String user, String password) {}

    @ConfigProperty(name = "app.ssh.host", defaultValue = "sshd")
    String defaultHost;

    @ConfigProperty(name = "app.ssh.port", defaultValue = "2222")
    int defaultPort;

    @ConfigProperty(name = "app.ssh.user", defaultValue = "user")
    String defaultUser;

    @ConfigProperty(name = "app.ssh.pass", defaultValue = "password")
    String defaultPassword;

    private Map<String, Target> nodes;

    @PostConstruct
    void init() {
        nodes = Map.of(
            "default", new Target(defaultHost, defaultPort, defaultUser, defaultPassword),
            "ssh",     new Target(defaultHost, defaultPort, defaultUser, defaultPassword),
            "r1",      new Target("clab-bgp01-r1", 22, "clab", "clab"),
            "r2",      new Target("clab-bgp01-r2", 22, "clab", "clab"),
            "r3",      new Target("clab-bgp01-r3", 22, "clab", "clab")
        );
    }

    public Optional<Target> find(String id) {
        if (id == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(nodes.get(id));
    }
}
