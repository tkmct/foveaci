#!/usr/bin/env node

const DEFAULT_MARKER = "<!-- fov-pr-ux-eval -->";
const PERMISSION_RANK = {
  none: 0,
  read: 1,
  triage: 2,
  write: 3,
  maintain: 4,
  admin: 5,
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[name] = value;
  }
  return args;
}

async function githubRequest(path, token, method = "GET", body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "foveaci-reaction-approval",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed: ${response.status} ${text}`);
  }

  return response.json();
}

function parseRepo(repo) {
  const [owner, name] = String(repo || "").split("/");
  if (!owner || !name) {
    throw new Error(`Invalid repo: ${repo}`);
  }
  return { owner, name };
}

function parseStatus(body) {
  const match = String(body || "").match(/^- Status:\s+\*\*(.+?)\*\*/m);
  return match ? match[1] : "";
}

async function getPermission(owner, repo, username, token) {
  try {
    const data = await githubRequest(
      `/repos/${owner}/${repo}/collaborators/${username}/permission`,
      token
    );
    return typeof data.permission === "string" ? data.permission : "none";
  } catch {
    return "none";
  }
}

const args = parseArgs(process.argv);
const repoArg = args.repo;
const prNumber = Number(args["pr-number"] || "0");
const token = args.token || process.env.GITHUB_TOKEN;
const marker = args.marker || DEFAULT_MARKER;
const reaction = args.reaction || "+1";
const minPermission = String(args["min-permission"] || "write");
const asJson = String(args.json || "false") === "true";

if (!repoArg || !prNumber || !token) {
  console.error(
    "Usage: node scripts/check_reaction_approval.mjs --repo <owner/repo> --pr-number <number> [--token <token>] [--marker '<!-- marker -->'] [--reaction +1] [--min-permission write] [--json]"
  );
  process.exit(1);
}

if (!(minPermission in PERMISSION_RANK)) {
  console.error(`Unsupported min permission: ${minPermission}`);
  process.exit(1);
}

const { owner, name: repo } = parseRepo(repoArg);
const comments = await githubRequest(
  `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
  token
);

const stickyComments = comments
  .filter(
    (comment) =>
      typeof comment.body === "string" &&
      comment.body.includes(marker) &&
      comment.user?.login === "github-actions[bot]"
  )
  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

const latest = stickyComments[0];
if (!latest) {
  const out = {
    approved: false,
    reason: "sticky_comment_not_found",
    commentId: null,
    status: null,
    approvers: [],
  };
  if (asJson) {
    console.log(JSON.stringify(out));
  } else {
    console.log("[fov] No sticky preview comment found");
  }
  process.exit(0);
}

const status = parseStatus(latest.body || "");
if (status.toLowerCase().includes("executed")) {
  const out = {
    approved: false,
    reason: "already_executed",
    commentId: latest.id,
    status,
    approvers: [],
  };
  if (asJson) {
    console.log(JSON.stringify(out));
  } else {
    console.log(`[fov] Latest sticky comment already executed (comment=${latest.id})`);
  }
  process.exit(0);
}

const reactions = await githubRequest(
  `/repos/${owner}/${repo}/issues/comments/${latest.id}/reactions?per_page=100`,
  token
);
const commentUpdatedAt = new Date(latest.updated_at).getTime();
const validReactions = reactions.filter(
  (entry) =>
    entry.content === reaction &&
    entry.user?.login &&
    new Date(entry.created_at).getTime() >= commentUpdatedAt
);

const uniqueUsers = [...new Set(validReactions.map((entry) => entry.user.login))];
const approvers = [];
for (const login of uniqueUsers) {
  const permission = await getPermission(owner, repo, login, token);
  if ((PERMISSION_RANK[permission] || 0) >= PERMISSION_RANK[minPermission]) {
    approvers.push({ login, permission });
  }
}

const output = {
  approved: approvers.length > 0,
  reason: approvers.length > 0 ? "approved" : "missing_valid_reaction",
  commentId: latest.id,
  commentUpdatedAt: latest.updated_at,
  status,
  requiredReaction: reaction,
  minPermission,
  validReactionCount: validReactions.length,
  approvers,
};

if (asJson) {
  console.log(JSON.stringify(output));
} else if (output.approved) {
  const users = approvers.map((entry) => `${entry.login}(${entry.permission})`).join(", ");
  console.log(
    `[fov] Approved via reaction ${reaction} on comment ${latest.id} by ${users}`
  );
} else {
  console.log(
    `[fov] Not approved yet (comment=${latest.id}; reaction=${reaction}; validReactions=${validReactions.length})`
  );
}
