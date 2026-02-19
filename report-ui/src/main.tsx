import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "rrweb/dist/style.css";
import "./theme/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
