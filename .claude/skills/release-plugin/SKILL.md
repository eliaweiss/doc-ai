---
name: release-plugin
description: Release a new version of the doc-ai Claude Code plugin in this repo (plugins/doc-ai) - bump the version in plugin.json and marketplace.json, validate, commit, push, and update the installed plugin. Use when the user asks to bump, release, publish or ship the plugin or the doc-ai skill, or to make Claude Code pick up changes to plugins/doc-ai.
---

# Release the doc-ai plugin

Claude Code only installs a plugin update when its `version` goes up. A change pushed under the same version is ignored by `claude plugin update`. The version is in two files that must match:

- `plugins/doc-ai/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json` (the `doc-ai` entry under `plugins`)

Run every command from the repository root.

## 1. Check what's being released

```bash
git status --short
```

```bash
git log --oneline -1 -- plugins .claude-plugin
```

```bash
git diff HEAD -- plugins .claude-plugin
```

- If nothing under `plugins/` changed since the last version bump (committed or not), tell the user there's nothing to release and stop, unless they want a bump anyway.
- The working tree often has unrelated uncommitted work. Only `plugins/` and `.claude-plugin/` belong in a release. Never stage or commit other files. If a doc file such as `docs/mcp-server.md` has plugin-related edits mixed with unrelated ones, leave it out and mention it.
- If the tools in `apps/server/src/mcp.ts` or the `register*Tools` files changed, check `plugins/doc-ai/skills/doc-ai/SKILL.md` still matches them before releasing.

## 2. Pick the bump

Default to `patch` (wording or guidance fixes in the skill). Use `minor` for a new skill, new tool coverage or MCP config changes, `major` for breaking changes such as renaming the plugin or its MCP server. Use what the user asked for if they named a level or version.

## 3. Bump both manifests

```bash
node .claude/skills/release-plugin/scripts/bump-version.mjs patch
```

It takes `patch`, `minor`, `major` or an explicit `x.y.z`, updates both files together, refuses to go backwards and prints `doc-ai: old -> new`.

## 4. Validate

```bash
claude plugin validate .
```

```bash
claude plugin validate plugins/doc-ai
```

Fix any errors before going on. The plugin-directory warnings (missing icon, privacy policy URL, `http://localhost` link) only matter for public directory submission and can be ignored.

## 5. Commit

Stage only the plugin paths:

```bash
git add plugins .claude-plugin
```

```bash
git diff --cached --stat
```

Confirm the staged files are only under `plugins/` and `.claude-plugin/`, then commit with a message like `Release doc-ai plugin 0.1.1: <what changed>` and the attribution line this session requires.

## 6. Push

Pushing publishes the release to everyone who installed from `eliaweiss/doc-ai`. Push only if the user asked to release or push in this request; otherwise ask first.

```bash
git push
```

## 7. Update the installed plugin

The marketplace is cloned from GitHub, so this only works after the push.

```bash
claude plugin marketplace update doc-ai
```

```bash
claude plugin update doc-ai@doc-ai
```

`claude plugin update` should report the new version. If it says it's already at the old version, the push didn't land or the marketplace cache is stale: check `git log origin/main -1` and run the marketplace update again.

Then confirm the MCP server still connects:

```bash
claude mcp list
```

Expect `plugin:doc-ai:doc-ai: http://localhost:4310/mcp (HTTP) - ✔ Connected` (it fails only if the doc-ai server isn't running). Tell the user the new skill text loads in new sessions.
