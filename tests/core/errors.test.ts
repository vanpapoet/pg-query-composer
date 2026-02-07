import { describe, it, expect } from 'vitest';
import {
  InvalidColumnError,
  InvalidOperatorError,
  RelationNotFoundError,
  SubqueryError,
  TypeMismatchError,
} from '../../src/core/errors';

describe('Error Classes', () => {
  describe('InvalidColumnError', () => {
    it('includes column name in message', () => {
      const error = new InvalidColumnError('bad_column', ['id', 'name']);
      expect(error.message).toContain('bad_column');
      expect(error.message).toContain('id, name');
      expect(error.name).toBe('InvalidColumnError');
    });

    it('is instance of Error', () => {
      const error = new InvalidColumnError('col', ['a']);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('InvalidOperatorError', () => {
    it('includes operator name in message', () => {
      const error = new InvalidOperatorError('bad_operator');
      expect(error.message).toContain('bad_operator');
      expect(error.name).toBe('InvalidOperatorError');
    });

    it('includes valid operators in message', () => {
      const error = new InvalidOperatorError('fake');
      expect(error.message).toContain('exact');
      expect(error.message).toContain('contains');
    });
  });

  describe('RelationNotFoundError', () => {
    it('includes relation and model in message', () => {
      const error = new RelationNotFoundError('posts', 'User');
      expect(error.message).toContain('posts');
      expect(error.message).toContain('User');
      expect(error.name).toBe('RelationNotFoundError');
    });
  });

  describe('SubqueryError', () => {
    it('includes error message', () => {
      const error = new SubqueryError('invalid subquery syntax');
      expect(error.message).toContain('invalid subquery syntax');
      expect(error.name).toBe('SubqueryError');
    });
  });

  describe('TypeMismatchError', () => {
    it('includes field, expected, and received types', () => {
      const error = new TypeMismatchError('age', 'number', 'string');
      expect(error.message).toContain('age');
      expect(error.message).toContain('number');
      expect(error.message).toContain('string');
      expect(error.name).toBe('TypeMismatchError');
    });
  });
});
