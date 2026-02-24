import { describe, it, expect } from 'vitest';
import { repairJson, structuralRepair } from '../src/repair.js';

describe('JSON Repair Utility', () => {
    it('should strip markdown wrappers', () => {
        const raw = '```json\n[{"type": "vuln"}]\n```';
        expect(JSON.parse(repairJson(raw))).toEqual([{ "type": "vuln" }]);
    });

    it('should extract JSON from surrounding text', () => {
        const raw = 'Here is the result: {"type": "info"} follow-up text.';
        expect(JSON.parse(repairJson(raw))).toEqual({ "type": "info" });
    });

    it('should fix trailing commas', () => {
        const raw = '[{"a": 1,}, {"b": 2},]';
        const repaired = repairJson(raw);
        expect(JSON.parse(repaired)).toEqual([{ "a": 1 }, { "b": 2 }]);
    });
});

describe('Structural Coercion', () => {
    it('should wrap a single finding object in an array', () => {
        const single = { type: 'vuln', severity: 'high', description: 'test' };
        const coerced = structuralRepair(single);
        expect(coerced).toBeInstanceOf(Array);
        expect(coerced).toHaveLength(1);
        expect(coerced[0].type).toBe('vuln');
    });

    it('should leave an existing array alone', () => {
        const arr = [{ type: 'vuln' }];
        expect(structuralRepair(arr)).toEqual(arr);
    });
});
