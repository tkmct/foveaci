import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Replayer } from "rrweb";
import type { eventWithTime } from "rrweb";

export interface ReplayEngine {
  play: () => void;
  pause: () => void;
  seek: (fraction: number) => void;
  setSpeed: (speed: number) => void;
  currentTime: number;
  duration: number;
  playing: boolean;
}

/**
 * rrweb v2 alpha stores CSS in `_cssText` attributes on <style> snapshot
 * nodes but leaves their text node children empty. The Replayer then
 * renders <style _csstext="..."></style> with no actual CSS rules.
 *
 * Fix: deep-clone the events and copy `_cssText` into the child text node
 * so the Replayer applies styles correctly.
 */
interface SnapshotNode {
  type: number;
  tagName?: string;
  attributes?: Record<string, string>;
  textContent?: string;
  childNodes?: SnapshotNode[];
}

function patchCssTextInNode(node: SnapshotNode): void {
  if (
    node.tagName === "style" &&
    node.attributes?._cssText &&
    node.childNodes
  ) {
    const textChild = node.childNodes.find((c) => c.type === 3);
    if (textChild && !textChild.textContent) {
      textChild.textContent = node.attributes._cssText;
    }
  }
  if (node.childNodes) {
    for (const child of node.childNodes) {
      patchCssTextInNode(child);
    }
  }
}

function patchEvents(events: unknown[]): unknown[] {
  return events.map((e) => {
    const ev = e as { type: number; data?: { node?: SnapshotNode } };
    // type 2 = FullSnapshot
    if (ev.type === 2 && ev.data?.node) {
      const patched = JSON.parse(JSON.stringify(ev));
      patchCssTextInNode(patched.data.node);
      return patched;
    }
    return ev;
  });
}

export function useReplayEngine(
  containerRef: React.RefObject<HTMLElement | null>,
  events: unknown[],
): ReplayEngine {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const replayerRef = useRef<Replayer | null>(null);
  const rafRef = useRef(0);
  const playingRef = useRef(false);

  const patchedEvents = useMemo(() => patchEvents(events), [events]);

  // Sync playing ref for rAF loop
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Create replayer when events or container change
  useEffect(() => {
    const container = containerRef.current;
    if (!container || patchedEvents.length === 0) return;

    // Clean up previous instance
    if (replayerRef.current) {
      replayerRef.current.destroy();
      replayerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    const replayer = new Replayer(patchedEvents as eventWithTime[], {
      root: container,
      speed: 1,
    });

    replayerRef.current = replayer;

    const meta = replayer.getMetaData();
    setDuration(meta.totalTime);
    setCurrentTime(0);
    setPlaying(false);
    playingRef.current = false;

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      replayer.destroy();
      replayerRef.current = null;
    };
  }, [patchedEvents, containerRef]);

  // rAF poll loop to update currentTime while playing
  const startPolling = useCallback(() => {
    function poll() {
      const replayer = replayerRef.current;
      if (!replayer || !playingRef.current) return;

      const t = replayer.getCurrentTime();
      const meta = replayer.getMetaData();
      setCurrentTime(t);

      if (t >= meta.totalTime) {
        setPlaying(false);
        playingRef.current = false;
        return;
      }

      rafRef.current = requestAnimationFrame(poll);
    }
    rafRef.current = requestAnimationFrame(poll);
  }, []);

  const play = useCallback(() => {
    const replayer = replayerRef.current;
    if (!replayer) return;

    const meta = replayer.getMetaData();
    const t = replayer.getCurrentTime();

    // If at the end, restart from beginning
    if (t >= meta.totalTime) {
      replayer.play(0);
    } else {
      replayer.play(t);
    }

    setPlaying(true);
    playingRef.current = true;
    startPolling();
  }, [startPolling]);

  const pause = useCallback(() => {
    const replayer = replayerRef.current;
    if (!replayer) return;

    replayer.pause();
    setPlaying(false);
    playingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setCurrentTime(replayer.getCurrentTime());
  }, []);

  const seek = useCallback(
    (fraction: number) => {
      const replayer = replayerRef.current;
      if (!replayer) return;

      const meta = replayer.getMetaData();
      const timeOffset = (fraction / 100) * meta.totalTime;

      if (playingRef.current) {
        replayer.play(timeOffset);
      } else {
        replayer.pause(timeOffset);
      }

      setCurrentTime(timeOffset);
    },
    [],
  );

  const setSpeed = useCallback((speed: number) => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    replayer.setConfig({ speed });
  }, []);

  return { play, pause, seek, setSpeed, currentTime, duration, playing };
}
