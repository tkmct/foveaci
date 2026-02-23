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

if (!input || !output) {
  console.error(
    "Usage: node scripts/approve_scenarios.mjs --input <discovered-scenarios.yml> --output <approved-scenarios.yml> [--min-confidence 0.5]"
  );
  process.exit(1);
}

const doc = yaml.load(fs.readFileSync(input, "utf-8"));
if (!doc || typeof doc !== "object" || !Array.isArray(doc.scenarios)) {
  console.error(`Invalid scenario file: ${input}`);
  process.exit(1);
}

const approvedDoc = {
  ...doc,
  scenarios: doc.scenarios.map((scenario) => ({
    ...scenario,
    approved: Number(scenario.confidence || 0) >= minConfidence,
  })),
};

const outputPath = path.resolve(output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, yaml.dump(approvedDoc, { lineWidth: 120 }));

const approvedCount = approvedDoc.scenarios.filter((scenario) => scenario.approved).length;
console.log(
  `[fov] Approved ${approvedCount}/${approvedDoc.scenarios.length} scenarios (min-confidence=${minConfidence})`
);
console.log(`[fov] Wrote ${outputPath}`);

