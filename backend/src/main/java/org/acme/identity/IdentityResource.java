package org.acme.identity;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import org.jboss.logging.Logger;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/me")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class IdentityResource {

    private static final Logger LOG = Logger.getLogger(IdentityResource.class);

    @Inject
    SecurityIdentity identity;

    @GET
    public Map<String, Object> me() {
        Map<String, Object> payload = new HashMap<>();
        String principal = resolvePrincipal();
        payload.put("principal", principal);
        payload.put("roles", Set.copyOf(identity.getRoles()));
        Object expiry = identity.getAttribute("quarkus.identity.expire-time");
        if (expiry != null) {
            payload.put("expireTime", expiry);
        }
        LOG.debugf("Identity request for %s", principal);
        return payload;
    }

    private String resolvePrincipal() {
        Object preferred = identity.getAttribute("preferred_username");
        if (preferred instanceof String && !((String) preferred).isBlank()) {
            return (String) preferred;
        }
        if (identity.getPrincipal() != null && identity.getPrincipal().getName() != null) {
            return identity.getPrincipal().getName();
        }
        Object sub = identity.getAttribute("sub");
        if (sub instanceof String && !((String) sub).isBlank()) {
            return (String) sub;
        }
        return "unknown";
    }
}
