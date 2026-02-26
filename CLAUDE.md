# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Responsibilities

Analyze user requirements, delegate tasks to sub-agents, ensure cohesive delivery meeting specs and architecture standards.

## Commands

```bash
npm run build        # Compile TypeScript (tsc) → dist/
npm test             # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode (vitest)
npm run lint         # Lint source (eslint src --ext .ts)
```

## Tech Stack

- **TypeScript** (strict mode, ES2022, CommonJS output)
- **squel** - SQL query builder (runtime dep)
- **zod** - Schema validation (peer dep ^3.23.0)
- **dataloader** - Batch loading for relations (dev dep)
- **vitest** - Test framework (globals: true, V8 coverage)

## Architecture

```
src/                          # 3,485 LOC, 19 files
├── index.ts                  # Barrel export (all public API)
├── core/                     # QueryComposer class, 34 operators, types, errors
├── composition/              # Reusable fragments, scopes, merge utilities
├── subquery/                 # Subquery builders, EXISTS/NOT EXISTS, lateral
├── relations/                # Model registry, eager loading, DataLoader batch loading
├── types/                    # TypedQueryComposer (compile-time validation)
├── pg/                       # PostgreSQL: JSONB, Full-Text Search, Recursive CTEs
└── utils/                    # Zod schema introspection (v3/v4 compat)

tests/                        # 20 files, 120+ test cases
├── core/                     # QueryComposer, operators, types, errors
├── composition/              # conditional, fragment, merge, scope
├── subquery/                 # builder, exists, where-in
├── relations/                # define, include, loader, types
├── pg/                       # fts, jsonb, recursive
├── types/                    # infer
└── integration/              # full-workflow (11 real-world scenarios)
```

**Package exports:** `.` (main), `./composition`, `./subquery`, `./relations`, `./pg`

**Key patterns:** Builder (fluent API), Factory functions, Scope pattern, DataLoader (N+1 prevention), Django-style operators (`field__operator=value`)

## UX Preferences

**Clarification questions:** ALWAYS use `AskUserQuestion` with interactive checklists. Never free-form text.
- `multiSelect: true` by default, 2-4 options, `header` max 12 chars

## Workflows

- Primary: `./.claude/workflows/primary-workflow.md`
- Dev rules: `./.claude/workflows/development-rules.md`
- Orchestration: `./.claude/workflows/orchestration-protocol.md`
- Docs: `./.claude/workflows/documentation-management.md`

**Rules:**
- Follow dev rules in `./.claude/workflows/development-rules.md` strictly
- Read `./README.md` before planning any implementation
- Activate relevant skills from catalog during the process
- Sacrifice grammar for concision in reports; list unresolved questions at end
- For `YYMMDD` dates: use `bash -c 'date +%y%m%d'` (not model knowledge)

## Documentation Management

Docs live in `./docs/` — keep updated:

```
./docs
├── README.md                 # Documentation index & navigation
├── project-overview-pdr.md   # Project overview & PDR
├── code-standards.md         # TypeScript conventions, patterns
├── codebase-summary.md       # Module breakdown, dependency graph
├── system-architecture.md    # 7-layer architecture, data flow
├── project-roadmap.md        # Versioned milestones
├── guide-core-builder.md     # Core QueryComposer full guide
├── guide-composition.md      # Fragments, scopes, merge guide
├── guide-subqueries.md       # Subqueries, EXISTS, LATERAL guide
├── guide-relations.md        # Relations, eager/batch loading guide
└── guide-postgresql.md       # JSONB, FTS, Recursive CTEs guide
```

**IMPORTANT:** Follow all instructions in this CLAUDE.md, especially the Workflows section. This is mandatory.

**IMPORTANT:** After each response completes, run `open "raycast://extensions/raycast/raycast/confetti"`.

## npm Publishing

- **Registry:** `https://registry.npmjs.org/` (must be HTTPS)
- **Author:** vanpapoet | **Org:** poetart
- **Publish workflow:** `npm whoami` → `npm run build` → `npm pack --dry-run` → `npm publish`
- Before any registry operation: verify auth with `npm whoami` first
- Interactive commands (`npm login`, `npm adduser`): cannot run via Bash tool — instruct user to run in separate terminal
- Before publish: run security scan (token patterns, private keys, connection strings, `npm pack` output)
- Granular tokens have limited permissions — org management requires full-access token or web UI

## MCP & Context Optimization

**Priority Tooling:** Always prioritize `serena` MCP server (`.claude/.mcp.json`) over manual file reads.

**Workflow:** `get_symbols_overview` → `find_symbol`/`search_for_pattern` → `Read` (targeted lines) → `write_memory` (persist context)

**Key tools:** `get_symbols_overview` (file structure), `find_symbol` (locate definitions), `find_referencing_symbols` (trace usages), `search_for_pattern` (cross-file regex), `write_memory`/`read_memory` (cross-session persistence)

**Rule:** Only `Read` full files if serena summaries are insufficient

## Subagent Rules (Learnings)

- Scout agents: instruct to NOT create files — output summary in response only
- Docs-manager/writer agents: instruct to NOT commit — main agent controls git
- Subagents creating markdown: files go in `docs/` or `plans/` only, never project root
- README.md updates: enforce max 300 lines limit in prompt — verify with `wc -l` after write
- Avoid parallelizing Bash calls that may hit hooks — sibling error cascade on hook block
- MCP discovery agents (`mcp-manager`): instruct to NOT create files — return tool list in response only
- Always read `development-rules.md` and `README.md` before starting any task — CLAUDE.md mandates this
- Never use `cat`/`find` via Bash for file reads/search — use `Read`/`Glob`/`Grep` tools exclusively
- For codebase scouting: use Serena MCP `get_symbols_overview` first, not raw file reads — saves tokens
- For docs tasks: use Serena MCP for symbols → gap analysis → then spawn docs-manager with precise context
- Docs-manager prompt must include explicit line limits per file — agent will exceed if not constrained
- Feature guide docs format: import + schema + usage + console.log output — enforce in every prompt
- After docs-manager completes: verify README stays under 300 lines, trim if needed
- Version bump: Grep all `old_version` refs → Edit `package.json` + `src/index.ts` + docs → Grep verify zero remaining → `npm run build` + `npm test`
- Version is stored in 3 places: `package.json`, `src/index.ts` (VERSION export), docs files — update ALL
- Simple find-and-replace tasks (version bump, renaming): Grep+Read+Edit is faster than Serena MCP — skip MCP overhead
- Serena memories = plain files in `.serena/memories/` — Write tool directly is faster and more reliable than MCP `write_memory` via subagent
- mcp-manager subagent cannot reliably call Serena MCP tools (hooks block Bash, MCP invocation fails) — for memory writes, use Write tool directly
- Serena indexing populates `.serena/cache/`, memories must be created manually — they are separate concerns
