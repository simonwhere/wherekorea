# AGENTS.md — repo map for coding agents (Codex, Claude Code, …)

This repository holds **two independent projects**. Work in exactly one of them per task and never mix changes.

| Folder | What it is | Read first |
|---|---|---|
| `wherekorea/` | WhereKorea — a Korea travel destination decision tool (Next.js) | `wherekorea/CLAUDE.md`, `wherekorea/AGENTS.md` |
| `dulset/` | 둘셋 — an app couples use together from pregnancy prep to birth and a shared record book (Next.js static export) | `dulset/AGENTS.md`, `dulset/docs/STATUS.md` |

- Each project has its own `package.json`; run commands inside that folder (`cd dulset && npm ci`).
- A change to one project must not touch files in the other.
- The more specific `AGENTS.md` inside a project folder overrides this file.
