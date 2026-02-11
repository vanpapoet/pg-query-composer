# Project Roadmap: pg-query-composer

## Current Status

**Version:** 1.0.1

All core features complete and production-ready:
- 34 operators across 6 categories
- Type-safe query building
- Relation system with eager loading
- DataLoader-based batch loading (N+1 prevention)
- PostgreSQL-native features (JSONB, FTS, Recursive CTEs)
- 120+ test cases with 85%+ coverage

---

## Roadmap by Version

### v0.2.0 (Q2 2026) - Performance & Developer Experience

**Focus:** Enhance performance, improve error messages, extend Zod support.

**Features:**

- **Query Caching**
  - Memoize query builds for repeated calls
  - Cache layer with TTL
  - Cache invalidation utilities

- **Enhanced Error Messages**
  - Include query context in error output
  - Suggest valid columns when invalid column used
  - Show operator alternatives for typos

- **Extended Zod Integration**
  - Support for z.discriminatedUnion()
  - Support for nested schemas
  - Automatic field name sanitization

- **Performance Improvements**
  - Optimize operator matching (O(1) lookup)
  - Lazy evaluation of conditions
  - Reduce memory footprint of query state

**Breaking Changes:** None (backward compatible)

**Migration Guide:** N/A

---

### v0.3.0 (Q3 2026) - SQL Features Expansion

**Focus:** Add advanced SQL features and improve aggregation support.

**Features:**

- **Window Functions**
  - ROW_NUMBER(), RANK(), DENSE_RANK()
  - LAG(), LEAD(), FIRST_VALUE(), LAST_VALUE()
  - PARTITION BY and ORDER BY clauses

  ```typescript
  composer
    .select('id', 'name', 'salary')
    .window('rank', { partitionBy: 'dept', orderBy: '-salary' })
    .build();
  ```

- **HAVING Clause Improvements**
  - Support aggregate functions in HAVING
  - COUNT(), SUM(), AVG(), MIN(), MAX()
  - Type-safe aggregate conditions

  ```typescript
  composer
    .groupBy('dept')
    .having('COUNT(*) > $1', [10])
    .build();
  ```

- **Common Table Expressions (CTEs)**
  - Non-recursive CTEs
  - Multiple CTEs in single query
  - CTE composition utilities

  ```typescript
  const cte = composer.asCTE('active_users');
  const query = new QueryComposer(schema, 'users')
    .withCTE(cte)
    .where('active__exact', true);
  ```

- **DISTINCT Support**
  - DISTINCT keyword
  - DISTINCT ON (PostgreSQL-specific)
  - Conflict resolution in projections

  ```typescript
  composer.distinct(['category']).select('*');
  ```

**Breaking Changes:** None (backward compatible)

**Migration Guide:** N/A

---

### v0.4.0 (Q4 2026) - Developer Tools & Integrations

**Focus:** Developer tools, logging/debugging utilities, and framework integrations.

**Features:**

- **Query Logging & Debugging**
  - Enable/disable logging per composer
  - Query execution timing
  - Parameter visualization
  - Execution plan analysis helpers

  ```typescript
  const composer = createQueryComposer(schema, 'users', {
    debug: true, // Logs all queries
    profileQueries: true, // Timing info
  });
  ```

- **Performance Analysis Helpers**
  - Identify N+1 patterns
  - Suggest missing indexes
  - Query complexity estimation
  - Batch size recommendations

- **Framework Integration Examples**
  - Express.js middleware
  - Fastify plugin
  - NestJS integration module
  - NextJS/Vercel helpers
  - Hono.js integration

- **Query Builder UI Tools**
  - JSON Schema generation from queries
  - Query visualization (AST to diagram)
  - Interactive query builder helpers

**Breaking Changes:** None (backward compatible)

**Migration Guide:** N/A

---

## Feature Pipeline (Future Consideration)

### Post-v0.4.0 Features

- **Query Optimization**
  - Automatic JOIN reordering
  - Index-aware query planning
  - Cost estimation

- **Advanced Filtering**
  - Full-text search ranking scores
  - Geospatial queries (PostGIS)
  - JSON schema validation in queries

- **Performance Monitoring**
  - Query telemetry collection
  - Performance degradation alerts
  - Query analytics dashboard

- **Query Migrations**
  - Track breaking schema changes
  - Automatic query rewriting
  - Deprecation warnings

- **GraphQL Integration**
  - Auto-generate GraphQL resolvers
  - Relay cursor pagination
  - DataLoader integration helpers

- **ORM Features** (Long-term, v1.0+)
  - Model definitions (optional, lightweight)
  - Automatic timestamps
  - Soft deletes
  - Hooks/lifecycle events

---

## Known Limitations & Future Work

### Current Limitations

1. **Single Table Primary Focus**
   - Works best with single-table queries
   - Multi-table joins require manual configuration
   - Plan: Improve join builder in v0.3

2. **Operator Coverage**
   - 34 operators may not cover all use cases
   - Custom operators require manual SQL
   - Plan: Add custom operator extension in v0.4

3. **Schema Flexibility**
   - Requires Zod schema definition
   - Can't infer from database
   - Plan: Optional schema generation from DB in v1.0

4. **Relationship Eager Loading**
   - Only supports simple relation patterns
   - No support for polymorphic relations
   - Plan: Extended relation types in v0.5+

### Future Improvements

- **Dynamic Schema Support**
  - Schema generation from PostgreSQL introspection
  - Runtime schema validation

- **Advanced Caching**
  - Query result caching (with TTL)
  - Smart invalidation based on dependencies

- **Monitoring & Analytics**
  - Built-in query performance metrics
  - Slow query detection
  - Usage analytics

- **Testing Utilities**
  - Mock database layer
  - Query assertion helpers
  - Fixture generators

---

## Success Metrics

### v1.0.1 (Completed)

- [x] 34 operators implemented
- [x] Type-safe queries via TypedQueryComposer
- [x] Eager loading with batch loading (N+1 prevention)
- [x] PostgreSQL features (JSONB, FTS, Recursive CTEs)
- [x] 120+ test cases, 85%+ coverage
- [x] 5 module entry points
- [x] Zero circular dependencies
- [x] Production-ready error handling

### v0.2.0 (Target)

- Query building performance: < 1ms per query
- Error message helpfulness: 90%+ developer satisfaction
- Zod integration: Support 99% of common patterns
- Cache hit rate: > 80% for repeated queries

### v0.3.0 (Target)

- Window functions: Full PostgreSQL window support
- CTE support: Recursive and non-recursive
- HAVING clause: Type-safe aggregates
- Test coverage: Maintain 85%+

### v0.4.0 (Target)

- Framework integrations: 5+ frameworks
- Developer tooling: Debug mode, logging, profiling
- Documentation: Interactive examples
- Community: 500+ GitHub stars, 50+ contributors

---

## Community & Contribution

### Contribution Areas

1. **Feature Development**
   - New operators
   - New fragments
   - Framework integrations

2. **Documentation**
   - API examples
   - Troubleshooting guides
   - Video tutorials

3. **Testing**
   - Edge case discovery
   - Performance testing
   - Integration testing

4. **Community**
   - GitHub discussions
   - Stack Overflow support
   - Blog posts

### Support Channels

- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Questions and ideas
- Email: (to be added)
- Discord: (planned for v0.3+)

---

## Maintenance Commitment

**Support Window:** 18 months per major version

- **v0.x Series:**
  - Active development until v1.0.0
  - Minimum 12 months patch support
  - Breaking changes only between minor versions

- **v1.x Series:** (When released)
  - LTS period: 24 months
  - Stable API guaranteed
  - Gradual deprecation with 2-version notice

**Update Frequency:**
- Patch releases (0.x.y): Weekly (fixes only)
- Minor releases (0.y.0): Monthly (features + fixes)
- Major releases: As planned above

---

## Backward Compatibility

### Guarantee

All releases < v1.0.0 maintain backward compatibility except:
- Major version bumps (0.x to 0.y where y is major)
- Documented breaking changes with migration guide
- Deprecated features (2-version notice)

### Deprecation Policy

Features marked `@deprecated` are:
1. Kept functional for 2 minor versions
2. Removed only in next major version
3. Migration guides provided in release notes

---

## Release Notes Format

Each release includes:
- **Features:** New functionality
- **Fixes:** Bug fixes and patches
- **Breaking Changes:** (If any, with migration)
- **Deprecations:** (If any, with alternatives)
- **Performance:** Benchmarks and improvements
- **Dependencies:** Updated versions
- **Contributors:** Community credits

---

## Long-Term Vision (v1.0+)

### Goals for v1.0

1. **Stability**
   - Feature-complete core API
   - Backward compatibility guarantee
   - Production-proven at scale

2. **Ecosystem**
   - 10+ framework integrations
   - 100+ community examples
   - Active contributor community

3. **Performance**
   - Sub-millisecond query building
   - Efficient caching layer
   - Minimal bundle footprint

4. **Developer Experience**
   - Comprehensive documentation
   - Interactive playground
   - IDE auto-completion support

### Beyond v1.0

Once v1.0 is released, the project will focus on:
- Long-term stability and maintenance
- Community-driven feature requests
- Integration with other tools
- Educational content and examples

---

## Timeline Summary

| Version | Quarter | Status | Key Features |
|---------|---------|--------|--------------|
| 1.0.1 | Q1 2026 | Released | Core, Relations, PG features |
| 0.2.0 | Q2 2026 | Planned | Caching, Error messages, Zod ext. |
| 0.3.0 | Q3 2026 | Planned | Window funcs, CTEs, HAVING |
| 0.4.0 | Q4 2026 | Planned | Developer tools, Integrations |
| 0.5+ | 2027+ | Future | Based on community feedback |
| 1.0.0 | 2027 | Target | Stable release, LTS |

---

## Questions & Feedback

For roadmap feedback, feature requests, or questions:
1. Open a GitHub issue with `roadmap` label
2. Start a discussion in GitHub Discussions
3. Contact maintainers directly

Your input shapes the future of pg-query-composer!

---

**Document Version:** 1.0
**Last Updated:** 2026-02-11
**Next Review:** 2026-05-11 (Quarterly)
