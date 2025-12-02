package org.acme.usage;

import java.time.Duration;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class LabUsageSettings {

    private final long freeSeconds;
    private final long premiumSeconds;
    private final Duration periodLength;
    private final String premiumRole;
    private final boolean premiumOverride;

    public LabUsageSettings(
            @ConfigProperty(name = "lab.usage.free.hours", defaultValue = "2") long freeHours,
            @ConfigProperty(name = "lab.usage.premium.hours", defaultValue = "10") long premiumHours,
            @ConfigProperty(name = "lab.usage.period-days", defaultValue = "30") long periodDays,
            @ConfigProperty(name = "lab.usage.premium-role", defaultValue = "premium") String premiumRole,
            @ConfigProperty(name = "lab.usage.override-premium", defaultValue = "false") boolean premiumOverride) {

        this.freeSeconds = Math.max(0L, freeHours) * 3600L;
        this.premiumSeconds = Math.max(0L, premiumHours) * 3600L;
        long days = Math.max(1L, periodDays);
        this.periodLength = Duration.ofDays(days);
        this.premiumRole = premiumRole == null ? "premium" : premiumRole.trim().toLowerCase();
        this.premiumOverride = premiumOverride;
    }

    public long freeSeconds() {
        return freeSeconds;
    }

    public long premiumSeconds() {
        return premiumSeconds;
    }

    public Duration periodLength() {
        return periodLength;
    }

    public String premiumRole() {
        return premiumRole;
    }

    public boolean premiumOverride() {
        return premiumOverride;
    }
}
