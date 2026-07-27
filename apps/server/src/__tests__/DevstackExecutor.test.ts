/**
 * Tests for the devstack CLI executor.
 *
 * Two things here are load-bearing and both are easy to get quietly wrong.
 * First, envelope parsing: the CLI is invoked through a Node that may print
 * npm engine warnings to stdout before the JSON, so a naive JSON.parse of the
 * whole stream fails on exactly the machines devstack targets. Second, the
 * read-only verb allowlist: this executor is reachable from an unauthenticated
 * HTTP server, and `up` boots Docker containers.
 *
 * Kept in its own file because the service suite mocks this module wholesale.
 */

import { describe, expect, it } from 'vitest';
import { DevstackExecutor, DevstackNotInstalledError } from '../cli/DevstackExecutor';

const executor = DevstackExecutor.getInstance();

/** parseEnvelope is private; call it the way the class does internally. */
const parse = (stdout: string) =>
  (executor as unknown as { parseEnvelope: (s: string) => unknown }).parseEnvelope(stdout);

describe('DevstackExecutor', () => {
  describe('envelope parsing', () => {
    it('reads a clean envelope', () => {
      const out =
        '{"schemaVersion":1,"ok":true,"command":"status","elapsedMs":3,"data":{"present":false}}';

      expect(parse(out)).toEqual({
        schemaVersion: 1,
        ok: true,
        command: 'status',
        elapsedMs: 3,
        data: { present: false },
      });
    });

    it('ignores npm engine warnings printed before the envelope', () => {
      // Verbatim shape of what npm prints when running devstack under a Node
      // its transitive deps dislike - observed on Node 25 with ini@7.
      const noisy = [
        'npm warn EBADENGINE Unsupported engine {',
        "npm warn EBADENGINE   package: 'ini@7.0.0',",
        'npm warn EBADENGINE }',
        '{"schemaVersion":1,"ok":true,"command":"doctor","elapsedMs":317,"data":{"reports":[]}}',
      ].join('\n');

      expect(parse(noisy)).toMatchObject({ ok: true, command: 'doctor' });
    });

    it('keeps ok:false envelopes rather than treating them as failures to parse', () => {
      const failed = '{"schemaVersion":1,"ok":false,"command":"config","elapsedMs":1,"data":null}';

      expect(parse(failed)).toMatchObject({ ok: false, command: 'config' });
    });

    it('defaults a missing schemaVersion instead of rejecting the envelope', () => {
      expect(parse('{"ok":true,"command":"status","data":{}}')).toMatchObject({
        schemaVersion: 1,
        elapsedMs: 0,
      });
    });

    it('rejects output that is not JSON at all', () => {
      expect(() => parse('devstack: command not found')).toThrow(/no JSON output/);
    });

    it('rejects malformed JSON', () => {
      expect(() => parse('{"ok":true,')).toThrow(/not valid JSON/);
    });

    it('rejects JSON that is not a devstack envelope', () => {
      // A different tool answering on the same name would otherwise be trusted.
      expect(() => parse('{"hello":"world"}')).toThrow(/not a recognised envelope/);
    });
  });

  describe('verb allowlist', () => {
    it('refuses a mutating verb even when it is forced past the type', async () => {
      // `up` requires Docker and starts containers; an unauthenticated POST
      // must never reach it.
      await expect(executor.run('up' as never, [], { cwd: process.cwd() })).rejects.toThrow(
        /non-read-only verb/
      );
    });

    it('checks the allowlist before it checks for the binary', async () => {
      // Order matters: if absence were checked first, the refusal would leak
      // as "not installed" and look like a fixable environment problem.
      await expect(
        executor.run('wipe' as never, [], { cwd: '/nonexistent-project-dir' })
      ).rejects.not.toBeInstanceOf(DevstackNotInstalledError);
    });
  });

  describe('binary resolution', () => {
    it('reports absence rather than throwing', () => {
      expect(executor.resolveBinary('/nonexistent-project-dir')).toBeNull();
      expect(executor.isInstalled('/nonexistent-project-dir')).toBe(false);
    });
  });
});
