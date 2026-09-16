import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('uses the UserAuth API route when no URL is configured', () => {
    expect(resolveApiBaseUrl()).toBe('http://localhost:5133/api');
  });

  it('removes a trailing slash from a configured URL', () => {
    expect(resolveApiBaseUrl('http://example.test/api/')).toBe('http://example.test/api');
  });
});
