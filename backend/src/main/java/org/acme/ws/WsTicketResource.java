package org.acme.ws;

import java.time.Instant;

import org.acme.usage.LabUsageService;
import org.acme.usage.UsagePlan;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/ws-ticket")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class WsTicketResource {

    @Inject
    WsTicketService ticketService;

    @Inject
    LabUsageService usageService;

    @Inject
    SecurityIdentity identity;

    @POST
    public TicketResponse createTicket() {
        String principal = identity.getAttribute("preferred_username");
        if (principal == null || principal.isBlank()) {
            principal = identity.getPrincipal() != null ? identity.getPrincipal().getName() : null;
        }
        if (principal == null || principal.isBlank()) {
            throw new WebApplicationException("Unable to resolve user principal", Response.Status.UNAUTHORIZED);
        }
        principal = principal.trim();
        UsagePlan plan = usageService.resolvePlan(identity);
        LabUsageService.UsageReservation reservation = usageService.prepareSession(principal, plan);
        WsTicketService.Ticket ticket = ticketService.issue(principal, reservation.sessionId(), plan);
        UsagePayload usage = UsagePayload.from(reservation.snapshot());
        return new TicketResponse(ticket.value(), ticket.expiresAt(), plan, usage);
    }

    public record TicketResponse(String ticket, Instant expiresAt, UsagePlan plan, UsagePayload usage) {
    }

    public record UsagePayload(long allowanceSeconds, long consumedSeconds, long remainingSeconds,
            Instant periodStartedAt, Instant resetsAt) {

        static UsagePayload from(LabUsageService.UsageSnapshot snapshot) {
            return new UsagePayload(
                    snapshot.allowanceSeconds(),
                    snapshot.consumedSeconds(),
                    snapshot.remainingSeconds(),
                    snapshot.periodStartedAt(),
                    snapshot.resetsAt());
        }
    }
}
