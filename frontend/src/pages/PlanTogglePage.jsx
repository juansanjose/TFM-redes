import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUsage } from "../hooks/useUsage";

export default function PlanTogglePage() {
  const { fetchWithAuth } = useAuth();
  const { usage, refresh } = useUsage({ refreshInterval: null });
  const [overridePremium, setOverridePremium] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOverride = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/usage/override");
      setOverridePremium(Boolean(response?.premium));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load override state");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadOverride();
  }, [loadOverride]);

  const updateOverride = async (premium) => {
    if (loading) return;
    try {
      setLoading(true);
      await fetchWithAuth("/api/usage/override", {
        method: "POST",
        body: { premium },
      });
      setOverridePremium(premium);
      setError("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update override");
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = usage?.plan ?? "unknown";
  const remainingSeconds = usage?.remainingSeconds;
  const remainingLabel =
    typeof remainingSeconds === "number"
      ? `${Math.floor(remainingSeconds / 3600)}h ${Math.floor((remainingSeconds % 3600) / 60)}m`
      : "n/a";

  return (
    <section className="plan-toggle-page">
      <header className="plan-toggle-header">
        <h2>Lab Plan Override</h2>
        <p>
          This test panel flips the backend override flag. When enabled, every user is treated as premium and receives
          10 hours per period.
        </p>
      </header>

      <div className="plan-toggle-card">
        <div className="plan-toggle-status">
          <p>
            <strong>Backend override:</strong> {overridePremium === null ? "loading…" : overridePremium ? "Premium" : "Free"}
          </p>
          <p>
            <strong>Effective plan:</strong> {currentPlan}
          </p>
          <p>
            <strong>Remaining time:</strong> {remainingLabel}
          </p>
          {error ? <p className="plan-toggle-error">{error}</p> : null}
        </div>

        <div className="plan-toggle-actions">
          <button
            type="button"
            className={`plan-toggle-button ${overridePremium ? "is-active" : ""}`}
            onClick={() => updateOverride(true)}
            disabled={loading}
          >
            Switch to Premium
          </button>
          <button
            type="button"
            className={`plan-toggle-button ${overridePremium === false ? "is-active" : ""}`}
            onClick={() => updateOverride(false)}
            disabled={loading}
          >
            Switch to Free
          </button>
        </div>
      </div>
    </section>
  );
}
