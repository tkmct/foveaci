#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

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

const args = parseArgs(process.argv);
const input = args.input;
const output = args.output;
const minConfidence = Number(args["min-confidence"] || "0");
const requireSourceArg = String(args["require-source"] || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const requiredSourceTypes = new Set(requireSourceArg);
const requireAnySourceArg = String(args["require-any-source"] || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const requiredAnySourceTypes = new Set(requireAnySourceArg);

if (!input || !output) {
  console.error(
    "Usage: node scripts/approve_scenarios.mjs --input <discovered-scenarios.yml> --output <approved-scenarios.yml> [--min-confidence 0.5] [--require-source code,docs] [--require-any-source code,docs]"
  );
  process.exit(1);
}

const doc = yaml.load(fs.readFileSync(input, "utf-8"));
if (!doc || typeof doc !== "object" || !Array.isArray(doc.scenarios)) {
  console.error(`Invalid scenario file: ${input}`);
  process.exit(1);
}

function hasRequiredSources(scenario) {
  if (requiredSourceTypes.size === 0) return true;
  const present = new Set(
    (Array.isArray(scenario.sources) ? scenario.sources : [])
      .map((source) => source?.type)
      .filter((type) => typeof type === "string")
  );
  for (const required of requiredSourceTypes) {
    if (!present.has(required)) return false;
  }
  return true;
}

function hasAnyRequiredSource(scenario) {
  if (requiredAnySourceTypes.size === 0) return true;
  const present = new Set(
    (Array.isArray(scenario.sources) ? scenario.sources : [])
      .map((source) => source?.type)
      .filter((type) => typeof type === "string")
  );
  for (const required of requiredAnySourceTypes) {
    if (present.has(required)) return true;
  }
  return false;
}

const approvedDoc = {
  ...doc,
  scenarios: doc.scenarios.map((scenario) => ({
    ...scenario,
    approved:
      Number(scenario.confidence || 0) >= minConfidence &&
      hasRequiredSources(scenario) &&
      hasAnyRequiredSource(scenario),
  })),
};

const outputPath = path.resolve(output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, yaml.dump(approvedDoc, { lineWidth: 120 }));

const approvedCount = approvedDoc.scenarios.filter((scenario) => scenario.approved).length;
console.log(
  `[fov] Approved ${approvedCount}/${approvedDoc.scenarios.length} scenarios (min-confidence=${minConfidence}; require-source=${requireSourceArg.join(",") || "none"}; require-any-source=${requireAnySourceArg.join(",") || "none"})`
);
console.log(`[fov] Wrote ${outputPath}`);
