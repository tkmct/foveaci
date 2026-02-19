import type { Page } from "playwright";
import type { RecordingConfig } from "./config.js";

/** Inject rrweb recorder and fake cursor into the page */
export async function injectRecording(
  page: Page,
  config: RecordingConfig
): Promise<void> {
  // Inject rrweb recorder via addInitScript
  if (config.rrweb) {
    await page.addInitScript({
      content: getRrwebRecordScript(config.maskInputs),
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

function getRrwebRecordScript(maskInputs: boolean): string {
  return `
(function() {
  // Store events globally
  window.__fov_rrweb_events = window.__fov_rrweb_events || [];
  window.__fov_console_logs = window.__fov_console_logs || [];
  window.__fov_network_logs = window.__fov_network_logs || [];

  // Console capture
  const origConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
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

  // Wait for rrweb to be injected (we'll inject the library separately)
  // For MVP, we use a MutationObserver approach to record DOM changes manually
  // But since we can't bundle rrweb in addInitScript easily, we'll use a custom
  // lightweight recording approach that produces rrweb-compatible events

  // Custom rrweb-compatible event recorder
  const EventType = { DomContentLoaded: 0, Load: 1, FullSnapshot: 2, IncrementalSnapshot: 3, Meta: 4, Custom: 5 };
  const IncrementalSource = { Mutation: 0, MouseMove: 1, MouseInteraction: 2, Scroll: 3, ViewportResize: 4, Input: 5, TouchMove: 6, MediaInteraction: 7, StyleSheetRule: 8, CanvasMutation: 9, Font: 10, Log: 11, Drag: 12, StyleDeclaration: 13 };
  const MouseInteractions = { MouseUp: 0, MouseDown: 1, Click: 2, ContextMenu: 3, DblClick: 4, Focus: 5, Blur: 6, TouchStart: 7, TouchMove_Departed: 8, TouchEnd: 9 };

  let nodeId = 0;
  const nodeMap = new WeakMap();

  function getNodeId(node) {
    if (!nodeMap.has(node)) {
      nodeMap.set(node, ++nodeId);
    }
    return nodeMap.get(node);
  }

  function serializeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let textContent = node.textContent || '';
      // Mask text in input-related elements
      if (${maskInputs} && node.parentElement) {
        const tag = node.parentElement.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || node.parentElement.getAttribute('contenteditable')) {
          textContent = textContent.replace(/./g, '*');
        }
      }
      return { type: 3, textContent, id: getNodeId(node) };
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      const attrs = {};
      for (const attr of el.attributes) {
        attrs[attr.name] = attr.value;
      }
      // Mask input values (length-preserving)
      if (${maskInputs} && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        if (attrs.value) attrs.value = '*'.repeat(attrs.value.length);
        if (attrs.placeholder) attrs.placeholder = attrs.placeholder; // keep placeholder
      }
      const childNodes = [];
      for (const child of el.childNodes) {
        childNodes.push(serializeNode(child));
      }
      return {
        type: 2,
        tagName: el.tagName.toLowerCase(),
        attributes: attrs,
        childNodes,
        id: getNodeId(node),
      };
    }
    if (node.nodeType === Node.DOCUMENT_NODE) {
      const childNodes = [];
      for (const child of node.childNodes) {
        childNodes.push(serializeNode(child));
      }
      return { type: 0, childNodes, id: getNodeId(node) };
    }
    if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
      const dt = node;
      return { type: 1, name: dt.name, publicId: dt.publicId, systemId: dt.systemId, id: getNodeId(node) };
    }
    return { type: 3, textContent: '', id: getNodeId(node) };
  }

  function pushEvent(e) {
    window.__fov_rrweb_events.push(e);
  }

  // Meta event
  pushEvent({
    type: EventType.Meta,
    data: { href: window.location.href, width: window.innerWidth, height: window.innerHeight },
    timestamp: Date.now(),
  });

  // Full snapshot on load
  function takeFullSnapshot() {
    pushEvent({
      type: EventType.FullSnapshot,
      data: { node: serializeNode(document), initialOffset: { left: window.scrollX, top: window.scrollY } },
      timestamp: Date.now(),
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    takeFullSnapshot();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      pushEvent({ type: EventType.DomContentLoaded, data: {}, timestamp: Date.now() });
      takeFullSnapshot();
    });
  }
  window.addEventListener('load', () => {
    pushEvent({ type: EventType.Load, data: {}, timestamp: Date.now() });
  });

  // Mouse move tracking
  let mouseMoveBuffer = [];
  let mouseMoveTimer = null;
  document.addEventListener('mousemove', (e) => {
    mouseMoveBuffer.push({ x: e.clientX, y: e.clientY, id: 0, timeOffset: 0 });
    if (!mouseMoveTimer) {
      mouseMoveTimer = setTimeout(() => {
        if (mouseMoveBuffer.length > 0) {
          pushEvent({
            type: EventType.IncrementalSnapshot,
            data: { source: IncrementalSource.MouseMove, positions: [...mouseMoveBuffer] },
            timestamp: Date.now(),
          });
          mouseMoveBuffer = [];
        }
        mouseMoveTimer = null;
      }, 50);
    }
  });

  // Click tracking
  document.addEventListener('click', (e) => {
    pushEvent({
      type: EventType.IncrementalSnapshot,
      data: { source: IncrementalSource.MouseInteraction, type: MouseInteractions.Click, id: getNodeId(e.target), x: e.clientX, y: e.clientY },
      timestamp: Date.now(),
    });
  });

  document.addEventListener('mousedown', (e) => {
    pushEvent({
      type: EventType.IncrementalSnapshot,
      data: { source: IncrementalSource.MouseInteraction, type: MouseInteractions.MouseDown, id: getNodeId(e.target), x: e.clientX, y: e.clientY },
      timestamp: Date.now(),
    });
  });

  document.addEventListener('mouseup', (e) => {
    pushEvent({
      type: EventType.IncrementalSnapshot,
      data: { source: IncrementalSource.MouseInteraction, type: MouseInteractions.MouseUp, id: getNodeId(e.target), x: e.clientX, y: e.clientY },
      timestamp: Date.now(),
    });
  });

  // Scroll tracking
  document.addEventListener('scroll', (e) => {
    pushEvent({
      type: EventType.IncrementalSnapshot,
      data: { source: IncrementalSource.Scroll, id: getNodeId(e.target === document ? document.documentElement : e.target), x: window.scrollX, y: window.scrollY },
      timestamp: Date.now(),
    });
  }, true);

  // Input tracking (masked)
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      const value = ${maskInputs} ? '*'.repeat((target.value || '').length) : (target.value || '');
      pushEvent({
        type: EventType.IncrementalSnapshot,
        data: { source: IncrementalSource.Input, text: value, isChecked: target.checked || false, id: getNodeId(target) },
        timestamp: Date.now(),
      });
    }
  }, true);

  // Viewport resize
  window.addEventListener('resize', () => {
    pushEvent({
      type: EventType.IncrementalSnapshot,
      data: { source: IncrementalSource.ViewportResize, width: window.innerWidth, height: window.innerHeight },
      timestamp: Date.now(),
    });
  });

  // MutationObserver for DOM changes
  const observer = new MutationObserver((mutations) => {
    const adds = [];
    const removes = [];
    const attrs = [];
    const texts = [];

    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          adds.push({
            parentId: getNodeId(m.target),
            nextId: m.nextSibling ? getNodeId(m.nextSibling) : null,
            node: serializeNode(node),
          });
        }
        for (const node of m.removedNodes) {
          removes.push({ parentId: getNodeId(m.target), id: getNodeId(node) });
        }
      } else if (m.type === 'attributes') {
        const el = m.target;
        let value = el.getAttribute(m.attributeName) || '';
        // Mask values
        if (${maskInputs} && m.attributeName === 'value' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          value = '*'.repeat(value.length);
        }
        attrs.push({ id: getNodeId(m.target), attributes: { [m.attributeName]: value } });
      } else if (m.type === 'characterData') {
        let val = m.target.textContent || '';
        if (${maskInputs} && m.target.parentElement) {
          const tag = m.target.parentElement.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea') val = '*'.repeat(val.length);
        }
        texts.push({ id: getNodeId(m.target), value: val });
      }
    }

    if (adds.length || removes.length || attrs.length || texts.length) {
      pushEvent({
        type: EventType.IncrementalSnapshot,
        data: {
          source: IncrementalSource.Mutation,
          adds, removes,
          attributes: attrs,
          texts,
        },
        timestamp: Date.now(),
      });
    }
  });

  function startObserver() {
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, characterData: true, attributeOldValue: true,
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
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

  // Also push cursor events for rrweb custom events
  document.addEventListener('mousemove', (e) => {
    if (window.__fov_rrweb_events) {
      window.__fov_rrweb_events.push({
        type: 5, // Custom
        data: {
          tag: 'fov-cursor',
          payload: { x: e.clientX, y: e.clientY },
        },
        timestamp: Date.now(),
      });
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
