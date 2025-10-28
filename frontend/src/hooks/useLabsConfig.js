import { useEffect, useState } from "react";

let labsCache = null;
let labsPromise = null;

const LABS_URL = "/labs.json";

async function loadLabsConfig() {
  if (labsCache) return labsCache;
  if (!labsPromise) {
    labsPromise = fetch(LABS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${LABS_URL}: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        labsCache = json;
        return json;
      })
      .finally(() => {
        labsPromise = null;
      });
  }
  return labsPromise;
}

export function useLabsConfig() {
  const [data, setData] = useState(() => (labsCache ? { labs: labsCache } : null));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!labsCache);

  useEffect(() => {
    let cancelled = false;
    if (!labsCache) {
      setLoading(true);
      loadLabsConfig()
        .then((json) => {
          if (!cancelled) setData({ labs: json });
        })
        .catch((err) => {
          if (!cancelled) setError(err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setData({ labs: labsCache });
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    error,
    config: data?.labs ?? { labs: [] }
  };
}

export function findNode(config, labId, nodeId) {
  if (!config?.labs) return null;
  for (const lab of config.labs) {
    if (lab.id === labId) {
      const node = lab.nodes?.find((n) => n.id === nodeId);
      if (node) return { lab, node };
    }
  }
  return null;
}
