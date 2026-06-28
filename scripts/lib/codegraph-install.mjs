/**
 * Optional codegraph CLI install + project init helpers.
 * External tool — CortexLoop never bundles the binary; npm global install only.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const CODEGRAPH_PACKAGE = '@colbymchenry/codegraph';

// We invoke `codegraph --version` as a single string with shell:true rather than
// passing an args array. On Windows the npm-global bin is a .cmd shim that needs
// shell resolution; on posix Node resolves PATH directly. Using the string form
// (no args array) avoids Node's DEP0190 deprecation while keeping .cmd resolution
// intact. The command is a fixed literal, so there is no shell-injection surface.
const SHELL_PLATFORM = process.platform === 'win32';

/**
 * @returns {boolean}
 */
export function detectCodegraphCli() {
  try {
    const r = spawnSync('codegraph --version', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
      shell: SHELL_PLATFORM,
    });
    return r.status === 0 && Boolean(String(r.stdout || '').trim());
  } catch {
    return false;
  }
}

/**
 * @returns {string|null}
 */
export function codegraphCliVersion() {
  try {
    const r = spawnSync('codegraph --version', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
      shell: SHELL_PLATFORM,
    });
    if (r.status !== 0) return null;
    return String(r.stdout || '').trim() || null;
  } catch {
    return null;
  }
}

/**
 * @param {string} [rootDir]
 * @returns {boolean}
 */
export function detectCodegraphProjectIndex(rootDir = '.') {
  return existsSync(resolve(rootDir, '.codegraph'));
}

/**
 * Query `codegraph status --json` for index freshness metadata. This is the
 * I-2 indexHealth signal: pendingChanges.{added,modified,removed} > 0 means
 * the index is stale relative to the working tree and needs `codegraph sync`;
 * worktreeMismatch non-null means the index was built against a different
 * worktree/branch.
 *
 * Returns the parsed status object, or null when the CLI is unavailable, the
 * project is not initialized, or any error occurs (callers treat null as
 * "health unknown — rely on existence only").
 *
 * @param {string} [rootDir]
 * @returns {object|null}
 */
export function codegraphIndexStatus(rootDir = '.') {
  try {
    const r = spawnSync('codegraph status --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
      shell: SHELL_PLATFORM,
      cwd: resolve(rootDir),
    });
    if (r.status !== 0) return null;
    const out = String(r.stdout || '').trim();
    if (!out) return null;
    const status = JSON.parse(out);
    if (status && status.initialized === false) return null;
    return status;
  } catch {
    return null;
  }
}

/**
 * Install codegraph CLI globally via npm (requires Node + npm on PATH).
 * @param {{ dryRun?: boolean }} [opts]
 */
export function installCodegraphCli(opts = {}) {
  if (opts.dryRun) {
    return { ok: true, command: `npm install -g ${CODEGRAPH_PACKAGE}`, dryRun: true };
  }
  execSync(`npm install -g ${CODEGRAPH_PACKAGE}`, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (!detectCodegraphCli()) {
    throw new Error('codegraph CLI not found on PATH after npm install — restart shell or check npm global bin');
  }
  return { ok: true, version: codegraphCliVersion() };
}

/**
 * @param {string} [rootDir]
 * @param {{ dryRun?: boolean }} [opts]
 */
export function initCodegraphProject(rootDir = '.', opts = {}) {
  const cwd = resolve(rootDir);
  if (opts.dryRun) {
    return { ok: true, command: 'codegraph init -i', cwd, dryRun: true };
  }
  execSync('codegraph init -i', {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (!detectCodegraphProjectIndex(cwd)) {
    throw new Error('codegraph init finished but .codegraph/ not found');
  }
  return { ok: true, indexPath: resolve(cwd, '.codegraph') };
}

/**
 * @param {string} [rootDir]
 * @param {{ dryRun?: boolean, skipInstall?: boolean }} [opts]
 */
export function installAndInitCodegraph(rootDir = '.', opts = {}) {
  const steps = [];
  if (!opts.skipInstall && !detectCodegraphCli()) {
    steps.push(installCodegraphCli(opts));
  }
  if (!detectCodegraphProjectIndex(rootDir)) {
    steps.push(initCodegraphProject(rootDir, opts));
  }
  return {
    ok: true,
    cliVersion: codegraphCliVersion(),
    indexPresent: detectCodegraphProjectIndex(rootDir),
    steps,
  };
}
