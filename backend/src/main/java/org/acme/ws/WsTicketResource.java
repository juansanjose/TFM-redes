package org.acme.ws;

import java.time.Instant;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/ws-ticket")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class WsTicketResource {

    @Inject
    WsTicketService ticketService;

    @Inject
    SecurityIdentity identity;

    @POST
    public TicketResponse createTicket() {
        String principal = identity.getAttribute("preferred_username");
        if (principal == null || principal.isBlank()) {
            principal = identity.getPrincipal().getName();
        }
        WsTicketService.Ticket ticket = ticketService.issue(principal);
        return new TicketResponse(ticket.value(), ticket.expiresAt());
    }

    public record TicketResponse(String ticket, Instant expiresAt) {
    }
}
