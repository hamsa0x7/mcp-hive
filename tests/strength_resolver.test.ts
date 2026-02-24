import { describe, it, expect } from 'vitest';
import { resolveRequiredStrength } from '../src/resolver.js';

describe('Strength Resolver Contract', () => {
    it('should prefer explicit requested strength when valid', () => {
        const strength = resolveRequiredStrength('security_specialist', 'performance_analysis');
        expect(strength).toBe('performance_analysis');
    });

    it('should map common role aliases to supported strengths', () => {
        const strength = resolveRequiredStrength('security_specialist');
        expect(strength).toBe('security_detection');
    });

    it('should default to architecture_analysis for unknown roles', () => {
        const strength = resolveRequiredStrength('totally_unknown_role');
        expect(strength).toBe('architecture_analysis');
    });
});
