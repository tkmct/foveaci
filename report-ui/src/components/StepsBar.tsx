import { IconCheck, IconX } from "@tabler/icons-react";
import type { StepResult } from "../types";

interface StepsBarProps {
  steps: StepResult[];
}

export function StepsBar({ steps }: StepsBarProps) {
  return (
    <div className="steps-bar">
      {steps.map((step, i) => (
        <div key={i} className={`step-chip ${step.success ? "pass" : "fail"}`}>
          {step.success ? <IconCheck size={14} /> : <IconX size={14} />}{" "}
          {step.kind}
          <span className="step-time">{step.timeMs}ms</span>
          {step.error && <span className="step-error">{step.error}</span>}
        </div>
      ))}
    </div>
  );
}
