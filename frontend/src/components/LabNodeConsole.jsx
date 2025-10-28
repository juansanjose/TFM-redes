import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import GuacConsole from "./GuacConsole";
import { findNode, useLabsConfig } from "../hooks/useLabsConfig";

const wsRoot = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

export default function LabNodeConsole() {
  const { labId, nodeId } = useParams();
  const { loading, error, config } = useLabsConfig();
  const [sessionIds, setSessionIds] = useState([]);
  const [pendingNodeId, setPendingNodeId] = useState("");

  const match = useMemo(() => {
    if (!config) return null;
    return findNode(config, labId, nodeId);
  }, [config, labId, nodeId]);

  const currentLab = match?.lab;
  const currentNode = match?.node;

  useEffect(() => {
    if (!currentLab || !currentNode) return;
    setSessionIds((prev) => {
      const knownNodes = currentLab.nodes ?? [];
      const filtered = prev.filter((id) =>
        knownNodes.some((candidate) => candidate.id === id)
      );
      if (!filtered.length) return [currentNode.id];
      if (filtered[0] === currentNode.id) return filtered;
      const without = filtered.filter((id) => id !== currentNode.id);
      return [currentNode.id, ...without];
    });
  }, [currentLab, currentNode]);

  const availableNodes = useMemo(() => {
    if (!currentLab) return [];
    return currentLab.nodes?.filter((candidate) => !sessionIds.includes(candidate.id)) ?? [];
  }, [currentLab, sessionIds]);

  const sessionNodes = useMemo(() => {
    if (!currentLab) return [];
    return sessionIds
      .map((id) => currentLab.nodes?.find((candidate) => candidate.id === id))
      .filter(Boolean);
  }, [sessionIds, currentLab]);

  if (loading) {
    return <div className="lab-status">Loading node details…</div>;
  }
  if (error) {
    return (
      <div className="lab-status error">
        Failed to load labs configuration.
        <br />
        <code>{error.message}</code>
      </div>
    );
  }

  if (!match || !currentLab || !currentNode) {
    return <Navigate to="/labs" replace />;
  }

  const makeWsUrl = (labNode) => {
    const wsPath = labNode?.wsPath || `/ws/cont/${labNode.id}`;
    return wsPath.startsWith("ws:") || wsPath.startsWith("wss:")
      ? wsPath
      : `${wsRoot}${wsPath.startsWith("/") ? wsPath : `/${wsPath}`}`;
  };

  const handleAddSession = () => {
    if (!pendingNodeId) return;
    setSessionIds((prev) => (prev.includes(pendingNodeId) ? prev : [...prev, pendingNodeId]));
    setPendingNodeId("");
  };

  const handleRemoveSession = (id) => {
    setSessionIds((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((sessionId) => sessionId !== id);
    });
  };

  return (
    <div className="lab-node-page">
      <header className="lab-node-header">
        <div>
          <p className="lab-node-breadcrumb">
            <Link to="/labs">Labs</Link> / {currentLab.name}
          </p>
          <h3>{currentNode.label ?? currentNode.id}</h3>
          {currentNode.summary && <p>{currentNode.summary}</p>}
        </div>
        <div className="lab-node-toolbar">
          <div className="lab-node-meta">
            <dl>
              <div>
                <dt>Active consoles</dt>
                <dd>{sessionIds.length}</dd>
              </div>
              <div>
                <dt>Total nodes</dt>
                <dd>{currentLab.nodes?.length ?? 0}</dd>
              </div>
            </dl>
          </div>
          {availableNodes.length > 0 && (
            <form
              className="lab-node-add"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddSession();
              }}
            >
              <label htmlFor="lab-node-select">Open another console</label>
              <div className="lab-node-add-controls">
                <select
                  id="lab-node-select"
                  value={pendingNodeId}
                  onChange={(event) => setPendingNodeId(event.target.value)}
                >
                  <option value="">Select node…</option>
                  {availableNodes.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label ?? candidate.id}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={!pendingNodeId}>
                  Add
                </button>
              </div>
            </form>
          )}
        </div>
      </header>

      <div className="lab-node-console-grid">
        {sessionNodes.map((sessionNode) => (
          <article key={sessionNode.id} className="lab-node-console-card">
            <header className="lab-node-console-card-header">
              <div>
                <h4>{sessionNode.label ?? sessionNode.id}</h4>
                {sessionNode.summary && <p>{sessionNode.summary}</p>}
              </div>
              <div className="lab-node-console-actions">
                <code>{sessionNode.wsPath || `/ws/cont/${sessionNode.id}`}</code>
                {sessionIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSession(sessionNode.id)}
                    className="lab-node-remove"
                    title="Close console"
                  >
                    ×
                  </button>
                )}
              </div>
            </header>
            <div className="lab-node-console-body">
              <GuacConsole key={`${currentLab.id}-${sessionNode.id}`} wsUrl={makeWsUrl(sessionNode)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
