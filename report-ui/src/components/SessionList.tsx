import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import type { ReportSessionData } from "../types";

interface SessionListProps {
  sessions: ReportSessionData[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function SessionList({
  sessions,
  selectedIndex,
  onSelect,
}: SessionListProps) {
  return (
    <div className="sidebar-section">
      <h2>Sessions</h2>
      {sessions.map((s, i) => (
        <div
          key={s.sessionId}
          className={`session-item ${i === selectedIndex ? "selected" : ""}`}
          onClick={() => onSelect(i)}
        >
          <div className="session-header">
            <span className={`badge ${s.success ? "badge-pass" : "badge-fail"}`}>
              {s.success ? (
                <>
                  <IconCircleCheck size={12} /> PASS
                </>
              ) : (
                <>
                  <IconCircleX size={12} /> FAIL
                </>
              )}
            </span>
            <span className="session-name">{s.sessionId}</span>
            <span className="session-meta">
              {(s.taskTimeMs / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
