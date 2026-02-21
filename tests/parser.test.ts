import { describe, it, expect } from 'vitest';
import { parseSymbols } from '../src/parser.js';

describe('Static Parser (Babel)', () => {
    it('should extract top-level function declarations', () => {
        const code = `
      function calculateSum(a, b) { return a + b; }
      const arrowFn = (x) => x * 2;
    `;
        const result = parseSymbols(code);
        expect(result.functions).toContain('calculateSum');
        // Note: arrowFn is a VariableDeclaration, not a FunctionDeclaration
    });

    it('should extract top-level class declarations', () => {
        const code = `
      class UserProfile { constructor(name) { this.name = name; } }
    `;
        const result = parseSymbols(code);
        expect(result.classes).toContain('UserProfile');
    });

    it('should handle complex code without crashing', () => {
        const code = `
       import fs from 'fs';
       export const x = 1;
       async function fetchData() {}
    `;
        const result = parseSymbols(code);
        expect(result.functions).toContain('fetchData');
    });
});
