# AGENTS.md — execution rules for coding agents

## Read order before doing work
1. `CLAUDE.md`
2. `docs/PRD-v1.md`
3. `docs/data-policy.md`
4. `docs/destination-taxonomy.md`
5. the task-specific document if one exists

## How to work
- Make the smallest coherent change that completes the requested task.
- Preserve product identity: decision tool, not portal.
- Prefer stable data structures over premature backend complexity.
- Use static or seeded data first unless the task explicitly requires live integration.
- Keep UI readable and easy to scan.

## What to challenge
Flag the task if it starts to drift into:
- supplier-led recommendation logic
- dense attraction directory behavior
- booking platform behavior
- overdesigned hover-heavy interactions
- ambiguous shorthand like “reuse the old stuff” without naming exact sections

## Task output style
When finishing a task, summarize:
- what changed
- what assumptions were used
- what is still undefined
- what the next smallest useful step is
