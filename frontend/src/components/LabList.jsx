import { Link } from "react-router-dom";
import { useLabsConfig } from "../hooks/useLabsConfig";

export default function LabList() {
  const { loading, error, config } = useLabsConfig();

  if (loading) {
    return <div className="lab-status">Loading labs…</div>;
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

  const labs = config.labs ?? [];

  if (!labs.length) {
    return <div className="lab-status">No labs defined in labs.json.</div>;
  }

  return (
    <div className="lab-page">
      {labs.map((lab) => (
        <section key={lab.id} className="lab-section">
          <header>
            <h3>{lab.name}</h3>
            {lab.description && <p className="lab-description">{lab.description}</p>}
          </header>
          <div className="lab-node-grid">
            {lab.nodes?.map((node) => (
              <article key={node.id} className="lab-node-card">
                <div>
                  <h4>{node.label ?? node.id}</h4>
                  {node.summary && <p>{node.summary}</p>}
                </div>
                <footer>
                  <Link className="lab-node-link" to={`/labs/${lab.id}/nodes/${node.id}`}>
                    Connect
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
