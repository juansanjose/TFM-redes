package org.acme.usage;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/usage")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class LabUsageResource {

    @Inject
    LabUsageService usageService;

    @Inject
    SecurityIdentity identity;

    @GET
    public LabUsageService.UsageSnapshot current() {
        String principal = resolvePrincipal();
        UsagePlan plan = usageService.resolvePlan(identity);
        return usageService.snapshot(principal, plan);
    }

    private String resolvePrincipal() {
        String principal = identity.getAttribute("preferred_username");
        if (principal == null || principal.isBlank()) {
            principal = identity.getAttribute("sub");
        }
        if ((principal == null || principal.isBlank()) && identity.getPrincipal() != null) {
            principal = identity.getPrincipal().getName();
        }
        if (principal == null || principal.isBlank()) {
            throw new jakarta.ws.rs.WebApplicationException("Unable to resolve user principal",
                    jakarta.ws.rs.core.Response.Status.UNAUTHORIZED);
        }
        return principal;
    }
}
