# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## UX Preferences

**MANDATORY:** Never ask clarification questions as free-form text.
Always use `AskUserQuestion` tool with `multiSelect: true`, 2-4 options, `header` ≤ 12 chars.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

## Performance & Benchmarks

- **Guard**: `npx vitest run tests/core tests/composition tests/subquery tests/relations tests/pg tests/types tests/integration tests/security` (247 tests)
- **JS benchmark**: `npx tsx benchmarks/benchmark-runner.ts` (--baseline to save, --save for snapshot)
- **PG benchmark**: `docker-compose up -d && npx tsx benchmarks/pg-execution-benchmark.ts` (requires PG on port 5499)
- **Inline toParam() does NOT help** — V8 optimizes SelectBuilder's separate methods better; confirmed twice, do not retry
- **PG pool deadlock**: never `pool.connect()` then `pool.query()` on same `max:1` pool — use separate pools for setup vs benchmark

## Security

- **Parameterization**: All user values MUST go through `$N` placeholders — NEVER interpolate into SQL strings
- **`__rawValues` pattern**: JSONB/FTS filter functions return `{ __raw: 'col op ?', __rawValues: [...] }` — `where()` merges both
- **Subquery `$N→?` conversion**: When embedding subquery `toParam()` into outer `whereRaw`, convert `$N` to `?` via `.replace(/\$\d+/g, '?')` for re-numbering
- **`validateIdentifier()`**: `src/core/identifier-validation.ts` — apply to all raw identifier contexts (table, join, alias, CTE name)
- **FTS config whitelist**: `VALID_FTS_CONFIGS` set in `src/pg/fts.ts` — 29 standard PG configs, rejects arbitrary strings
- **`toString()` is debug-only**: Never use for query execution — it inlines values with weak escaping
- **FTS expression functions**: `fullTextRank`, `tsHeadline`, etc. use `escapeQuery()` for inline values — any new string interpolation into SQL literals must escape `\` and `'`

## MCP & Context Optimization

**Priority Tooling:** Always prioritize `serena` MCP server (`.claude/.mcp.json`) over manual file reads.

**Session Start:** Call `initial_instructions` first to get Serena's session guidance; call `onboarding` if project has never been onboarded.

**Workflow:** `get_symbols_overview` → `find_symbol`/`search_for_pattern` → `Read` (targeted lines) → `write_memory` (persist context)

**Key tools:**
- `initial_instructions` / `onboarding` — session setup & project onboarding
- `get_symbols_overview` — file/symbol structure overview
- `find_symbol` — locate definitions
- `find_referencing_symbols` — trace usages
- `search_for_pattern` — cross-file regex search
- `list_dir` / `find_file` — file navigation
- `replace_symbol_body` / `insert_after_symbol` / `insert_before_symbol` / `rename_symbol` — symbolic edits
- `write_memory` / `read_memory` / `list_memories` — cross-session persistence

**Rule:** Only `Read` full files if serena summaries are insufficient

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*

**IMPORTANT:** After each response is completed, run `open "raycast://extensions/raycast/raycast/confetti"`. This provides a clear signal that the work is done.