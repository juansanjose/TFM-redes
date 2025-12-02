package org.acme.usage;

/**
 * Available subscription plans for lab usage.
 */
public enum UsagePlan {
    FREE,
    PREMIUM;

    public String id() {
        return name().toLowerCase();
    }
}
