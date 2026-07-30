/**
 * Path authorisation for endpoints that take a directory from the caller.
 *
 * The server has no authentication and the same build is deployed publicly on
 * Railway, so any endpoint that accepts a filesystem path is reachable by
 * anyone who can reach the process. Confining reads to the user's own home
 * directory is what keeps `?dir=/etc` from being a question the server answers.
 *
 * routes/filesystem.ts carries an older copy of this logic with a wider
 * allowlist (it also permits /Users, /home and drive roots, because it is a
 * file *browser*). New code should use this one: it is deliberately narrower.
 */

import { realpathSync } from 'fs';
import { homedir } from 'os';
import { normalize, resolve, sep } from 'path';

/**
 * True when `targetPath` resolves inside the current user's home directory.
 *
 * Symlinks are resolved first: without realpath, `~/link-to-root/etc/passwd`
 * passes a prefix check while pointing outside home. A path that does not
 * exist yet is normalised instead, since a caller may legitimately name a
 * project directory that has not been created.
 */
export function isProjectPathAllowed(targetPath: string): boolean {
  let canonical: string;
  try {
    canonical = realpathSync(targetPath);
  } catch {
    canonical = normalize(resolve(targetPath));
  }

  let home: string;
  try {
    home = realpathSync(homedir());
  } catch {
    home = normalize(resolve(homedir()));
  }

  if (canonical === home) return true;
  // The separator matters: without it, `/home/harry-evil` passes as `/home/harry`.
  return canonical.startsWith(home.endsWith(sep) ? home : home + sep);
}

/**
 * True when this process is a hosted deployment rather than a user's own
 * machine. Features that inspect the local filesystem or local processes are
 * meaningless there and should refuse rather than answer, because "there" is a
 * shared container that no user owns.
 */
export function isHostedDeployment(): boolean {
  return !!(
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN
  );
}
