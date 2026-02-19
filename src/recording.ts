import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { RecordingConfig } from "./config.js";

/** Resolve the rrweb UMD bundle source once at module load */
const require = createRequire(import.meta.url);
const rrwebMainPath = require.resolve("rrweb");
const rrwebUmdPath = path.join(path.dirname(rrwebMainPath), "rrweb.umd.cjs");
const rrwebSource = fs.readFileSync(rrwebUmdPath, "utf-8");

/** Inject rrweb recorder and fake cursor into the page */
export async function injectRecording(
  page: Page,
  config: RecordingConfig
): Promise<void> {
  // Inject rrweb recorder via addInitScript
  if (config.rrweb) {
    const bootstrap = getBootstrapScript(config.maskInputs);
    await page.addInitScript({
      content: rrwebSource + "\n" + bootstrap,
    });
  }

  // Inject fake cursor
  if (config.fakeCursor) {
    await page.addInitScript({ content: getFakeCursorScript() });
  }
}

/** After page navigation, ensure scripts are active and retrieve events */
export async function collectRrwebEvents(page: Page): Promise<unknown[]> {
  try {
    const events = await page.evaluate(() => {
      return (window as unknown as { __fov_rrweb_events?: unknown[] })
        .__fov_rrweb_events || [];
    });
    return events as unknown[];
  } catch {
    return [];
  }
}

/** Collect console logs captured by our injected script */
export async function collectConsoleLogs(page: Page): Promise<unknown[]> {
  try {
    return (await page.evaluate(() => {
      return (window as unknown as { __fov_console_logs?: unknown[] })
        .__fov_console_logs || [];
    })) as unknown[];
  } catch {
    return [];
  }
}

/** Collect network logs captured by our injected script */
export async function collectNetworkLogs(page: Page): Promise<unknown[]> {
  try {
    return (await page.evaluate(() => {
      return (window as unknown as { __fov_network_logs?: unknown[] })
        .__fov_network_logs || [];
    })) as unknown[];
  } catch {
    return [];
  }
}

function getBootstrapScript(maskInputs: boolean): string {
  return `
(function() {
  window.__fov_rrweb_events = window.__fov_rrweb_events || [];
  window.__fov_console_logs = window.__fov_console_logs || [];
  window.__fov_network_logs = window.__fov_network_logs || [];

  // Console capture
  ['log', 'warn', 'error'].forEach(level => {
    const orig = console[level];
    console[level] = function(...args) {
      window.__fov_console_logs.push({
        level,
        timestamp: Date.now(),
        args: args.map(a => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); }
          catch { return String(a); }
        }),
      });
      orig.apply(console, args);
    };
  });

  // Network capture via Performance Observer
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const res = entry;
            window.__fov_network_logs.push({
              name: res.name,
              type: res.initiatorType,
              duration: res.duration,
              transferSize: res.transferSize || 0,
              timestamp: Date.now(),
            });
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch(e) {}
  }

  // Start rrweb recording
  if (typeof rrweb !== 'undefined' && rrweb.record) {
    rrweb.record({
      emit: function(event) {
        window.__fov_rrweb_events.push(event);
      },
      maskAllInputs: ${maskInputs},
      blockSelector: '#fov-cursor',
    });
  }
})();
`;
}

function getFakeCursorScript(): string {
  return `
(function() {
  // Create fake cursor element
  function createCursor() {
    if (document.getElementById('fov-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'fov-cursor';
    cursor.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      width: 20px;
      height: 20px;
      pointer-events: none;
      z-index: 2147483647;
      transition: none;
      transform: translate(-2px, -2px);
    \`;
    cursor.innerHTML = \`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2L3 17L7.5 12.5L12 18L14 17L9.5 11L16 10L3 2Z" fill="black" stroke="white" stroke-width="1"/>
    </svg>\`;
    (document.body || document.documentElement).appendChild(cursor);
  }

  // Track mouse position and update cursor
  document.addEventListener('mousemove', (e) => {
    createCursor();
    const cursor = document.getElementById('fov-cursor');
    if (cursor) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    }
  });

  // Click animation
  document.addEventListener('mousedown', () => {
    const cursor = document.getElementById('fov-cursor');
    if (cursor) {
      cursor.style.transform = 'translate(-2px, -2px) scale(0.8)';
    }
  });
  document.addEventListener('mouseup', () => {
    const cursor = document.getElementById('fov-cursor');
    if (cursor) {
      cursor.style.transform = 'translate(-2px, -2px) scale(1)';
    }
  });

  // Initialize cursor on load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    createCursor();
  } else {
    document.addEventListener('DOMContentLoaded', createCursor);
  }
})();
`;
}
