# pg-query-composer Documentation

Welcome to the comprehensive documentation for **pg-query-composer**, an advanced PostgreSQL query builder for TypeScript.

## Quick Navigation

### For New Users
- **[README.md](../README.md)** - Start here! Overview, installation, and quick start guide
- **[Project Overview & PDR](./project-overview-pdr.md)** - Project goals, features, and requirements

### For Developers
- **[Code Standards](./code-standards.md)** - Development conventions, patterns, and contribution guidelines
- **[Codebase Summary](./codebase-summary.md)** - Detailed module breakdown with API signatures

### Feature Guides
- **[Core Builder](./guide-core-builder.md)** - WHERE, JOINs, pagination, sorting
- **[Composition](./guide-composition.md)** - Fragments, scopes, merge
- **[Subqueries](./guide-subqueries.md)** - IN, EXISTS, LATERAL
- **[Relations](./guide-relations.md)** - Models, eager loading, batch loading
- **[PostgreSQL](./guide-postgresql.md)** - JSONB, Full-Text Search, CTEs

### For Architects
- **[System Architecture](./system-architecture.md)** - 7-layer design, data flow, extension points
- **[Project Roadmap](./project-roadmap.md)** - Version planning and future features

---

## Documentation Structure

### 1. README.md (Root)
**Location:** `/README.md`

Quick start guide with practical examples covering:
- Installation and setup
- Basic query building
- Type-safe queries
- Eager loading and relations
- Common patterns with working code
- All 5 module exports

**Best for:** New developers getting started, quick API reference

---

### 2. Project Overview & PDR
**Location:** `/docs/project-overview-pdr.md`

Comprehensive project documentation including:
- Project identity and description
- Goals and non-goals
- 34 operator categories with examples
- Module architecture overview
- Design patterns used throughout
- Test coverage and acceptance criteria
- Getting started guide with setup steps
- Success metrics and roadmap

**Best for:** Understanding project scope, architecture decisions, and requirements

---

### 3. Code Standards & Conventions
**Location:** `/docs/code-standards.md`

Development guidelines covering:
- TypeScript configuration (strict mode)
- File organization and naming conventions
- Import/export patterns
- Code style and formatting rules
- Comments and documentation requirements
- Design pattern implementations (Builder, Factory, Scope)
- Error handling best practices
- Testing conventions (AAA pattern)
- Operator implementation guide
- Review checklist for contributions

**Best for:** Contributing code, maintaining consistency, adding features

---

### 4. Codebase Summary
**Location:** `/docs/codebase-summary.md`

Detailed technical breakdown including:
- Complete module-by-module breakdown (7 modules + entry point)
- File counts and lines of code per module
- Full API signatures for every public export
- All 34 operators categorized
- 15 fragment functions documented
- 4 relation types explained
- Batch loading implementation details
- Test structure and coverage goals
- Dependency tree visualization
- Build output and distribution structure
- Code metrics and performance data

**Best for:** Deep diving into the codebase, understanding module relationships, API research

---

### 5. System Architecture
**Location:** `/docs/system-architecture.md`

Architectural overview including:
- 7-layer architecture visualization
- Component responsibilities and design
- Data flow patterns with examples
- Module dependency graph
- Extension points for customization
- Performance characteristics with timing estimates
- Security model and SQL injection prevention
- Integration patterns

**Best for:** Understanding system design, architectural decisions, planning extensions

---

### 6. Project Roadmap
**Location:** `/docs/project-roadmap.md`

Development planning and vision including:
- Current status (v1.0.1)
- Versioned roadmap: v0.2.0 → v1.0.0+
- Feature pipeline for each version
- Known limitations and future improvements
- Success metrics per version
- Community contribution guidelines
- Maintenance commitment and LTS periods
- Backward compatibility guarantee
- Release notes format

**Best for:** Understanding development direction, planning integrations, contribution planning

---

## Coverage Summary

| Item | Count | Status |
|------|-------|--------|
| **Documentation Files** | 11 | ✓ Complete |
| **Total Documentation** | 4,800+ lines | ✓ Comprehensive |
| **Modules Documented** | 7 | ✓ 100% |
| **APIs Documented** | 150+ | ✓ Complete |
| **Feature Guides** | 5 | ✓ Complete |
| **Operators** | 34 | ✓ All covered |
| **Code Examples** | 80+ | ✓ Working |
| **Entry Points** | 5 | ✓ Documented |

---

## By Topic

### Getting Started
1. Read [../README.md](../README.md) for quick start
2. Check [project-overview-pdr.md](./project-overview-pdr.md) for goals and features
3. Try examples in [../README.md](../README.md) section "Common Patterns"

### Understanding the Codebase
1. Review [codebase-summary.md](./codebase-summary.md) module breakdown
2. Study [system-architecture.md](./system-architecture.md) for design
3. Reference [code-standards.md](./code-standards.md) for patterns

### Making Changes
1. Read [code-standards.md](./code-standards.md) for conventions
2. Check [codebase-summary.md](./codebase-summary.md) for relevant modules
3. Follow review checklist in [code-standards.md](./code-standards.md)

### Planning Features
1. Review [project-roadmap.md](./project-roadmap.md) for planned features
2. Check [system-architecture.md](./system-architecture.md) for extension points
3. Refer to [code-standards.md](./code-standards.md) for implementation guide

---

## Key Concepts

### Query Builder Pattern
The core `QueryComposer` class uses a fluent builder pattern for composing queries:

```typescript
import { createQueryComposer } from 'pg-query-composer';

const composer = createQueryComposer(schema, 'users');
const { text, values } = composer
  .where('email__contains', 'example.com')
  .orderBy('-created_at')
  .paginate({ page: 1, limit: 10 })
  .toParam();
```

### Type-Safe Queries
The `TypedQueryComposer` provides compile-time validation:

```typescript
import { createTypedComposer } from 'pg-query-composer/types';

const typed = createTypedComposer(schema, 'users');
typed.where('email__exact', 'test@example.com'); // ✓ Type-safe
typed.where('invalid__exact', 'value');          // ✗ TypeScript error
```

### Relation Eager Loading
Multi-table queries with N+1 prevention via DataLoader:

```typescript
import { defineModel, createModelQuery } from 'pg-query-composer/relations';

const users = await createModelQuery(User, 'users')
  .where('status__exact', 'active')
  .include('posts')    // Batch-loaded
  .include('profile')  // Batch-loaded
  .build();
```

---

## Documentation Standards

All documentation follows these standards:

- **Version Tracking:** Each file includes version and last-updated date
- **Examples:** Code examples include imports, schema definitions, and output
- **Accessibility:** Progressive disclosure from basic to advanced concepts
- **Consistency:** Naming conventions match actual codebase
- **Maintenance:** Regular quarterly reviews (next: 2026-05-11)

---

## Contributing Documentation

When contributing or updating documentation:

1. **Follow Conventions**
   - Use kebab-case for file names
   - Include version numbers in headers
   - Add last-updated dates

2. **Include Examples**
   - Show import statements
   - Include schema definitions
   - Display console.log output
   - Use real-world patterns

3. **Maintain Accuracy**
   - Verify API method names
   - Check type definitions
   - Test code examples
   - Cross-reference modules

4. **Update Index**
   - Add new files to this README
   - Update coverage summary
   - Link from appropriate sections

---

## Resources

- **GitHub:** [pg-query-composer](https://github.com/vanpapoet/pg-query-composer)
- **npm:** [pg-query-composer](https://www.npmjs.com/package/pg-query-composer)
- **Issues:** [GitHub Issues](https://github.com/vanpapoet/pg-query-composer/issues)
- **Discussions:** [GitHub Discussions](https://github.com/vanpapoet/pg-query-composer/discussions)

---

## Quick Reference

### Core Methods
- `.where(column, value)` - Add AND condition
- `.orWhere(filterGroups)` - Add OR condition
- `.orderBy(...fields)` - Sort results
- `.paginate({page, limit})` - Limit and offset
- `.toParam()` - Generate parameterized SQL

### Operators (34 total)
- **Comparison:** exact, notexact, gt, gte, lt, lte
- **Text:** contains, icontains, startswith, endswith, regex, iregex
- **Range:** in, notin, between, notbetween
- **Null:** isnull, isnotnull
- **Date:** date, datebetween, year, month, day, week, today, thisweek, thismonth, thisyear
- **Array:** arraycontains, arrayoverlap, arraycontained

### Module Exports
- `.` - All modules combined
- `./composition` - Fragments, scopes, merge
- `./subquery` - Subqueries, EXISTS, LATERAL
- `./relations` - Models, eager loading, batch loading
- `./pg` - JSONB, FTS, Recursive CTEs

---

## FAQ

**Q: Where do I start?**
A: Read [../README.md](../README.md) first, then check [project-overview-pdr.md](./project-overview-pdr.md).

**Q: How do I use TypedQueryComposer?**
A: See examples in [../README.md](../README.md) "Type-Safe Queries" section and [codebase-summary.md](./codebase-summary.md) module 5.

**Q: What are the 34 operators?**
A: Full list in [project-overview-pdr.md](./project-overview-pdr.md) "Operator Categories" and [codebase-summary.md](./codebase-summary.md) core module section.

**Q: How do I add a custom operator?**
A: See [code-standards.md](./code-standards.md) section "Operator Implementation".

**Q: What's the performance like?**
A: See [system-architecture.md](./system-architecture.md) section "Performance Characteristics".

**Q: What's coming in future versions?**
A: See [project-roadmap.md](./project-roadmap.md) for detailed roadmap.

---

## Feedback

Found an issue in the documentation? Have suggestions?

- Open a GitHub issue with `docs` label
- Start a discussion in GitHub Discussions
- Submit a pull request with improvements

---

**Documentation Version:** 1.0
**Last Updated:** 2026-02-11
**Maintainer:** Documentation Team

For the latest information, visit the [project repository](https://github.com/vanpapoet/pg-query-composer).
