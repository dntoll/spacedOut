import { describe, expect, it } from 'vitest';
import requirements from '../req.md?raw';
import traceabilityTestSource from './requirements.test.ts?raw';

const testSources = import.meta.glob('./**/*.test.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

describe('requirement traceability', () => {
  it('REQ-19 gives every documented requirement an automated test', () => {
    const requirementIds = new Set(requirements.match(/REQ-\d+/g) ?? []);
    const coveredIds = new Set(
      [...Object.values(testSources), traceabilityTestSource]
        .flatMap((source) => source.match(/REQ-\d+/g) ?? []),
    );

    expect([...requirementIds].filter((id) => !coveredIds.has(id))).toEqual([]);
  });
});
