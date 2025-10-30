package org.acme.ws;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class WsTicketService {

    private static final Duration DEFAULT_TTL = Duration.ofMinutes(1);

    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    public Ticket issue(String principalName) {
        return issue(principalName, DEFAULT_TTL);
    }

    public Ticket issue(String principalName, Duration ttl) {
        Instant expiresAt = Instant.now().plus(ttl);
        String value = UUID.randomUUID().toString();
        Ticket ticket = new Ticket(value, principalName, expiresAt);
        tickets.put(value, ticket);
        return ticket;
    }

    public Optional<Ticket> consume(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        Ticket ticket = tickets.remove(value);
        if (ticket == null || ticket.expiresAt().isBefore(Instant.now())) {
            return Optional.empty();
        }
        return Optional.of(ticket);
    }

    public record Ticket(String value, String principal, Instant expiresAt) {
    }
}
