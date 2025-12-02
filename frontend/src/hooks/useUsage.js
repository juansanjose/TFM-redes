import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

function normalizeError(err) {
  if (!err) return null;
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error");
}

export function useUsage(options = {}) {
  const { isAuthenticated, fetchWithAuth } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshInterval = options.refreshInterval ?? null;

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setUsage(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const snapshot = await fetchWithAuth("/api/usage");
      setUsage(snapshot ?? null);
      setError(null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchWithAuth]);

  useEffect(() => {
    let timer;
    refresh();
    if (refreshInterval && typeof refreshInterval === "number" && refreshInterval > 0) {
      timer = setInterval(() => {
        refresh();
      }, refreshInterval);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [refresh, refreshInterval]);

  return {
    usage,
    loading,
    error,
    refresh,
  };
}
