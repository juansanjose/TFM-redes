import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./HomePage.css";

const networkHighlights = [
  {
    title: "Route with confidence",
    description: "Master BGP, OSPF, and EVPN through guided walk-throughs that show packet flow live.",
  },
  {
    title: "Diagnose faster",
    description: "Practice troubleshooting playbooks with simulated incidents and instant feedback.",
  },
  {
    title: "Secure the edge",
    description: "Explore zero-trust topologies, firewall policies, and segmentation in safe blueprints.",
  },
];

const learningTracks = [
  {
    title: "Network Foundations",
    summary: "Layer 1-3 essentials, subnetting clinics, and routing warmups.",
  },
  {
    title: "Automation & APIs",
    summary: "Use Python, Ansible, and REST to orchestrate network changes.",
  },
  {
    title: "Service Provider",
    summary: "MPLS, segment routing, and scale-ready architectures.",
  },
  {
    title: "Campus & Edge",
    summary: "Wireless design, NAC patterns, and resilient access switches.",
  },
  {
    title: "Security & Observability",
    summary: "Firewalls, IDS/IPS labs, and telemetry pipelines you can trace.",
  },
  {
    title: "Data Center Fabrics",
    summary: "Clos topologies, VXLAN overlays, and multicloud integration.",
  },
];

const quickSignals = [
  {
    label: "Lab uptime",
    value: "99.95%",
  },
  {
    label: "Live routers",
    value: "58",
  },
  {
    label: "Practice hours",
    value: "1.2M",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isInitializing } = useAuth();

  const tabs = useMemo(
    () => [
      {
        id: "fundamentals",
        label: "Fundamentals",
        description: "Interactive primers on IP addressing, VLANs, and switching basics.",
        action: () => navigate("/"),
        requiresAuth: false,
      },
      {
        id: "labs",
        label: "Hands-on Labs",
        description: "Spin up isolated topologies and work through guided networking drills.",
        action: () => navigate("/labs"),
        requiresAuth: true,
      },
      {
        id: "console",
        label: "Live Console",
        description: "Jump into SSH-ready routers to validate commands in real time.",
        action: () => navigate("/ssh"),
        requiresAuth: true,
      },
      {
        id: "library",
        label: "Reference Library",
        description: "Reusable diagrams, cheat sheets, and troubleshooting runbooks.",
        action: () => navigate("/"),
        requiresAuth: false,
      },
    ],
    [navigate],
  );

  const accessibleTabs = useMemo(
    () => tabs.filter((tab) => (tab.requiresAuth ? isAuthenticated : true)),
    [tabs, isAuthenticated],
  );

  const [activeTab, setActiveTab] = useState(accessibleTabs[0]?.id ?? null);

  useEffect(() => {
    if (!accessibleTabs.length) {
      setActiveTab(null);
      return;
    }
    if (!accessibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(accessibleTabs[0].id);
    }
  }, [accessibleTabs, activeTab]);

  const activeTabContent = accessibleTabs.find((tab) => tab.id === activeTab);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-kicker">Blueprint your future network</p>
          <h1>Build networking mastery with immersive practice</h1>
          <p className="hero-lede">
            Bluewire guides you through routing, security, and automation labs with a calm, minimal workspace. Learn
            faster, troubleshoot smarter, and ship resilient networks with confidence.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="cta-primary"
              onClick={() => (isAuthenticated ? navigate("/labs") : login())}
              disabled={isInitializing}
            >
              {isAuthenticated ? "Browse Labs" : "Sign In to Start"}
            </button>
            <button
              type="button"
              className="cta-secondary"
              onClick={() => navigate("/labs")}
            >
              Preview catalog
            </button>
          </div>
        </div>
        <div className="hero-stats">
          {quickSignals.map((item) => (
            <div key={item.label} className="hero-stat">
              <span className="hero-stat-number">{item.value}</span>
              <span className="hero-stat-label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tabs" aria-label="Accessible learning areas">
        <header className="tabs-header">
          <h2>Start where you have access</h2>
          <p>
            Only the spaces available to your account are shown. Sign in to unlock additional labs and live consoles.
          </p>
        </header>
        <div role="tablist" aria-label="Learning areas" className="tabs-list">
          {accessibleTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              className={`tabs-trigger ${tab.id === activeTab ? "is-active" : ""}`}
              aria-selected={tab.id === activeTab}
              aria-controls={`tab-panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTabContent ? (
          <article
            role="tabpanel"
            aria-labelledby={`tab-${activeTabContent.id}`}
            id={`tab-panel-${activeTabContent.id}`}
            className="tabs-panel"
          >
            <p>{activeTabContent.description}</p>
            <button type="button" onClick={activeTabContent.action} className="tabs-cta">
              Go to {activeTabContent.label}
            </button>
          </article>
        ) : (
          <article className="tabs-panel">
            <p>No learning areas are available yet. Sign in to see more.</p>
            <button type="button" onClick={login} className="tabs-cta" disabled={isInitializing}>
              Sign in
            </button>
          </article>
        )}
      </section>

      <section className="features">
        {networkHighlights.map((item) => (
          <div className="feature-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="tracks">
        <header className="tracks-header">
          <h2>Networking paths that stay focused</h2>
          <p>
            Follow concise learning journeys that move from packet fundamentals to automated global fabrics without
            leaving the workspace.
          </p>
        </header>
        <div className="tracks-grid">
          {learningTracks.map((track) => (
            <article key={track.title} className="track-card">
              <h3>{track.title}</h3>
              <p>{track.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
