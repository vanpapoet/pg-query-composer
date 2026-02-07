import { VALID_OPERATORS } from './operators';

/**
 * Base error class for pg-query-composer
 */
export class QueryComposerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryComposerError';
  }
}

/**
 * Error thrown when an invalid column is used
 */
export class InvalidColumnError extends QueryComposerError {
  constructor(column: string, allowed: readonly string[]) {
    super(`Invalid column '${column}'. Allowed columns: ${allowed.join(', ')}`);
    this.name = 'InvalidColumnError';
  }
}

/**
 * Error thrown when an invalid operator is used
 */
export class InvalidOperatorError extends QueryComposerError {
  constructor(operator: string) {
    super(`Invalid operator '${operator}'. Valid operators: ${VALID_OPERATORS.join(', ')}`);
    this.name = 'InvalidOperatorError';
  }
}

/**
 * Error thrown when relation is not found
 */
export class RelationNotFoundError extends QueryComposerError {
  constructor(relation: string, model: string) {
    super(`Relation '${relation}' not found on model '${model}'`);
    this.name = 'RelationNotFoundError';
  }
}

/**
 * Error thrown when subquery fails to build
 */
export class SubqueryError extends QueryComposerError {
  constructor(message: string) {
    super(`Subquery error: ${message}`);
    this.name = 'SubqueryError';
  }
}

/**
 * Error thrown when type mismatch occurs
 */
export class TypeMismatchError extends QueryComposerError {
  constructor(field: string, expected: string, received: string) {
    super(`Type mismatch for '${field}': expected ${expected}, received ${received}`);
    this.name = 'TypeMismatchError';
  }
}
