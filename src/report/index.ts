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
      min-height: 100vh;
    }
    .header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-pass { background: #238636; color: #fff; }
    .badge-fail { background: #da3633; color: #fff; }

    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
    }
    .metric-card .label { font-size: 12px; color: #8b949e; margin-bottom: 4px; }
    .metric-card .value { font-size: 24px; font-weight: 700; }
    .metric-card .value.pass { color: #3fb950; }
    .metric-card .value.fail { color: #f85149; }

    .sessions-list { margin-top: 24px; }
    .session-item {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .session-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }
    .session-header:hover { background: #1c2129; }
    .session-info { display: flex; align-items: center; gap: 12px; }
    .session-meta { font-size: 12px; color: #8b949e; }
    .session-body { display: none; border-top: 1px solid #30363d; }
    .session-body.active { display: block; }

    .replay-container {
      position: relative;
      background: #000;
      width: 100%;
      overflow: hidden;
    }
    .replay-iframe-wrap {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%;
    }
    .replay-viewport {
      position: absolute;
      top: 0; left: 0;
      width: 1280px;
      height: 720px;
      transform-origin: top left;
      background: #fff;
      overflow: hidden;
    }

    /* Fake cursor for replay */
    .replay-cursor {
      position: absolute;
      width: 20px;
      height: 20px;
      pointer-events: none;
      z-index: 10000;
      transition: left 0.05s linear, top 0.05s linear;
    }
    .replay-cursor svg { width: 20px; height: 20px; }
    .replay-cursor.clicking svg path { fill: #ff4444; }

    .controls {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #161b22;
      border-top: 1px solid #30363d;
    }
    .controls button {
      background: #238636;
      color: #fff;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .controls button:hover { background: #2ea043; }
    .controls .time { font-size: 12px; color: #8b949e; }
    .controls input[type="range"] { flex: 1; }

    .steps-list {
      padding: 12px 16px;
      border-top: 1px solid #30363d;
    }
    .step-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;
    }
    .step-icon { width: 16px; text-align: center; }
    .step-icon.pass { color: #3fb950; }
    .step-icon.fail { color: #f85149; }
    .step-time { color: #8b949e; font-size: 11px; }

    /* Advisor section */
    .advisor-section {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .advisor-header {
      padding: 16px;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .advisor-summary {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #8b949e;
    }
    .advisor-body { padding: 16px; }
    .advisor-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 1px solid #30363d;
    }
    .advisor-tab {
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      color: #8b949e;
      transition: all 0.2s;
    }
    .advisor-tab:hover { color: #e1e4e8; }
    .advisor-tab.active {
      color: #58a6ff;
      border-bottom-color: #58a6ff;
    }
    .advisor-content { display: none; }
    .advisor-content.active { display: block; }

    .finding-item {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .finding-header {
      display: flex;
      align-items: start;
      gap: 8px;
      margin-bottom: 8px;
    }
    .severity-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .severity-high { background: #da3633; color: #fff; }
    .severity-medium { background: #fb8500; color: #fff; }
    .severity-low { background: #58a6ff; color: #fff; }
    .finding-title { font-weight: 600; font-size: 14px; flex: 1; }
    .finding-description { color: #8b949e; font-size: 13px; margin-bottom: 8px; }
    .evidence-list {
      margin-top: 8px;
      padding-left: 16px;
      font-size: 12px;
      color: #8b949e;
    }
    .evidence-item {
      margin-bottom: 4px;
      list-style: disc;
    }
    .evidence-link {
      color: #58a6ff;
      text-decoration: none;
    }
    .evidence-link:hover { text-decoration: underline; }

    .hypothesis-item,
    .suggestion-item,
    .verification-item {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .hypothesis-category {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      background: #6e40c9;
      color: #fff;
      margin-bottom: 8px;
    }
    .suggestion-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .impact-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
    }
    .impact-high { background: #238636; color: #fff; }
    .impact-medium { background: #58a6ff; color: #fff; }
    .impact-low { background: #8b949e; color: #fff; }
  </style>
</head>
<body>
  <div class="header">
    <h1>FoveaCI Report</h1>
    <span class="badge ${metrics.successRate >= 1 ? "badge-pass" : "badge-fail"}">
      ${metrics.successRate >= 1 ? "PASS" : "FAIL"}
    </span>
  </div>

  <div class="container">
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
        <div class="label">Total Errors</div>
        <div class="value ${metrics.totalErrors > 0 ? "fail" : "pass"}">${metrics.totalErrors}</div>
      </div>
      <div class="metric-card">
        <div class="label">Rage Clicks</div>
        <div class="value ${metrics.totalRageClicks > 0 ? "fail" : "pass"}">${metrics.totalRageClicks}</div>
      </div>
    </div>

    ${
      advisorReport
        ? `
    <div class="advisor-section">
      <div class="advisor-header">
        <h2 style="margin: 0;">Advisor Insights</h2>
        <div class="advisor-summary">
          <span>Total: ${advisorReport.summary.totalFindings}</span>
          ${advisorReport.summary.highSeverityCount > 0 ? `<span style="color:#f85149;">High: ${advisorReport.summary.highSeverityCount}</span>` : ""}
          ${advisorReport.summary.mediumSeverityCount > 0 ? `<span style="color:#fb8500;">Medium: ${advisorReport.summary.mediumSeverityCount}</span>` : ""}
          ${advisorReport.summary.lowSeverityCount > 0 ? `<span>Low: ${advisorReport.summary.lowSeverityCount}</span>` : ""}
        </div>
      </div>
      <div class="advisor-body">
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
                      <a href="#session-${sessions.findIndex((s) => s.sessionId === e.sessionId)}" class="evidence-link">
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
              : '<p style="color:#8b949e;">No findings detected</p>'
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
              <div style="font-size:13px;color:#e1e4e8;margin-bottom:4px;">${escapeHtml(h.description)}</div>
              <div style="font-size:11px;color:#8b949e;">Confidence: ${h.confidence}</div>
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#8b949e;">No hypotheses generated</p>'
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
              <div style="font-size:13px;color:#8b949e;margin-bottom:8px;">${escapeHtml(s.description)}</div>
              ${s.implementation ? `<div style="font-size:12px;color:#8b949e;padding:8px;background:#0d1117;border-radius:4px;"><strong>Implementation:</strong> ${escapeHtml(s.implementation)}</div>` : ""}
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#8b949e;">No suggestions available</p>'
          }
        </div>

        <div id="advisor-verification" class="advisor-content">
          ${
            advisorReport.verification.length > 0
              ? advisorReport.verification
                  .map(
                    (v) => `
            <div class="verification-item">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;">Method</div>
              <div style="font-size:13px;color:#8b949e;margin-bottom:8px;">${escapeHtml(v.method)}</div>
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;">Expected Outcome</div>
              <div style="font-size:13px;color:#8b949e;margin-bottom:8px;">${escapeHtml(v.expectedOutcome)}</div>
              ${v.metrics ? `<div style="font-size:12px;color:#8b949e;"><strong>Metrics to track:</strong> ${v.metrics.join(", ")}</div>` : ""}
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#8b949e;">No verification steps available</p>'
          }
        </div>
      </div>
    </div>
    `
        : ""
    }

    <h2 style="margin-bottom: 12px;">Sessions</h2>
    <div class="sessions-list">
      ${sessions
        .map(
          (s, i) => `
        <div class="session-item" id="session-${i}">
          <div class="session-header" onclick="toggleSession(${i})">
            <div class="session-info">
              <span class="badge ${s.success ? "badge-pass" : "badge-fail"}">
                ${s.success ? "PASS" : "FAIL"}
              </span>
              <span>${s.sessionId}</span>
              <span class="session-meta">
                task: ${s.taskId} | persona: ${s.personaId} | ${(s.taskTimeMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
          <div class="session-body" id="session-body-${i}">
            <div class="replay-container" id="replay-container-${i}">
              <div class="replay-iframe-wrap">
                <div class="replay-viewport" id="replay-viewport-${i}"></div>
                <div class="replay-cursor" id="replay-cursor-${i}">
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 2L3 17L7.5 12.5L12 18L14 17L9.5 11L16 10L3 2Z" fill="black" stroke="white" stroke-width="1"/>
                  </svg>
                </div>
              </div>
            </div>
            <div class="controls">
              <button onclick="playReplay(${i})">Play</button>
              <button onclick="pauseReplay(${i})">Pause</button>
              <input type="range" min="0" max="100" value="0" id="timeline-${i}" oninput="seekReplay(${i}, this.value)">
              <span class="time" id="time-${i}">0:00 / 0:00</span>
              <select id="speed-${i}" onchange="setSpeed(${i}, this.value)" style="background:#21262d;color:#e1e4e8;border:1px solid #30363d;padding:4px;border-radius:4px;">
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
                <option value="0.5">0.5x</option>
              </select>
            </div>
            <div class="steps-list">
              <h3 style="font-size:14px;margin-bottom:8px;">Steps</h3>
              ${s.steps
                .map(
                  (step) => `
                <div class="step-item">
                  <span class="step-icon ${step.success ? "pass" : "fail"}">${step.success ? "✓" : "✗"}</span>
                  <span>${step.kind}</span>
                  <span class="step-time">${step.timeMs}ms</span>
                  ${step.error ? `<span style="color:#f85149;font-size:11px;">${escapeHtml(step.error)}</span>` : ""}
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  </div>

  <script>
    // Advisor tab switching
    function switchAdvisorTab(tabName) {
      // Hide all tabs
      document.querySelectorAll('.advisor-tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.advisor-content').forEach(content => content.classList.remove('active'));

      // Show selected tab
      document.querySelector('.advisor-tab[onclick*="' + tabName + '"]').classList.add('active');
      document.getElementById('advisor-' + tabName).classList.add('active');
    }

    // Embedded session data
    const sessionsData = ${JSON.stringify(
      sessions.map((s) => ({
        events: s.events,
        sessionId: s.sessionId,
      }))
    )};

    const replayers = {};

    function toggleSession(i) {
      const body = document.getElementById('session-body-' + i);
      body.classList.toggle('active');
      if (body.classList.contains('active') && !replayers[i]) {
        initReplay(i);
      }
    }

    function initReplay(i) {
      const events = sessionsData[i].events;
      if (!events || events.length === 0) {
        document.getElementById('replay-viewport-' + i).innerHTML =
          '<p style="color:#8b949e;padding:20px;">No replay events recorded</p>';
        return;
      }

      // Scale viewport to fit container
      const container = document.getElementById('replay-container-' + i);
      const wrap = container.querySelector('.replay-iframe-wrap');
      const viewport = document.getElementById('replay-viewport-' + i);
      const containerWidth = container.offsetWidth;
      const scale = containerWidth / 1280;
      viewport.style.transform = 'scale(' + scale + ')';
      wrap.style.paddingBottom = (720 * scale) + 'px';

      // Find time range
      const timestamps = events.filter(e => e.timestamp).map(e => e.timestamp);
      const startTime = Math.min(...timestamps);
      const endTime = Math.max(...timestamps);
      const duration = endTime - startTime;

      // Build initial DOM from full snapshot
      const fullSnapshot = events.find(e => e.type === 2);
      if (fullSnapshot && fullSnapshot.data && fullSnapshot.data.node) {
        const html = rebuildDom(fullSnapshot.data.node);
        viewport.innerHTML = html;
      }

      // Extract mouse events and cursor positions
      const mouseEvents = [];
      const clickEvents = [];
      for (const event of events) {
        if (event.type === 3 && event.data) {
          if (event.data.source === 1 && event.data.positions) {
            // MouseMove
            for (const pos of event.data.positions) {
              mouseEvents.push({ time: event.timestamp - startTime, x: pos.x, y: pos.y });
            }
          }
          if (event.data.source === 2 && event.data.type === 2) {
            // Click
            clickEvents.push({ time: event.timestamp - startTime, x: event.data.x, y: event.data.y });
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

      replayers[i] = {
        events, mouseEvents, clickEvents, startTime, endTime, duration,
        currentTime: 0, playing: false, speed: 1, animFrame: null,
      };

      updateTimeDisplay(i);
    }

    function rebuildDom(node) {
      if (!node) return '';
      if (node.type === 0) {
        // Document
        return (node.childNodes || []).map(c => rebuildDom(c)).join('');
      }
      if (node.type === 1) {
        // DocType
        return '<!DOCTYPE ' + (node.name || 'html') + '>';
      }
      if (node.type === 2) {
        // Element
        const tag = node.tagName || 'div';
        // Skip script tags for security
        if (tag === 'script') return '';
        // Skip our injected cursor
        if (node.attributes && node.attributes.id === 'fov-cursor') return '';

        let attrs = '';
        if (node.attributes) {
          for (const [key, val] of Object.entries(node.attributes)) {
            if (key === 'src' || key === 'href' || key === 'action') {
              // Keep structure but neutralize external links in replay
              attrs += ' ' + key + '="javascript:void(0)"';
            } else if (key === 'style') {
              attrs += ' style="' + escapeAttr(String(val)) + '"';
            } else {
              attrs += ' ' + key + '="' + escapeAttr(String(val)) + '"';
            }
          }
        }
        const children = (node.childNodes || []).map(c => rebuildDom(c)).join('');
        const voidTags = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];
        if (voidTags.includes(tag)) {
          return '<' + tag + attrs + ' />';
        }
        return '<' + tag + attrs + '>' + children + '</' + tag + '>';
      }
      if (node.type === 3) {
        // Text
        return escapeHtmlJs(node.textContent || '');
      }
      return '';
    }

    function escapeHtmlJs(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function escapeAttr(str) {
      return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function playReplay(i) {
      const r = replayers[i];
      if (!r || r.playing) return;
      r.playing = true;
      r.lastFrameTime = performance.now();

      function step(now) {
        if (!r.playing) return;
        const delta = (now - r.lastFrameTime) * r.speed;
        r.lastFrameTime = now;
        r.currentTime = Math.min(r.currentTime + delta, r.duration);

        updateCursorPosition(i);
        updateTimeDisplay(i);
        updateTimeline(i);

        if (r.currentTime >= r.duration) {
          r.playing = false;
          return;
        }
        r.animFrame = requestAnimationFrame(step);
      }
      r.animFrame = requestAnimationFrame(step);
    }

    function pauseReplay(i) {
      const r = replayers[i];
      if (!r) return;
      r.playing = false;
      if (r.animFrame) cancelAnimationFrame(r.animFrame);
    }

    function seekReplay(i, value) {
      const r = replayers[i];
      if (!r) return;
      r.currentTime = (value / 100) * r.duration;
      updateCursorPosition(i);
      updateTimeDisplay(i);
    }

    function setSpeed(i, value) {
      const r = replayers[i];
      if (!r) return;
      r.speed = parseFloat(value);
    }

    function updateCursorPosition(i) {
      const r = replayers[i];
      if (!r) return;
      const cursor = document.getElementById('replay-cursor-' + i);
      if (!cursor) return;

      // Find the latest mouse position before currentTime
      let lastPos = null;
      for (const me of r.mouseEvents) {
        if (me.time <= r.currentTime) {
          lastPos = me;
        } else {
          break;
        }
      }

      if (lastPos) {
        const container = document.getElementById('replay-container-' + i);
        const scale = container.offsetWidth / 1280;
        cursor.style.left = (lastPos.x * scale) + 'px';
        cursor.style.top = (lastPos.y * scale) + 'px';
        cursor.style.display = 'block';
      }

      // Check if there's a click happening
      const isClicking = r.clickEvents.some(ce =>
        Math.abs(ce.time - r.currentTime) < 200
      );
      if (isClicking) {
        cursor.classList.add('clicking');
      } else {
        cursor.classList.remove('clicking');
      }
    }

    function updateTimeDisplay(i) {
      const r = replayers[i];
      if (!r) return;
      const el = document.getElementById('time-' + i);
      if (el) {
        el.textContent = formatTime(r.currentTime) + ' / ' + formatTime(r.duration);
      }
    }

    function updateTimeline(i) {
      const r = replayers[i];
      if (!r) return;
      const timeline = document.getElementById('timeline-' + i);
      if (timeline && r.duration > 0) {
        timeline.value = String((r.currentTime / r.duration) * 100);
      }
    }

    function formatTime(ms) {
      const secs = Math.floor(ms / 1000);
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      return mins + ':' + String(s).padStart(2, '0');
    }
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
