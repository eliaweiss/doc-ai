#!/usr/bin/env node
// Bumps the doc-ai plugin version in plugin.json and marketplace.json together.
// Usage: node bump-version.mjs [patch|minor|major|<x.y.z>] [--repo <path>]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const repoFlag = args.indexOf("--repo");
const repo = repoFlag >= 0 ? path.resolve(args.splice(repoFlag, 2)[1]) : process.cwd();
const bump = args[0] ?? "patch";

const pluginPath = path.join(repo, "plugins/doc-ai/.claude-plugin/plugin.json");
const marketplacePath = path.join(repo, ".claude-plugin/marketplace.json");

const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
const entry = marketplace.plugins.find((p) => p.name === plugin.name);
if (!entry) throw new Error(`No "${plugin.name}" entry in ${marketplacePath}`);

const current = plugin.version;
if (entry.version !== current) {
  console.warn(`Warning: versions differ (plugin.json ${current}, marketplace.json ${entry.version}); bumping from plugin.json.`);
}

const semver = /^(\d+)\.(\d+)\.(\d+)$/;
const m = current.match(semver);
if (!m) throw new Error(`Current version is not x.y.z: ${current}`);
let [major, minor, patch] = m.slice(1).map(Number);

let next;
if (bump === "major") next = `${major + 1}.0.0`;
else if (bump === "minor") next = `${major}.${minor + 1}.0`;
else if (bump === "patch") next = `${major}.${minor}.${patch + 1}`;
else if (semver.test(bump)) next = bump;
else throw new Error(`Expected patch, minor, major or x.y.z, got: ${bump}`);

const cmp = (a, b) => a.split(".").map(Number).reduce((r, n, i) => r || n - b.split(".").map(Number)[i], 0);
if (cmp(next, current) <= 0) throw new Error(`New version ${next} must be greater than ${current}`);

plugin.version = next;
entry.version = next;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");
writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
console.log(`${plugin.name}: ${current} -> ${next}`);
