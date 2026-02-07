import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { QueryComposer } from '../../src/core/query-composer';
import {
  jsonbContains,
  jsonbHasKey,
  jsonbHasAllKeys,
  jsonbHasAnyKey,
  jsonbPath,
  jsonbPathText,
  jsonbExtract,
} from '../../src/pg/jsonb';

const MetadataSchema = z.object({
  id: z.string(),
  data: z.record(z.unknown()),
  settings: z.record(z.unknown()),
});

describe('JSONB Operators', () => {
  describe('jsonbContains()', () => {
    it('generates @> operator', () => {
      const filter = jsonbContains('data', { status: 'active' });
      expect(filter.__raw).toContain('@>');
      expect(filter.__raw).toContain('data');
    });

    it('can be used with where()', () => {
      const qc = new QueryComposer(MetadataSchema, 'items', { strict: false });
      qc.where(jsonbContains('data', { type: 'article' }));

      const { text } = qc.toParam();
      expect(text).toContain('@>');
    });
  });

  describe('jsonbHasKey()', () => {
    it('generates ? operator for single key', () => {
      const filter = jsonbHasKey('data', 'status');
      expect(filter.__raw).toContain('?');
      expect(filter.__raw).toContain('status');
    });
  });

  describe('jsonbHasAllKeys()', () => {
    it('generates ?& operator for all keys', () => {
      const filter = jsonbHasAllKeys('data', ['status', 'type']);
      expect(filter.__raw).toContain('?&');
    });
  });

  describe('jsonbHasAnyKey()', () => {
    it('generates ?| operator for any key', () => {
      const filter = jsonbHasAnyKey('data', ['status', 'type']);
      expect(filter.__raw).toContain('?|');
    });
  });

  describe('jsonbPath()', () => {
    it('generates path extraction', () => {
      const result = jsonbPath('data', ['user', 'profile', 'name']);
      expect(result).toContain('->');
      expect(result).toContain('data');
    });
  });

  describe('jsonbPathText()', () => {
    it('generates text path extraction', () => {
      const result = jsonbPathText('data', ['user', 'name']);
      expect(result).toContain('->>');
    });
  });

  describe('jsonbExtract()', () => {
    it('generates jsonb_extract_path', () => {
      const result = jsonbExtract('data', ['settings', 'theme']);
      expect(result).toContain('jsonb_extract_path');
    });
  });
});
