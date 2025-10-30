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
        payload.put("principal", identity.getPrincipal().getName());
        payload.put("roles", Set.copyOf(identity.getRoles()));
        identity.getAttributes().keySet().forEach(name -> {
            Object value = identity.getAttribute(name);
            if (value != null) {
                payload.put(name, value);
            }
        });
        LOG.debugf("Identity request for %s", identity.getPrincipal().getName());
        return payload;
    }
}
