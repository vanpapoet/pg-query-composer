# Code Standards & Conventions

## TypeScript Configuration

### Compiler Settings
- **Target:** ES2022 (modern JavaScript features)
- **Module:** CommonJS (Node.js compatibility)
- **Strict Mode:** **Enabled** (non-negotiable)
  - noImplicitAny: true
  - strictNullChecks: true
  - strictFunctionTypes: true
  - All other strict options enabled

### Type Checking
- Declaration maps enabled (source map + type defs)
- Source maps generated for debugging
- Import-type separation required (`import type { ... }`)

## File Organization

### Directory Structure
```
src/
├── core/          (Query building foundation)
├── composition/   (Reusable fragments & scopes)
├── subquery/      (Subquery utilities)
├── relations/     (Model & relation system)
├── types/         (Type-safe wrappers)
├── pg/            (PostgreSQL features)
├── utils/         (General utilities)
└── index.ts       (Barrel export)
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `query-composer.ts`, `zod-utils.ts` |
| Classes | PascalCase | `QueryComposer`, `TypedQueryComposer` |
| Interfaces | PascalCase | `Condition`, `JoinConfig`, `RelationConfig` |
| Types | PascalCase | `QueryOperator`, `SortDirection` |
| Functions | camelCase | `createQueryComposer`, `dateRange` |
| Constants | UPPER_SNAKE_CASE | `OPERATORS`, `VALID_OPERATORS` |
| Private fields | #field or private field | `#conditions` or `private schema` |
| Parameters | camelCase | `schema`, `fieldOperator`, `batchFn` |

### File Size Constraints
- **Max 200 lines per file** (strict limit for maintainability)
- Larger modules split into multiple focused files
- Example: `relations/` split into define.ts, include.ts, loader.ts, types.ts

## Import Conventions

### Import Organization
Order imports as:
1. External dependencies (squel, zod, etc.)
2. Internal modules (use relative paths)
3. Type imports (use `import type`)
4. Side-effect imports (minimal)

```typescript
import squel from 'squel';
import * as z from 'zod';

import { extractZodColumns } from '../utils/zod-utils';
import { OPERATORS, VALID_OPERATORS } from './operators';

import type { QueryOperator, Condition } from './types';
```

### Export Conventions
- Prefer named exports for functions/types/classes
- Barrel exports in index.ts for module namespacing
- Separate type exports: `export type { TypeName }`

```typescript
// In specific module
export class QueryComposer { /* ... */ }
export function createQueryComposer() { /* ... */ }
export type { QueryOperator } from './types';

// In index.ts
export { QueryComposer, createQueryComposer } from './core/query-composer';
```

## Code Style

### Spacing & Formatting
- Indent: 2 spaces (no tabs)
- Line length: Soft limit 100 chars (hard limit 120)
- Always semicolons
- Single quotes in code, double in comments

### Comments & Documentation

#### JSDoc Required For:
- All public classes
- All public methods/functions
- Complex algorithms or non-obvious logic

```typescript
/**
 * Advanced SQL Query Composer with operator support
 *
 * @example
 * const composer = new QueryComposer(schema, 'users');
 * composer.where('email__contains', 'example.com');
 * const { sql, values } = composer.build();
 */
export class QueryComposer { /* ... */ }
```

#### Comment Types
- `//` for single-line implementation notes
- `/** */` for public API documentation
- `// SECTION: Title` for logical code sections
- `// TODO:` for tracked improvements (minimal)

### Private vs Public
- Mark private fields with `private` keyword (not #)
- Use `readonly` for immutable properties
- Avoid exposing internal state

```typescript
private conditions: Condition[] = [];
private readonly whitelist: readonly string[];
```

## Design Patterns & Conventions

### Builder Pattern
All query-building methods follow patterns:
- Return `this` for method chaining
- Immutable state where possible (copy-on-write for large structures)
- Single entry point (constructor) for initialization

```typescript
class QueryComposer {
  where(column: string, value: unknown): this {
    this.conditions.push({ column, operator, value });
    return this;
  }
}
```

### Factory Functions
Create instances with sensible defaults:

```typescript
export function createQueryComposer(
  schema: z.ZodTypeAny,
  table: string,
  options?: QueryBuilderOptions
): QueryComposer {
  return new QueryComposer(schema, table, options);
}
```

### Error Handling

#### Custom Errors
All custom errors extend `QueryComposerError`:

```typescript
export class InvalidColumnError extends QueryComposerError {
  constructor(column: string, whitelist: readonly string[]) {
    super(
      `Invalid column "${column}". Valid columns: ${whitelist.join(', ')}`
    );
    this.name = 'InvalidColumnError';
  }
}
```

#### Error Throwing Rules
- Validate input early (constructor or method start)
- Throw with context (not just "invalid")
- Catch only specific errors
- Re-throw unknown errors

```typescript
private validateColumn(column: string): boolean {
  const isValid = this.whitelist.includes(column);
  if (!isValid && this.options.strict) {
    throw new InvalidColumnError(column, this.whitelist);
  }
  return isValid;
}
```

### Type Safety

#### Generics
- Use explicit type parameters where inferencing unclear
- Constraint types for narrower scope

```typescript
// Good: Clear constraint
function createTypedComposer<T extends z.ZodTypeAny>(schema: T): TypedQueryComposer<T>

// Avoid: Too loose
function createTypedComposer<T>(schema: T): TypedQueryComposer<T>
```

#### Type Guards
Use discriminated unions for complex types:

```typescript
type Condition =
  | { type: 'simple'; column: string; value: unknown }
  | { type: 'raw'; rawCondition: string };
```

#### Avoid `any`
Always use explicit types; use `unknown` + type guard if needed:

```typescript
// Bad
function process(value: any): any { /* ... */ }

// Good
function process(value: unknown): string {
  if (typeof value === 'string') return value;
  throw new TypeError('Expected string');
}
```

## Testing Conventions

### Test File Organization
- Test files mirror src structure: `tests/{module}/{file}.test.ts`
- One test file per source file
- Group tests with `describe()` blocks

```typescript
describe('QueryComposer', () => {
  describe('#where', () => {
    it('should add simple WHERE conditions', () => {
      // Test
    });
  });
});
```

### Test Structure (AAA Pattern)
Arrange → Act → Assert

```typescript
it('should validate columns', () => {
  // Arrange
  const schema = z.object({ email: z.string() });
  const composer = new QueryComposer(schema, 'users');

  // Act & Assert
  expect(() => composer.where('invalid__exact', 'value'))
    .toThrow(InvalidColumnError);
});
```

### Zod Schema Testing
All tests use Zod schemas, never raw objects:

```typescript
// Good
const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});
const composer = new QueryComposer(userSchema, 'users');

// Avoid: Raw objects
const schema = { id: 'number', email: 'string' };
```

### SQL Assertion
Verify parameterized queries for correctness:

```typescript
it('should build parameterized query', () => {
  const composer = new QueryComposer(schema, 'users');
  composer.where('email__contains', 'example.com');
  const { sql, values } = composer.build();

  expect(sql).toContain('WHERE');
  expect(sql).toContain('$1'); // Parameterized placeholder
  expect(values).toEqual(['%example.com%']);
});
```

### Test Coverage Goals
- Line coverage: 85%+
- Branch coverage: 80%+
- Function coverage: 90%+
- All public APIs tested
- Edge cases for operators

## Operator Implementation

### Adding New Operators

1. **Update `core/types.ts`** - Add operator to union:
```typescript
export type ComparisonOperator = 'exact' | 'notexact' | 'newop';
```

2. **Implement handler in `core/operators.ts`** - Return WHERE clause builder:
```typescript
export const OPERATORS: Record<QueryOperator, OperatorHandler> = {
  newop: (field, value) => field.like(value),
};
```

3. **Update `VALID_OPERATORS` array** - Include in validation list

4. **Add tests** - Test in `tests/core/operators.test.ts`

5. **Document** - Update project-overview-pdr.md operator table

## Dependency Management

### Runtime Dependencies
- squel: SQL builder (minimal API surface)
- zod: Schema validation (only for schema introspection)

### Peer Dependencies
- zod: Must be installed by consumer (schema definition)

### Dev Dependencies
- TypeScript: Compilation & type checking
- Vitest: Testing framework
- dataloader: Batch loading (optional for consumers)

### Adding Dependencies
- **Avoid:** Runtime deps unless essential (keep library lean)
- **Use:** TypeScript types from @types packages
- **Document:** Update package.json and docs

## Performance Considerations

### Query Building
- Avoid premature optimization in builder
- Lazy evaluation where possible
- One SQL generation pass (no rebuilding)

### Batch Loading
- Always use DataLoader for N+1 prevention
- Batch size configurable, default reasonable
- Cache results between requests

### Type Checking
- TypeScript compilation should complete in < 5s
- Avoid circular dependencies
- Use type-only imports to reduce bundle

## Documentation Requirements

### Code Comments
- Explain "why", not "what" (code explains what)
- Reference design patterns and decisions
- Note performance implications

### README (Module Level)
Each module should have clear export documentation in main index.ts JSDoc.

### Examples in Tests
- Integration tests serve as usage examples
- Real-world scenarios in `tests/integration/`

## Deprecation Policy

When deprecating features:
1. Mark with `@deprecated` JSDoc tag
2. Provide replacement in message
3. Keep for at least 2 minor versions
4. Remove only in major version

```typescript
/**
 * @deprecated Use `newMethod()` instead. Will be removed in v2.0.0.
 */
export function oldMethod() { /* ... */ }
```

## Review Checklist

Before committing code:

- [ ] TypeScript strict mode passes (no `any`, no errors)
- [ ] All tests pass (test:watch or npm test)
- [ ] New public APIs have JSDoc comments
- [ ] No circular dependencies
- [ ] File size under 200 lines
- [ ] Operators properly implemented and tested
- [ ] Error handling includes context
- [ ] SQL queries are parameterized (no string concat)
- [ ] Exports in index.ts updated if needed
- [ ] No console.log() in production code

---

**Document Version:** 1.0
**Last Updated:** 2026-02-07
**Maintainer:** Development Team
