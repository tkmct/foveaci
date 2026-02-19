import { IconSun, IconMoon } from "@tabler/icons-react";
import { useTheme } from "../theme/ThemeProvider";
import { Badge } from "./Badge";
import type { RunMetrics } from "../types";

interface HeaderProps {
  metrics: RunMetrics;
}

export function Header({ metrics }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <div className="header">
      <h1>FoveaCI Report</h1>
      <Badge pass={metrics.successRate >= 1} />
      <button className="theme-toggle" onClick={toggle}>
        {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>
    </div>
  );
}
