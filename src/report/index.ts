import * as fs from "node:fs";
import * as path from "node:path";
import type { SessionResult } from "../runner.js";
import type { RunMetrics } from "../metrics.js";
import type { AdvisorReport } from "../advisor.js";

export async function generateReport(
  sessions: SessionResult[],
  metrics: RunMetrics,
  outDir: string,
  advisorReport?: AdvisorReport | null
): Promise<void> {
  const reportDir = path.join(outDir, "report");
  fs.mkdirSync(reportDir, { recursive: true });

  // Load rrweb events for each session
  const sessionData = sessions.map((session) => {
    let events: unknown[] = [];
    try {
      events = JSON.parse(fs.readFileSync(session.rrwebEventsFile, "utf-8"));
    } catch {
      // Empty events
    }
    return {
      ...session,
      events,
    };
  });

  const html = generateHtml(sessionData, metrics, advisorReport);
  fs.writeFileSync(path.join(reportDir, "index.html"), html);
}

function generateHtml(
  sessions: Array<SessionResult & { events: unknown[] }>,
  metrics: RunMetrics,
  advisorReport?: AdvisorReport | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FoveaCI Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e1e4e8;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      height: 48px;
    }
    .header h1 { font-size: 16px; font-weight: 600; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pass { background: #238636; color: #fff; }
    .badge-fail { background: #da3633; color: #fff; }

    .layout {
      display: flex;
      height: calc(100vh - 48px);
    }

    /* Left sidebar */
    .sidebar {
      width: 360px;
      min-width: 360px;
      border-right: 1px solid #30363d;
      overflow-y: auto;
      background: #0f1117;
    }
    .sidebar-section { padding: 16px; border-bottom: 1px solid #30363d; }
    .sidebar-section h2 { font-size: 13px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .metric-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px;
    }
    .metric-card .label { font-size: 11px; color: #8b949e; margin-bottom: 2px; }
    .metric-card .value { font-size: 18px; font-weight: 700; }
    .metric-card .value.pass { color: #3fb950; }
    .metric-card .value.fail { color: #f85149; }

    .session-item {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .session-item:hover { border-color: #58a6ff; }
    .session-item.selected { border-color: #58a6ff; background: #1c2129; }
    .session-header {
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .session-name { font-size: 13px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .session-meta { font-size: 11px; color: #8b949e; }

    /* Advisor in sidebar */
    .advisor-section { margin: 0; }
    .advisor-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 10px;
      border-bottom: 1px solid #30363d;
    }
    .advisor-tab {
      padding: 6px 10px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      color: #8b949e;
      font-size: 12px;
      transition: all 0.15s;
    }
    .advisor-tab:hover { color: #e1e4e8; }
    .advisor-tab.active { color: #58a6ff; border-bottom-color: #58a6ff; }
    .advisor-content { display: none; }
    .advisor-content.active { display: block; }
    .finding-item {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .finding-header { display: flex; align-items: start; gap: 6px; margin-bottom: 6px; }
    .severity-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .severity-high { background: #da3633; color: #fff; }
    .severity-medium { background: #fb8500; color: #fff; }
    .severity-low { background: #58a6ff; color: #fff; }
    .finding-title { font-weight: 600; font-size: 13px; flex: 1; }
    .finding-description { color: #8b949e; font-size: 12px; margin-bottom: 6px; }
    .evidence-list { margin-top: 6px; padding-left: 14px; font-size: 11px; color: #8b949e; }
    .evidence-item { margin-bottom: 3px; list-style: disc; }
    .evidence-link { color: #58a6ff; text-decoration: none; cursor: pointer; }
    .evidence-link:hover { text-decoration: underline; }
    .hypothesis-item, .suggestion-item, .verification-item {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .hypothesis-category {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      background: #6e40c9;
      color: #fff;
      margin-bottom: 6px;
    }
    .suggestion-title { font-weight: 600; font-size: 13px; margin-bottom: 3px; }
    .impact-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 6px;
    }
    .impact-high { background: #238636; color: #fff; }
    .impact-medium { background: #58a6ff; color: #fff; }
    .impact-low { background: #8b949e; color: #fff; }

    /* Right main area - replay */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #000;
    }
    .main-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #484f58;
      font-size: 14px;
    }

    .replay-container {
      position: relative;
      flex: 1;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .replay-iframe-wrap {
      position: relative;
    }
    .replay-viewport {
      width: 1280px;
      height: 720px;
      transform-origin: top left;
      background: #fff;
      overflow: hidden;
    }
    .replay-cursor {
      position: absolute;
      width: 20px;
      height: 20px;
      pointer-events: none;
      z-index: 10000;
      transition: none;
      display: none;
    }
    .replay-cursor svg { width: 20px; height: 20px; }
    .replay-cursor.clicking svg path { fill: #ff4444; }

    .controls {
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #161b22;
      border-top: 1px solid #30363d;
      height: 44px;
    }
    .controls button {
      background: #238636;
      color: #fff;
      border: none;
      padding: 4px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .controls button:hover { background: #2ea043; }
    .controls .time { font-size: 12px; color: #8b949e; white-space: nowrap; }
    .controls input[type="range"] { flex: 1; }

    .steps-bar {
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #161b22;
      border-top: 1px solid #30363d;
      overflow-x: auto;
      height: 36px;
    }
    .step-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      white-space: nowrap;
      padding: 2px 8px;
      border-radius: 4px;
      background: #21262d;
    }
    .step-chip.pass { border-left: 3px solid #3fb950; }
    .step-chip.fail { border-left: 3px solid #f85149; }
    .step-chip .step-time { color: #8b949e; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>FoveaCI Report</h1>
    <span class="badge ${metrics.successRate >= 1 ? "badge-pass" : "badge-fail"}">
      ${metrics.successRate >= 1 ? "PASS" : "FAIL"}
    </span>
  </div>

  <div class="layout">
    <div class="sidebar">
      <div class="sidebar-section">
        <h2>Metrics</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="label">Success Rate</div>
            <div class="value ${metrics.successRate >= 0.95 ? "pass" : "fail"}">
              ${(metrics.successRate * 100).toFixed(1)}%
            </div>
          </div>
          <div class="metric-card">
            <div class="label">Median Time</div>
            <div class="value">${(metrics.medianTaskTimeMs / 1000).toFixed(1)}s</div>
          </div>
          <div class="metric-card">
            <div class="label">p95 Time</div>
            <div class="value">${(metrics.p95TaskTimeMs / 1000).toFixed(1)}s</div>
          </div>
          <div class="metric-card">
            <div class="label">Sessions</div>
            <div class="value">${metrics.totalSessions}</div>
          </div>
          <div class="metric-card">
            <div class="label">Errors</div>
            <div class="value ${metrics.totalErrors > 0 ? "fail" : "pass"}">${metrics.totalErrors}</div>
          </div>
          <div class="metric-card">
            <div class="label">Rage Clicks</div>
            <div class="value ${metrics.totalRageClicks > 0 ? "fail" : "pass"}">${metrics.totalRageClicks}</div>
          </div>
        </div>
      </div>

      ${
        advisorReport
          ? `
      <div class="sidebar-section advisor-section">
        <h2>Advisor
          <span style="font-size:11px;font-weight:400;color:#8b949e;text-transform:none;letter-spacing:0;margin-left:4px;">
            ${advisorReport.summary.totalFindings} finding(s)
            ${advisorReport.summary.highSeverityCount > 0 ? `<span style="color:#f85149;">/ ${advisorReport.summary.highSeverityCount} high</span>` : ""}
          </span>
        </h2>
        <div class="advisor-tabs">
          <div class="advisor-tab active" onclick="switchAdvisorTab('findings')">Findings</div>
          <div class="advisor-tab" onclick="switchAdvisorTab('hypotheses')">Hypotheses</div>
          <div class="advisor-tab" onclick="switchAdvisorTab('suggestions')">Suggestions</div>
          <div class="advisor-tab" onclick="switchAdvisorTab('verification')">Verification</div>
        </div>

        <div id="advisor-findings" class="advisor-content active">
          ${
            advisorReport.findings.length > 0
              ? advisorReport.findings
                  .map(
                    (f) => `
          <div class="finding-item">
            <div class="finding-header">
              <span class="severity-badge severity-${f.severity}">${f.severity}</span>
              <div class="finding-title">${escapeHtml(f.title)}</div>
            </div>
            <div class="finding-description">${escapeHtml(f.description)}</div>
            ${
              f.evidence.length > 0
                ? `
              <ul class="evidence-list">
                ${f.evidence
                  .map(
                    (e) => `
                  <li class="evidence-item">
                    <a class="evidence-link" onclick="selectSessionById('${e.sessionId}')">
                      ${escapeHtml(e.sessionId)}${e.stepIndex !== undefined ? ` (step ${e.stepIndex})` : ""}
                    </a>: ${escapeHtml(e.description)}
                  </li>
                `
                  )
                  .join("")}
              </ul>
            `
                : ""
            }
          </div>
        `
                  )
                  .join("")
              : '<p style="color:#8b949e;font-size:12px;">No findings detected</p>'
          }
        </div>

        <div id="advisor-hypotheses" class="advisor-content">
          ${
            advisorReport.hypotheses.length > 0
              ? advisorReport.hypotheses
                  .map(
                    (h) => `
          <div class="hypothesis-item">
            <div class="hypothesis-category">${h.category.replace(/_/g, " ")}</div>
            <div style="font-size:12px;color:#e1e4e8;margin-bottom:3px;">${escapeHtml(h.description)}</div>
            <div style="font-size:10px;color:#8b949e;">Confidence: ${h.confidence}</div>
          </div>
        `
                  )
                  .join("")
              : '<p style="color:#8b949e;font-size:12px;">No hypotheses generated</p>'
          }
        </div>

        <div id="advisor-suggestions" class="advisor-content">
          ${
            advisorReport.suggestions.length > 0
              ? advisorReport.suggestions
                  .map(
                    (s) => `
          <div class="suggestion-item">
            <div class="suggestion-title">
              ${escapeHtml(s.title)}
              <span class="impact-badge impact-${s.expectedImpact}">Impact: ${s.expectedImpact}</span>
            </div>
            <div style="font-size:12px;color:#8b949e;margin-bottom:6px;">${escapeHtml(s.description)}</div>
            ${s.implementation ? `<div style="font-size:11px;color:#8b949e;padding:6px;background:#0d1117;border-radius:4px;"><strong>Impl:</strong> ${escapeHtml(s.implementation)}</div>` : ""}
          </div>
        `
                  )
                  .join("")
              : '<p style="color:#8b949e;font-size:12px;">No suggestions available</p>'
          }
        </div>

        <div id="advisor-verification" class="advisor-content">
          ${
            advisorReport.verification.length > 0
              ? advisorReport.verification
                  .map(
                    (v) => `
          <div class="verification-item">
            <div style="font-weight:600;font-size:12px;margin-bottom:3px;">Method</div>
            <div style="font-size:12px;color:#8b949e;margin-bottom:6px;">${escapeHtml(v.method)}</div>
            <div style="font-weight:600;font-size:12px;margin-bottom:3px;">Expected</div>
            <div style="font-size:12px;color:#8b949e;margin-bottom:6px;">${escapeHtml(v.expectedOutcome)}</div>
            ${v.metrics ? `<div style="font-size:11px;color:#8b949e;"><strong>Metrics:</strong> ${v.metrics.join(", ")}</div>` : ""}
          </div>
        `
                  )
                  .join("")
              : '<p style="color:#8b949e;font-size:12px;">No verification steps available</p>'
          }
        </div>
      </div>
      `
          : ""
      }

      <div class="sidebar-section">
        <h2>Sessions</h2>
        ${sessions
          .map(
            (s, i) => `
          <div class="session-item" id="session-${i}" onclick="selectSession(${i})">
            <div class="session-header">
              <span class="badge ${s.success ? "badge-pass" : "badge-fail"}">${s.success ? "PASS" : "FAIL"}</span>
              <span class="session-name">${s.sessionId}</span>
              <span class="session-meta">${(s.taskTimeMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>

    <div class="main">
      <div class="main-empty" id="main-empty">Select a session to view replay</div>
      <div class="replay-container" id="replay-container" style="display:none;">
        <div class="replay-iframe-wrap" id="replay-wrap">
          <div class="replay-viewport" id="replay-viewport"></div>
          <div class="replay-cursor" id="replay-cursor">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 2L3 17L7.5 12.5L12 18L14 17L9.5 11L16 10L3 2Z" fill="black" stroke="white" stroke-width="1"/>
            </svg>
          </div>
        </div>
      </div>
      <div id="controls-bar" style="display:none;">
        <div class="controls">
          <button onclick="playReplay()">Play</button>
          <button onclick="pauseReplay()">Pause</button>
          <input type="range" min="0" max="100" value="0" id="timeline" oninput="seekReplay(this.value)">
          <span class="time" id="time-display">0:00 / 0:00</span>
          <select id="speed-select" onchange="setSpeed(this.value)" style="background:#21262d;color:#e1e4e8;border:1px solid #30363d;padding:3px;border-radius:4px;font-size:12px;">
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
            <option value="0.5">0.5x</option>
          </select>
        </div>
        <div class="steps-bar" id="steps-bar"></div>
      </div>
    </div>
  </div>

  <script>
    function switchAdvisorTab(tabName) {
      document.querySelectorAll('.advisor-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.advisor-content').forEach(c => c.classList.remove('active'));
      document.querySelector('.advisor-tab[onclick*="' + tabName + '"]').classList.add('active');
      document.getElementById('advisor-' + tabName).classList.add('active');
    }

    const sessionsData = ${JSON.stringify(
      sessions.map((s) => ({
        events: s.events,
        sessionId: s.sessionId,
        steps: s.steps,
      }))
    )};

    let replayer = null;
    let currentSessionIndex = -1;

    function selectSessionById(sessionId) {
      const idx = sessionsData.findIndex(s => s.sessionId === sessionId);
      if (idx >= 0) selectSession(idx);
    }

    function selectSession(i) {
      // Update sidebar selection
      document.querySelectorAll('.session-item').forEach(el => el.classList.remove('selected'));
      document.getElementById('session-' + i).classList.add('selected');

      // Stop any playing replay
      if (replayer && replayer.playing) {
        replayer.playing = false;
        if (replayer.animFrame) cancelAnimationFrame(replayer.animFrame);
      }

      currentSessionIndex = i;
      document.getElementById('main-empty').style.display = 'none';
      document.getElementById('replay-container').style.display = 'flex';
      document.getElementById('controls-bar').style.display = 'block';

      initReplay(i);
    }

    function initReplay(i) {
      const data = sessionsData[i];
      const events = data.events;
      const viewport = document.getElementById('replay-viewport');
      const cursor = document.getElementById('replay-cursor');
      cursor.style.display = 'none';

      if (!events || events.length === 0) {
        viewport.innerHTML = '<p style="color:#8b949e;padding:20px;">No replay events recorded</p>';
        return;
      }

      // Compute scale to fit the right panel
      scaleViewport();

      // Find time range
      const timestamps = events.filter(e => e.timestamp).map(e => e.timestamp);
      const startTime = Math.min(...timestamps);
      const endTime = Math.max(...timestamps);
      const duration = endTime - startTime;

      // Extract events by type
      const mouseEvents = [];
      const clickEvents = [];
      const mutationEvents = [];
      const inputEvents = [];
      for (const event of events) {
        if (event.type === 3 && event.data) {
          if (event.data.source === 0) {
            // DOM Mutation
            mutationEvents.push({ time: event.timestamp - startTime, data: event.data });
          }
          // source=1 (MouseMove) intentionally skipped - use fov-cursor custom events only
          // to avoid duplicate/interleaved positions causing cursor jumps
          if (event.data.source === 2 && event.data.type === 2) {
            clickEvents.push({ time: event.timestamp - startTime, x: event.data.x, y: event.data.y });
          }
          if (event.data.source === 5 && event.data.id) {
            // Input value change
            inputEvents.push({ time: event.timestamp - startTime, id: event.data.id, text: event.data.text || '' });
          }
        }
        if (event.type === 5 && event.data && event.data.tag === 'fov-cursor') {
          mouseEvents.push({
            time: event.timestamp - startTime,
            x: event.data.payload.x,
            y: event.data.payload.y,
          });
        }
      }

      replayer = {
        events, mouseEvents, clickEvents, mutationEvents, inputEvents, startTime, endTime, duration,
        currentTime: 0, playing: false, speed: 1, animFrame: null,
        lastMutationIndex: -1, lastInputIndex: -1, lastMouseIndex: 0,
      };

      // Build initial DOM from full snapshot
      rebuildDomFromSnapshot();

      // Render steps bar
      const stepsBar = document.getElementById('steps-bar');
      stepsBar.innerHTML = data.steps.map(function(step) {
        return '<div class="step-chip ' + (step.success ? 'pass' : 'fail') + '">'
          + '<span>' + (step.success ? '\\u2713' : '\\u2717') + '</span> '
          + step.kind
          + ' <span class="step-time">' + step.timeMs + 'ms</span>'
          + (step.error ? ' <span style="color:#f85149;">' + escapeHtmlJs(step.error) + '</span>' : '')
          + '</div>';
      }).join('');

      // Reset controls
      document.getElementById('timeline').value = '0';
      document.getElementById('speed-select').value = '1';
      updateTimeDisplay();
    }

    function scaleViewport() {
      const container = document.getElementById('replay-container');
      const wrap = document.getElementById('replay-wrap');
      const viewport = document.getElementById('replay-viewport');
      const cw = container.offsetWidth;
      const ch = container.offsetHeight;
      const scaleX = cw / 1280;
      const scaleY = ch / 720;
      const scale = Math.min(scaleX, scaleY);
      viewport.style.transform = 'scale(' + scale + ')';
      wrap.style.width = (1280 * scale) + 'px';
      wrap.style.height = (720 * scale) + 'px';
    }

    window.addEventListener('resize', function() {
      if (currentSessionIndex >= 0) {
        scaleViewport();
        updateCursorPosition();
      }
    });

    // ---- DOM replay engine ----
    let nodeMap = {};

    function buildDomNode(nodeData) {
      if (!nodeData) return null;
      if (nodeData.type === 0) {
        // Document node
        const frag = document.createDocumentFragment();
        for (const child of (nodeData.childNodes || [])) {
          const n = buildDomNode(child);
          if (n) frag.appendChild(n);
        }
        return frag;
      }
      if (nodeData.type === 1) return null; // DocType - skip
      if (nodeData.type === 2) {
        // Element
        const tag = (nodeData.tagName || 'div').toLowerCase();
        if (tag === 'script') return null;
        if (nodeData.attributes && nodeData.attributes.id === 'fov-cursor') return null;
        let el;
        try { el = document.createElement(tag); } catch(e) { return null; }
        if (nodeData.id) nodeMap[nodeData.id] = el;
        if (nodeData.attributes) {
          for (const [key, val] of Object.entries(nodeData.attributes)) {
            if (key === 'src' || key === 'href' || key === 'action') {
              // Neutralize navigation in replay
            } else {
              try { el.setAttribute(key, String(val)); } catch(e) {}
            }
          }
        }
        for (const child of (nodeData.childNodes || [])) {
          const n = buildDomNode(child);
          if (n) el.appendChild(n);
        }
        return el;
      }
      if (nodeData.type === 3) {
        // Text node
        const tn = document.createTextNode(nodeData.textContent || '');
        if (nodeData.id) nodeMap[nodeData.id] = tn;
        return tn;
      }
      return null;
    }

    function applyMutation(mut) {
      const d = mut.data;
      // Removes
      for (const rem of (d.removes || [])) {
        const node = nodeMap[rem.id];
        if (node && node.parentNode) node.parentNode.removeChild(node);
      }
      // Adds
      for (const add of (d.adds || [])) {
        const parent = nodeMap[add.parentId];
        if (!parent) continue;
        const newNode = buildDomNode(add.node);
        if (!newNode) continue;
        if (add.nextId && nodeMap[add.nextId] && nodeMap[add.nextId].parentNode === parent) {
          parent.insertBefore(newNode, nodeMap[add.nextId]);
        } else {
          parent.appendChild(newNode);
        }
      }
      // Attributes
      for (const attr of (d.attributes || [])) {
        const el = nodeMap[attr.id];
        if (!el || !el.setAttribute) continue;
        // Skip fov-cursor style updates in replay
        if (el.getAttribute && el.getAttribute('id') === 'fov-cursor') continue;
        for (const [key, val] of Object.entries(attr.attributes)) {
          if (val === null) { try { el.removeAttribute(key); } catch(e) {} }
          else { try { el.setAttribute(key, String(val)); } catch(e) {} }
        }
      }
      // Texts
      for (const txt of (d.texts || [])) {
        const node = nodeMap[txt.id];
        if (node) node.textContent = txt.value || '';
      }
    }

    function rebuildDomFromSnapshot() {
      nodeMap = {};
      const viewport = document.getElementById('replay-viewport');
      viewport.innerHTML = '';
      const fullSnapshot = replayer.events.find(function(e) { return e.type === 2; });
      if (fullSnapshot && fullSnapshot.data && fullSnapshot.data.node) {
        const domNode = buildDomNode(fullSnapshot.data.node);
        if (domNode) viewport.appendChild(domNode);
      }
      replayer.lastMutationIndex = -1;
      replayer.lastInputIndex = -1;
    }

    function applyInputsUpTo(time) {
      const start = replayer.lastInputIndex + 1;
      for (let i = start; i < replayer.inputEvents.length; i++) {
        if (replayer.inputEvents[i].time <= time) {
          const inp = replayer.inputEvents[i];
          const el = nodeMap[inp.id];
          if (el) {
            if (el.setAttribute) el.setAttribute('value', inp.text);
            if ('value' in el) el.value = inp.text;
          }
          replayer.lastInputIndex = i;
        } else {
          break;
        }
      }
    }

    function applyEventsUpTo(time) {
      // Apply mutations
      const mStart = replayer.lastMutationIndex + 1;
      for (let i = mStart; i < replayer.mutationEvents.length; i++) {
        if (replayer.mutationEvents[i].time <= time) {
          applyMutation(replayer.mutationEvents[i]);
          replayer.lastMutationIndex = i;
        } else {
          break;
        }
      }
      // Apply inputs
      applyInputsUpTo(time);
    }

    function seekToTime(time) {
      if (time < replayer.currentTime) {
        // Going backward: rebuild from scratch
        rebuildDomFromSnapshot();
        replayer.lastMouseIndex = 0;
      }
      applyEventsUpTo(time);
      replayer.currentTime = time;
    }
    // ---- End DOM replay engine ----

    function escapeHtmlJs(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function playReplay() {
      if (!replayer || replayer.playing) return;
      replayer.playing = true;
      replayer.lastFrameTime = performance.now();
      function step(now) {
        if (!replayer.playing) return;
        const delta = (now - replayer.lastFrameTime) * replayer.speed;
        replayer.lastFrameTime = now;
        const newTime = Math.min(replayer.currentTime + delta, replayer.duration);
        applyEventsUpTo(newTime);
        replayer.currentTime = newTime;
        updateCursorPosition();
        updateTimeDisplay();
        updateTimeline();
        if (replayer.currentTime >= replayer.duration) { replayer.playing = false; return; }
        replayer.animFrame = requestAnimationFrame(step);
      }
      replayer.animFrame = requestAnimationFrame(step);
    }

    function pauseReplay() {
      if (!replayer) return;
      replayer.playing = false;
      if (replayer.animFrame) cancelAnimationFrame(replayer.animFrame);
    }

    function seekReplay(value) {
      if (!replayer) return;
      seekToTime((value / 100) * replayer.duration);
      updateCursorPosition();
      updateTimeDisplay();
    }

    function setSpeed(value) {
      if (!replayer) return;
      replayer.speed = parseFloat(value);
    }

    function updateCursorPosition() {
      if (!replayer) return;
      const cursor = document.getElementById('replay-cursor');
      const me = replayer.mouseEvents;
      const t = replayer.currentTime;

      // Find bracketing events for interpolation
      let prevIdx = -1;
      for (let i = replayer.lastMouseIndex || 0; i < me.length; i++) {
        if (me[i].time <= t) prevIdx = i;
        else break;
      }
      // Handle backward seek
      if (prevIdx < 0) {
        for (let i = 0; i < me.length; i++) {
          if (me[i].time <= t) prevIdx = i;
          else break;
        }
      }
      replayer.lastMouseIndex = Math.max(0, prevIdx);

      if (prevIdx >= 0) {
        const wrap = document.getElementById('replay-wrap');
        const scale = wrap.offsetWidth / 1280;
        let x, y;

        // Only interpolate during active mouse movement (events < 100ms apart).
        // Larger gaps mean the mouse is idle (e.g. during typing) — hold position.
        if (prevIdx + 1 < me.length && (me[prevIdx + 1].time - me[prevIdx].time) < 100) {
          const prev = me[prevIdx];
          const next = me[prevIdx + 1];
          const span = next.time - prev.time;
          const frac = span > 0 ? Math.min(1, (t - prev.time) / span) : 0;
          x = prev.x + (next.x - prev.x) * frac;
          y = prev.y + (next.y - prev.y) * frac;
        } else {
          x = me[prevIdx].x;
          y = me[prevIdx].y;
        }

        cursor.style.left = (x * scale) + 'px';
        cursor.style.top = (y * scale) + 'px';
        cursor.style.display = 'block';
      }
      const isClicking = replayer.clickEvents.some(ce => Math.abs(ce.time - replayer.currentTime) < 200);
      cursor.classList.toggle('clicking', isClicking);
    }

    function updateTimeDisplay() {
      if (!replayer) return;
      document.getElementById('time-display').textContent = formatTime(replayer.currentTime) + ' / ' + formatTime(replayer.duration);
    }

    function updateTimeline() {
      if (!replayer || !replayer.duration) return;
      document.getElementById('timeline').value = String((replayer.currentTime / replayer.duration) * 100);
    }

    function formatTime(ms) {
      const secs = Math.floor(ms / 1000);
      return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    }

    // Auto-select first session
    if (sessionsData.length > 0) selectSession(0);
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
