import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";

interface BadgeProps {
  pass: boolean;
}

export function Badge({ pass }: BadgeProps) {
  return (
    <span className={`badge ${pass ? "badge-pass" : "badge-fail"}`}>
      {pass ? (
        <>
          <IconCircleCheck size={12} /> PASS
        </>
      ) : (
        <>
          <IconCircleX size={12} /> FAIL
        </>
      )}
    </span>
  );
}
