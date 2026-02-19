import { useState, useEffect } from "react";
import type { ReportData } from "../types";

export function useReportData() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("./report-data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((json) => setData(json as ReportData))
      .catch((err) => setError(String(err)));
  }, []);

  return { data, error };
}
