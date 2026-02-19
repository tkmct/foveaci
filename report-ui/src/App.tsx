import { ThemeProvider } from "./theme/ThemeProvider";
import { useReportData } from "./hooks/useReportData";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { MetricsGrid } from "./components/MetricsGrid";
import { AdvisorPanel } from "./components/AdvisorPanel";
import { SessionList } from "./components/SessionList";
import { ReplayViewer } from "./components/ReplayViewer";
import { ReplayControls } from "./components/ReplayControls";
import { StepsBar } from "./components/StepsBar";
import { DiffReport } from "./components/DiffReport";
import { useState } from "react";
import type { MainReportData } from "./types";

export function App() {
  const { data, error } = useReportData();
  const [selectedSession, setSelectedSession] = useState<number>(-1);

  if (error) {
    return (
      <div style={{ padding: 40, color: "#cf222e", fontFamily: "sans-serif" }}>
        <h1>Failed to load report</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif",
          color: "#656d76",
        }}
      >
        Loading report...
      </div>
    );
  }

  if (data.kind === "diff") {
    return (
      <ThemeProvider>
        <DiffReport data={data} />
      </ThemeProvider>
    );
  }

  const mainData = data as MainReportData;
  const session =
    selectedSession >= 0 ? mainData.sessions[selectedSession] : null;

  return (
    <ThemeProvider>
      <div className="app">
        <Header metrics={mainData.metrics} />
        <div className="layout">
          <Sidebar>
            <MetricsGrid metrics={mainData.metrics} />
            {mainData.advisor && (
              <AdvisorPanel
                advisor={mainData.advisor}
                onSelectSession={(sessionId) => {
                  const idx = mainData.sessions.findIndex(
                    (s) => s.sessionId === sessionId,
                  );
                  if (idx >= 0) setSelectedSession(idx);
                }}
              />
            )}
            <SessionList
              sessions={mainData.sessions}
              selectedIndex={selectedSession}
              onSelect={setSelectedSession}
            />
          </Sidebar>
          <main className="main">
            {!session ? (
              <div className="main-empty">Select a session to view replay</div>
            ) : (
              <>
                <ReplayViewer
                  key={selectedSession}
                  session={session}
                  renderControls={(engine) => (
                    <>
                      <ReplayControls engine={engine} />
                      <StepsBar steps={session.steps} />
                    </>
                  )}
                />
              </>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
