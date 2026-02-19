import { useEffect, useCallback, type RefObject } from "react";

export function useViewportScale(
  containerRef: RefObject<HTMLElement | null>,
) {
  const scale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // rrweb's Replayer creates: container > .replayer-wrapper > iframe
    const wrapper = container.querySelector<HTMLElement>(".replayer-wrapper");
    if (!wrapper) return;

    const iframe = wrapper.querySelector<HTMLIFrameElement>("iframe");
    if (!iframe) return;

    // Use the iframe's natural dimensions (from the recorded viewport)
    const viewportWidth = iframe.offsetWidth || 1280;
    const viewportHeight = iframe.offsetHeight || 720;

    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const s = Math.min(cw / viewportWidth, ch / viewportHeight);

    wrapper.style.transform = `scale(${s})`;
    wrapper.style.transformOrigin = "top left";
  }, [containerRef]);

  useEffect(() => {
    // Delay initial scale to let rrweb create the wrapper
    const timer = setTimeout(scale, 100);
    window.addEventListener("resize", scale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", scale);
    };
  }, [scale]);

  return scale;
}
