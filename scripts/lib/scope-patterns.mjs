/**
 * Pass-category pattern buckets for CortexScope Index MAP phase.
 * Regex patterns scan file content; path patterns match file paths.
 */

export const PASS_CATEGORIES = [
  'correctness',
  'security',
  'errorHandling',
  'performance',
  'tests',
  'simplicity',
  'cleanup',
];

/** @type {Record<string, Array<{ id: string, regex?: RegExp, pathTest?: RegExp }>>} */
export const PASS_PATTERN_BUCKETS = {
  correctness: [
    { id: 'todo', regex: /\b(TODO|FIXME|HACK|XXX)\b/i },
    { id: 'race', regex: /\b(mutex|lock|atomic|race|concurrent|parallel)\b/i },
    { id: 'null-check', regex: /\b(null|undefined)\s*[!=]==/ },
  ],
  security: [
    { id: 'password', regex: /\b(password|passwd|secret|api[_-]?key|token)\b/i },
    { id: 'jwt', regex: /\bjwt\b/i },
    { id: 'eval', regex: /\beval\s*\(/ },
    { id: 'innerHTML', regex: /\.innerHTML\s*=/ },
    { id: 'sql', regex: /\b(SELECT|INSERT|UPDATE|DELETE)\b.*\+/i },
    { id: 'exec', regex: /\b(exec|spawn|shell)\s*\(/i },
  ],
  errorHandling: [
    { id: 'empty-catch', regex: /catch\s*\(\s*[^)]*\)\s*\{\s*\}/ },
    { id: 'silent-catch', regex: /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/ },
    { id: 'throw-string', regex: /throw\s+['"`]/ },
  ],
  performance: [
    { id: 'interval', regex: /\bsetInterval\s*\(/ },
    { id: 'sync-io', regex: /\b(readFileSync|writeFileSync|execSync)\s*\(/ },
    { id: 'loop-query', regex: /for\s*\([^)]+\)\s*\{[^}]*\.(find|query|select|get)\(/i },
  ],
  tests: [
    { id: 'test-file', pathTest: /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i },
    { id: 'describe', regex: /\b(describe|it|test)\s*\(/ },
  ],
  simplicity: [
    { id: 'eslint-disable', regex: /eslint-disable/ },
    { id: 'deep-nesting', regex: /\{[^{}]*\{[^{}]*\{[^{}]*\{/ },
  ],
  cleanup: [
    { id: 'deprecated', regex: /@deprecated\b/i },
    { id: 'unused-export', regex: /export\s+(const|function|class)\s+\w+/ },
  ],
};

export const ENTRY_POINT_PATTERNS = [
  /(?:^|\/)main\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs)$/i,
  /(?:^|\/)index\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /(?:^|\/)app\.(ts|tsx|js|jsx|py)$/i,
  /(?:^|\/)server\.(ts|tsx|js|jsx|py|go)$/i,
  /Controller\./i,
  /Route\./i,
  /Handler\./i,
  /\/ipc\//i,
  /middleware/i,
  /\/electron\/main/i,
  /preload/i,
  /background/i,
];

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isEntryPoint(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return ENTRY_POINT_PATTERNS.some((p) => p.test(norm));
}

/**
 * @param {string} content
 * @param {string} filePath
 * @returns {Record<string, string[]>}
 */
export function scanFileForPatterns(content, filePath) {
  const norm = filePath.replace(/\\/g, '/');
  /** @type {Record<string, string[]>} */
  const hits = {};
  for (const cat of PASS_CATEGORIES) {
    hits[cat] = [];
    for (const pat of PASS_PATTERN_BUCKETS[cat] || []) {
      if (pat.pathTest && pat.pathTest.test(norm)) {
        hits[cat].push(pat.id);
      } else if (pat.regex && pat.regex.test(content)) {
        hits[cat].push(pat.id);
      }
    }
  }
  return hits;
}
