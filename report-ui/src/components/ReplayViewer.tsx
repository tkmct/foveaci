import { useRef, type ReactNode } from "react";
import { useReplayEngine, type ReplayEngine } from "../hooks/useReplayEngine";
import { useViewportScale } from "../hooks/useViewportScale";
import type { ReportSessionData } from "../types";

interface ReplayViewerProps {
  session: ReportSessionData;
  renderControls: (engine: ReplayEngine) => ReactNode;
}

export function ReplayViewer({ session, renderControls }: ReplayViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useViewportScale(containerRef);

  const engine = useReplayEngine(containerRef, session.events);

  return (
    <>
      <div className="replay-container" ref={containerRef} />
      {renderControls(engine)}
    </>
  );
}
