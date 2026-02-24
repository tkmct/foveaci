#!/usr/bin/env node
import fs from "node:fs";

const DEFAULT_MARKER = "<!-- fov-pr-ux-eval -->";

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
      "User-Agent": "foveaci-pr-ux-eval",
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

const args = parseArgs(process.argv);
const repo = args.repo;
const prNumber = Number(args["pr-number"] || "0");
const token = args.token || process.env.GITHUB_TOKEN;
const bodyFile = args["body-file"];
const marker = args.marker || DEFAULT_MARKER;

if (!repo || !prNumber || !token || !bodyFile) {
  console.error(
    "Usage: node scripts/post_pr_comment.mjs --repo <owner/repo> --pr-number <number> --body-file <comment.md> [--token <token>] [--marker '<!-- marker -->']"
  );
  process.exit(1);
}

const [owner, repoName] = repo.split("/");
if (!owner || !repoName) {
  console.error(`Invalid repo value: ${repo}`);
  process.exit(1);
}

const body = fs.readFileSync(bodyFile, "utf-8");
if (!body.includes(marker)) {
  console.error(`Comment body must include marker: ${marker}`);
  process.exit(1);
}

const comments = await githubRequest(
  `/repos/${owner}/${repoName}/issues/${prNumber}/comments?per_page=100`,
  token
);
const existing = comments
  .filter((comment) => typeof comment.body === "string" && comment.body.includes(marker))
  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

if (existing) {
  await githubRequest(
    `/repos/${owner}/${repoName}/issues/comments/${existing.id}`,
    token,
    "PATCH",
    { body }
  );
  console.log(`[fov] Updated sticky comment (${existing.id}) on PR #${prNumber}`);
} else {
  const created = await githubRequest(
    `/repos/${owner}/${repoName}/issues/${prNumber}/comments`,
    token,
    "POST",
    { body }
  );
  console.log(`[fov] Created sticky comment (${created.id}) on PR #${prNumber}`);
}
