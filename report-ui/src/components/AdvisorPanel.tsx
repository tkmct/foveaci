import { useState } from "react";
import type { AdvisorReport } from "../types";

type Tab = "findings" | "hypotheses" | "suggestions" | "verification";

interface AdvisorPanelProps {
  advisor: AdvisorReport;
  onSelectSession: (sessionId: string) => void;
}

export function AdvisorPanel({ advisor, onSelectSession }: AdvisorPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("findings");

  const tabs: { key: Tab; label: string }[] = [
    { key: "findings", label: "Findings" },
    { key: "hypotheses", label: "Hypotheses" },
    { key: "suggestions", label: "Suggestions" },
    { key: "verification", label: "Verification" },
  ];

  return (
    <div className="sidebar-section advisor-section">
      <h2>
        Advisor
        <span className="advisor-summary">
          {advisor.summary.totalFindings} finding(s)
          {advisor.summary.highSeverityCount > 0 && (
            <span className="high-count">
              {" "}
              / {advisor.summary.highSeverityCount} high
            </span>
          )}
        </span>
      </h2>
      <div className="advisor-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`advisor-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {activeTab === "findings" && (
        <div className="advisor-content active">
          {advisor.findings.length > 0 ? (
            advisor.findings.map((f) => (
              <div key={f.id} className="finding-item">
                <div className="finding-header">
                  <span className={`severity-badge severity-${f.severity}`}>
                    {f.severity}
                  </span>
                  <div className="finding-title">{f.title}</div>
                </div>
                <div className="finding-description">{f.description}</div>
                {f.evidence.length > 0 && (
                  <ul className="evidence-list">
                    {f.evidence.map((e, i) => (
                      <li key={i} className="evidence-item">
                        <a
                          className="evidence-link"
                          onClick={() => onSelectSession(e.sessionId)}
                        >
                          {e.sessionId}
                          {e.stepIndex !== undefined
                            ? ` (step ${e.stepIndex})`
                            : ""}
                        </a>
                        : {e.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : (
            <p className="empty-text">No findings detected</p>
          )}
        </div>
      )}

      {activeTab === "hypotheses" && (
        <div className="advisor-content active">
          {advisor.hypotheses.length > 0 ? (
            advisor.hypotheses.map((h, i) => (
              <div key={i} className="hypothesis-item">
                <div className="hypothesis-category">
                  {h.category.replace(/_/g, " ")}
                </div>
                <div className="hypothesis-description">{h.description}</div>
                <div className="hypothesis-confidence">
                  Confidence: {h.confidence}
                </div>
              </div>
            ))
          ) : (
            <p className="empty-text">No hypotheses generated</p>
          )}
        </div>
      )}

      {activeTab === "suggestions" && (
        <div className="advisor-content active">
          {advisor.suggestions.length > 0 ? (
            advisor.suggestions.map((s, i) => (
              <div key={i} className="suggestion-item">
                <div className="suggestion-title">
                  {s.title}
                  <span className={`impact-badge impact-${s.expectedImpact}`}>
                    Impact: {s.expectedImpact}
                  </span>
                </div>
                <div className="suggestion-description">{s.description}</div>
                {s.implementation && (
                  <div className="suggestion-impl">
                    <strong>Impl:</strong> {s.implementation}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="empty-text">No suggestions available</p>
          )}
        </div>
      )}

      {activeTab === "verification" && (
        <div className="advisor-content active">
          {advisor.verification.length > 0 ? (
            advisor.verification.map((v, i) => (
              <div key={i} className="verification-item">
                <div className="verification-label">Method</div>
                <div className="verification-text">{v.method}</div>
                <div className="verification-label">Expected</div>
                <div className="verification-text">{v.expectedOutcome}</div>
                {v.metrics && (
                  <div className="verification-metrics">
                    <strong>Metrics:</strong> {v.metrics.join(", ")}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="empty-text">No verification steps available</p>
          )}
        </div>
      )}
    </div>
  );
}
