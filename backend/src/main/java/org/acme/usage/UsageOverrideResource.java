package org.acme.usage;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/usage/override")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UsageOverrideResource {

    @Inject
    LabUsageService usageService;

    @GET
    public OverrideResponse current() {
        return new OverrideResponse(usageService.isPremiumOverrideEnabled());
    }

    @POST
    public OverrideResponse update(OverrideRequest request) {
        boolean premium = request != null && request.premium();
        usageService.setPremiumOverride(premium);
        return new OverrideResponse(premium);
    }

    public record OverrideRequest(boolean premium) {
    }

    public record OverrideResponse(boolean premium) {
    }
}
