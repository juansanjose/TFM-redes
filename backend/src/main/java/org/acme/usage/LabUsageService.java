package org.acme.usage;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.jboss.logging.Logger;

import jakarta.annotation.PostConstruct;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

/**
 * Tracks per-user lab time consumption and enforces plan allowances.
 */
@ApplicationScoped
public class LabUsageService {

    private static final Logger LOG = Logger.getLogger(LabUsageService.class);

    private final Map<String, UsageAccount> accounts = new ConcurrentHashMap<>();
    private final Map<String, ActiveSession> sessions = new ConcurrentHashMap<>();
    private volatile boolean premiumOverride;

    @Inject
    LabUsageSettings settings;

    @PostConstruct
    void initOverride() {
        premiumOverride = settings.premiumOverride();
    }

    /**
     * Determine the effective usage plan based on the authenticated identity.
     */
    public UsagePlan resolvePlan(SecurityIdentity identity) {
        if (identity == null) {
            return UsagePlan.FREE;
        }
        if (premiumOverride) {
            return UsagePlan.PREMIUM;
        }
        String principalName = Optional.ofNullable(identity.getPrincipal())
                .map(p -> p.getName())
                .map(String::trim)
                .orElse(null);
        if ("labuser".equalsIgnoreCase(principalName)) {
            return UsagePlan.PREMIUM;
        }
        Set<String> roles = identity.getRoles();
        String premiumRole = settings.premiumRole();
        boolean hasPremiumRole = roles.stream()
                .map(String::toLowerCase)
                .anyMatch(role -> role.equals(premiumRole));
        if (hasPremiumRole) {
            return UsagePlan.PREMIUM;
        }
        Object tier = identity.getAttribute("subscription");
        if (tier instanceof String subscription) {
            if (subscription.equalsIgnoreCase(premiumRole) || subscription.equalsIgnoreCase(UsagePlan.PREMIUM.id())) {
                return UsagePlan.PREMIUM;
            }
        }
        return UsagePlan.FREE;
    }

    public boolean isPremiumOverrideEnabled() {
        return premiumOverride;
    }

    public void setPremiumOverride(boolean override) {
        this.premiumOverride = override;
    }

    /**
     * Prepare a lab session for the given principal.
     * Creates a session reservation that is later activated when the WebSocket opens.
     *
     * @throws WebApplicationException when the user has exhausted their allowance.
     */
    public UsageReservation prepareSession(String principal, UsagePlan plan) {
        Instant now = Instant.now();
        principal = normalizePrincipal(principal);
        UsageAccount account = ensureAccount(principal, plan, now);
        long allowance = allowanceFor(plan);
        long remaining = account.remainingSeconds(allowance);
        if (remaining <= 0) {
            LOG.debugf("Quota exceeded for %s (plan=%s)", principal, plan);
            throw new WebApplicationException("No lab hours remaining", Response.Status.FORBIDDEN);
        }

        String sessionId = UUID.randomUUID().toString();
        ActiveSession session = new ActiveSession(sessionId, principal, plan, now);
        sessions.put(sessionId, session);

        UsageSnapshot snapshot = account.snapshot(principal, plan, allowance, settings.periodLength(), now);
        return new UsageReservation(sessionId, snapshot);
    }

    /**
     * Mark the reserved session as started when the lab WebSocket connects.
     */
    public Optional<SessionContext> startSession(String sessionId) {
        ActiveSession session = sessions.get(sessionId);
        if (session == null) {
            return Optional.empty();
        }

        Instant now = Instant.now();
        UsageAccount account = ensureAccount(session.principal(), session.plan(), now);
        long allowance = allowanceFor(session.plan());
        long remaining = account.remainingSeconds(allowance);
        if (remaining <= 0) {
            sessions.remove(sessionId);
            LOG.debugf("Quota exhausted before starting session %s for %s", sessionId, session.principal());
            return Optional.empty();
        }

        session.markStarted(now);
        UsageSnapshot snapshot = account.snapshot(session.principal(), session.plan(), allowance, settings.periodLength(), now);
        return Optional.of(new SessionContext(sessionId, session.principal(), session.plan(), now, snapshot));
    }

    /**
     * Consume lab time when a session closes.
     */
    public Optional<UsageSnapshot> finishSession(String sessionId) {
        ActiveSession session = sessions.remove(sessionId);
        if (session == null) {
            return Optional.empty();
        }

        Instant now = Instant.now();
        UsageAccount account = ensureAccount(session.principal(), session.plan(), now);
        Instant startedAt = session.startedAt() != null ? session.startedAt() : session.reservedAt();
        long seconds = Math.max(0L, Duration.between(startedAt, now).getSeconds());
        long allowance = allowanceFor(session.plan());
        account.consume(seconds, allowance);
        UsageSnapshot snapshot = account.snapshot(session.principal(), session.plan(), allowance, settings.periodLength(), now);
        LOG.debugf("Session %s for %s consumed %d seconds (%s)", sessionId, session.principal(), seconds, session.plan());
        return Optional.of(snapshot);
    }

    /**
     * Cancel a pending session without charging time (e.g. failed handshake).
     */
    public void cancelSession(String sessionId) {
        sessions.remove(sessionId);
    }

    /**
     * Current usage snapshot for the given user.
     */
    public UsageSnapshot snapshot(String principal, UsagePlan plan) {
        Instant now = Instant.now();
        principal = normalizePrincipal(principal);
        UsageAccount account = ensureAccount(principal, plan, now);
        long allowance = allowanceFor(plan);
        return account.snapshot(principal, plan, allowance, settings.periodLength(), now);
    }

    private UsageAccount ensureAccount(String principal, UsagePlan plan, Instant now) {
        if (principal == null) {
            throw new WebApplicationException("Missing user principal", Response.Status.BAD_REQUEST);
        }
        UsageAccount account = accounts.computeIfAbsent(principal, key -> new UsageAccount(plan, now));
        account.refresh(plan, now, settings.periodLength());
        return account;
    }

    private String normalizePrincipal(String principal) {
        if (principal == null) {
            throw new WebApplicationException("Unable to resolve user principal", Response.Status.BAD_REQUEST);
        }
        String trimmed = principal.trim();
        if (trimmed.isEmpty()) {
            throw new WebApplicationException("Unable to resolve user principal", Response.Status.BAD_REQUEST);
        }
        return trimmed.toLowerCase();
    }

    private long allowanceFor(UsagePlan plan) {
        return switch (plan) {
            case PREMIUM -> settings.premiumSeconds();
            case FREE -> settings.freeSeconds();
        };
    }

    public record UsageReservation(String sessionId, UsageSnapshot snapshot) {
    }

    public record SessionContext(String sessionId, String principal, UsagePlan plan, Instant startedAt,
            UsageSnapshot snapshot) {
    }

    public record UsageSnapshot(String principal, UsagePlan plan, long allowanceSeconds, long consumedSeconds,
            long remainingSeconds, Instant periodStartedAt, Instant resetsAt) {

        public boolean isExhausted() {
            return remainingSeconds <= 0;
        }
    }

    private static final class ActiveSession {
        private final String id;
        private final String principal;
        private final UsagePlan plan;
        private final Instant reservedAt;
        private volatile Instant startedAt;

        private ActiveSession(String id, String principal, UsagePlan plan, Instant reservedAt) {
            this.id = id;
            this.principal = principal;
            this.plan = plan;
            this.reservedAt = reservedAt;
        }

        String id() {
            return id;
        }

        String principal() {
            return principal;
        }

        UsagePlan plan() {
            return plan;
        }

        Instant reservedAt() {
            return reservedAt;
        }

        Instant startedAt() {
            return startedAt;
        }

        void markStarted(Instant startedAt) {
            this.startedAt = startedAt;
        }
    }

    private static final class UsageAccount {
        private UsagePlan plan;
        private Instant periodStart;
        private long secondsUsed;

        private UsageAccount(UsagePlan plan, Instant now) {
            this.plan = plan;
            this.periodStart = now;
            this.secondsUsed = 0L;
        }

        synchronized void refresh(UsagePlan targetPlan, Instant now, Duration periodLength) {
            if (periodStart == null) {
                periodStart = now;
            }
            if (plan != targetPlan) {
                plan = targetPlan;
                periodStart = now;
                secondsUsed = 0L;
                return;
            }
            Instant resetAt = periodStart.plus(periodLength);
            if (!resetAt.isAfter(now)) {
                periodStart = now;
                secondsUsed = 0L;
            }
        }

        synchronized long remainingSeconds(long allowance) {
            return Math.max(allowance - secondsUsed, 0L);
        }

        synchronized void consume(long seconds, long allowance) {
            if (seconds <= 0) {
                return;
            }
            long updated = secondsUsed + seconds;
            if (updated >= allowance) {
                secondsUsed = allowance;
            } else {
                secondsUsed = updated;
            }
        }

        synchronized UsageSnapshot snapshot(String principal, UsagePlan plan, long allowance, Duration periodLength,
                Instant now) {
            Instant resetAt = periodStart.plus(periodLength);
            if (!resetAt.isAfter(now)) {
                periodStart = now;
                secondsUsed = 0L;
                resetAt = periodStart.plus(periodLength);
            }
            long remaining = Math.max(allowance - secondsUsed, 0L);
            return new UsageSnapshot(principal, plan, allowance, secondsUsed, remaining, periodStart, resetAt);
        }
    }
}
