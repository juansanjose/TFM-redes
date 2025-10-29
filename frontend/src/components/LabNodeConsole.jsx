import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import SshConsole from "./SshConsole";
import { findNode, useLabsConfig } from "../hooks/useLabsConfig";
import { tutorials } from "../data/tutorials";

const wsRoot = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

export default function LabNodeConsole() {
  const { labId, nodeId } = useParams();
  const { loading, error, config } = useLabsConfig();
  const [sessionIds, setSessionIds] = useState([]);
  const [pendingNodeId, setPendingNodeId] = useState("");
  const [expandedTasks, setExpandedTasks] = useState(() => new Set());
  const [revealedSolutions, setRevealedSolutions] = useState(() => new Set());
  const [copiedCommandId, setCopiedCommandId] = useState("");
  const copyTimerRef = useRef(null);

  const match = useMemo(() => {
    if (!config) return null;
    return findNode(config, labId, nodeId);
  }, [config, labId, nodeId]);

  const currentLab = match?.lab;
  const currentNode = match?.node;
  const tutorial = currentLab ? tutorials[currentLab.id] : null;

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

  useEffect(() => {
    setExpandedTasks(() => {
      const next = new Set();
      const firstTask = tutorial?.tasks?.[0]?.id;
      if (firstTask) next.add(firstTask);
      return next;
    });
    setRevealedSolutions(() => new Set());
    setCopiedCommandId("");
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, [tutorial]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

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

  const toggleTask = (taskId) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const revealSolution = (taskId) => {
    setRevealedSolutions((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  };

  const handleCopyCommand = async (event, task) => {
    event.stopPropagation();
    if (!task?.command) return;
    try {
      await navigator.clipboard.writeText(task.command);
      setCopiedCommandId(task.id);
    } catch {
      setCopiedCommandId(`error:${task.id}`);
    }
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedCommandId((prev) => (prev === task.id || prev === `error:${task.id}` ? "" : prev));
      copyTimerRef.current = null;
    }, 2000);
  };

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
    const wsPath = labNode?.wsPath || `/ws/sshterm/${labNode.id}`;
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
    <div className="lab-node-layout">
      <aside className="lab-tutorial">
        <div className="lab-tutorial-header">
          <p className="lab-node-breadcrumb">
            <Link to="/labs">Labs</Link> / {currentLab.name}
          </p>
          <h3>{tutorial?.title ?? currentLab.name}</h3>
          <p className="lab-tutorial-subtitle">{currentNode.summary}</p>
        </div>
        {tutorial?.intro?.length ? (
          <div className="lab-tutorial-intro">
            {tutorial.intro.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        ) : null}
        <ol className="lab-task-list">
          {(tutorial?.tasks ?? []).map((task, index) => {
            const expanded = expandedTasks.has(task.id);
            const solutionRevealed = revealedSolutions.has(task.id);
            const copyState = copiedCommandId === task.id;
            const copyError = copiedCommandId === `error:${task.id}`;
            return (
              <li key={task.id} className={`lab-task ${expanded ? "is-open" : ""}`}>
                <div
                  role="button"
                  tabIndex={0}
                  className="lab-task-header"
                  onClick={() => toggleTask(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleTask(task.id);
                    }
                  }}
                >
                  <span className="lab-task-index">{index + 1}</span>
                  <div className="lab-task-summary">
                    <h4>{task.title}</h4>
                    {task.command ? (
                      <div
                        className="lab-task-command"
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <code>{task.command}</code>
                        <button
                          type="button"
                          className={`lab-task-copy ${copyState ? "is-success" : ""} ${
                            copyError ? "is-error" : ""
                          }`}
                          onClick={(event) => handleCopyCommand(event, task)}
                        >
                          {copyError ? "Copy failed" : copyState ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <span className="lab-task-toggle">{expanded ? "−" : "+"}</span>
                </div>
                {expanded && (
                  <div className="lab-task-body">
                    {task.prompt?.length ? (
                      <section className="lab-task-section">
                        <h5>Task</h5>
                        {task.prompt.map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </section>
                    ) : null}

                    {task.solution?.length ? (
                      <section className="lab-task-section">
                        <h5>Solution</h5>
                        {solutionRevealed ? (
                          task.solution.map((item, idx) => {
                            if (typeof item === "string") {
                              return <p key={idx}>{item}</p>;
                            }
                            if (item?.code) {
                              return <pre key={idx}>{item.code}</pre>;
                            }
                            return <p key={idx}>{item?.text}</p>;
                          })
                        ) : (
                          <button
                            type="button"
                            className="lab-task-reveal"
                            onClick={(event) => {
                              event.stopPropagation();
                              revealSolution(task.id);
                            }}
                          >
                            Reveal solution
                          </button>
                        )}
                      </section>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="lab-node-page">
        <header className="lab-node-header">
          <div>
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
                  <code>{sessionNode.wsPath || `/ws/sshterm/${sessionNode.id}`}</code>
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
                <SshConsole key={`${currentLab.id}-${sessionNode.id}`} wsUrl={makeWsUrl(sessionNode)} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
