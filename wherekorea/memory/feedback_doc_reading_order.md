---
name: Read core docs sequentially
description: User requires CLAUDE.md → PRD → data-policy → taxonomy → design-system to be read in order, not in parallel
type: feedback
---

Always read the WhereKorea foundation docs in this exact sequence before any build work:
1. CLAUDE.md
2. docs/PRD-v1.md
3. docs/data-policy.md
4. docs/destination-taxonomy.md
5. docs/design-system.md

**Why:** Each doc builds on the previous. CLAUDE.md sets constraints that filter how the PRD is interpreted. Data-policy defines allowed values for fields the PRD only names. Taxonomy gives editorial identity to destinations. Design system is the final visual confirmation layer. Reading in parallel loses this layered understanding.

**How to apply:** Any time a new conversation involves building, planning, or modifying WhereKorea, read these five docs sequentially before doing anything else.
