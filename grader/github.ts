import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;

// ── Security: Resource Exhaustion Limits ────────────────────────────────────
/** Maximum number of source files to ingest from a single repository. */
const MAX_FILE_COUNT = 500;
/** Maximum individual file size to fetch (100 KB). Files larger are skipped. */
const MAX_FILE_SIZE_BYTES = 100_000;
/** Maximum total concatenated output size (2 MB). Ingestion stops beyond this. */
const MAX_TOTAL_OUTPUT_BYTES = 2_000_000;
/** Timeout for git clone operations (30 seconds). */
const GIT_CLONE_TIMEOUT_MS = 30_000;
/** Timeout for GitHub API requests (30 seconds). */
const FETCH_TIMEOUT_MS = 30_000;
/** Timeout for individual raw file fetches (15 seconds). */
const FILE_FETCH_TIMEOUT_MS = 15_000;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ai-grading-system/1.0',
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `token ${GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Extracts owner and repository name from a GitHub URL.
 */
export function parseGitHubUrl(githubUrl: string): { owner: string; repo: string } {
  if (!githubUrl || typeof githubUrl !== 'string') {
    throw new Error('Invalid GitHub URL: URL string is required.');
  }

  const cleanedUrl = githubUrl.trim().replace(/\/$/, '').replace(/\.git$/, '');
  const match = cleanedUrl.match(/github\.com\/([^/]+)\/([^/]+)$/i);

  if (!match) {
    throw new Error(`Invalid GitHub repository URL format: "${githubUrl}". Expected format: https://github.com/owner/repo`);
  }

  return { owner: match[1], repo: match[2] };
}

interface TreeItem {
  path: string;
  type: string;
  size?: number;
  sha: string;
  url: string;
}

// Directory blacklists to strictly ignore
const IGNORED_DIRECTORIES = [
  'node_modules',
  'dist',
  '.git',
  '.next',
  'build',
  'out',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
];

// File extension blacklists for images, binaries, fonts, media, and compiled artifacts
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  '.pyc', '.pyo', '.class', '.o', '.obj',
  '.db', '.sqlite', '.sqlite3',
  '.ds_store'
]);

// Exact lock files or OS files to ignore
const IGNORED_EXACT_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'cargo.lock',
  'poetry.lock',
  'gemfile.lock',
  '.ds_store',
  'thumbs.db'
]);

/**
 * Determines whether a file path should be excluded based on directory, extension, or exact filename.
 */
function shouldIgnoreFile(filePath: string): boolean {
  const parts = filePath.split('/');

  // Check directory blacklist
  if (parts.some((part) => IGNORED_DIRECTORIES.includes(part.toLowerCase()))) {
    return true;
  }

  const fileName = parts[parts.length - 1].toLowerCase();

  // Check exact filename blacklist
  if (IGNORED_EXACT_FILES.has(fileName)) {
    return true;
  }

  // Check extension blacklist
  const ext = path.extname(fileName).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

/**
 * Fetches, filters, and flattens a GitHub repository's source code into a formatted single string for LLM processing.
 * 
 * Security hardening:
 *  - MAX_FILE_COUNT prevents processing repos with thousands of files.
 *  - MAX_FILE_SIZE_BYTES prevents fetching individual huge files.
 *  - MAX_TOTAL_OUTPUT_BYTES caps total memory used by the concatenated output.
 *
 * @param githubUrl Public GitHub repository URL (e.g. https://github.com/owner/repo)
 * @returns Formatted code string with clear file demarcations
 */
export async function cloneAndParseRepo(githubUrl: string): Promise<string> {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    const headers = getHeaders();

    // 1. Fetch Repository Info to obtain default branch
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        throw new Error(`Repository not found or private: ${owner}/${repo}`);
      }
      if (repoRes.status === 403 || repoRes.status === 429) {
        const rateLimitReset = repoRes.headers.get('x-ratelimit-reset');
        const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000).toLocaleTimeString() : 'later';
        throw new Error(`GitHub API rate limit exceeded. Please try again at ${resetTime} or configure GITHUB_PAT.`);
      }
      throw new Error(`GitHub API error (${repoRes.status}): Unable to fetch metadata for ${owner}/${repo}`);
    }

    const repoData = (await repoRes.json()) as { default_branch: string };
    const defaultBranch = repoData.default_branch || 'main';

    // 2. Fetch recursive git tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );

    if (!treeRes.ok) {
      throw new Error(`GitHub API error (${treeRes.status}): Failed to fetch file tree for ${owner}/${repo}`);
    }

    const treeData = (await treeRes.json()) as { tree?: TreeItem[]; truncated?: boolean };

    if (!treeData.tree || !Array.isArray(treeData.tree)) {
      throw new Error(`Invalid repository tree structure received for ${owner}/${repo}`);
    }

    // 3. Filter tree for code files, enforce MAX_FILE_COUNT
    const codeFiles = treeData.tree
      .filter((item) => item.type === 'blob' && !shouldIgnoreFile(item.path))
      .filter((item) => !item.size || item.size <= MAX_FILE_SIZE_BYTES)
      .slice(0, MAX_FILE_COUNT);

    if (codeFiles.length === 0) {
      return `// --- Repository: ${owner}/${repo} ---\n// No matching code files found.`;
    }

    // 4. Fetch raw contents and flatten into single LLM prompt string
    const flattenedChunks: string[] = [];
    let totalBytes = 0;

    for (const file of codeFiles) {
      // Guard: stop if total output exceeds MAX_TOTAL_OUTPUT_BYTES
      if (totalBytes >= MAX_TOTAL_OUTPUT_BYTES) {
        flattenedChunks.push(`\n// --- TRUNCATED: Output limit of ${MAX_TOTAL_OUTPUT_BYTES} bytes reached ---\n`);
        break;
      }

      try {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`,
          {
            headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
            signal: AbortSignal.timeout(FILE_FETCH_TIMEOUT_MS),
          }
        );

        if (rawRes.ok) {
          const fileContent = await rawRes.text();

          // Skip individual files that exceed the per-file size limit
          if (Buffer.byteLength(fileContent, 'utf8') > MAX_FILE_SIZE_BYTES) {
            continue;
          }

          const chunk = `// --- File: ${file.path} ---\n${fileContent.trim()}\n`;
          totalBytes += Buffer.byteLength(chunk, 'utf8');
          flattenedChunks.push(chunk);
        }
      } catch (fileErr) {
        console.warn(`[GitHub Scraper] Could not fetch raw content for ${file.path}:`, fileErr);
      }
    }

    return flattenedChunks.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[GitHub Scraper Error] Failed to parse repository "${githubUrl}":`, message);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Legacy & Scanner Helpers (Retained for existing workflows)
// -----------------------------------------------------------------------------

export async function fetchRepoContext(repoUrl: string): Promise<{
  tree: string;
  keyFiles: Record<string, string>;
  commits: string;
}> {
  const { owner, repo: name } = parseGitHubUrl(repoUrl);
  const headers = getHeaders();

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
  if (!repoRes.ok) throw new Error(`GitHub API ${repoRes.status}: /repos/${owner}/${name}`);
  const repo = (await repoRes.json()) as { default_branch: string };
  const branch = repo.default_branch;

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) throw new Error(`GitHub API ${treeRes.status}: git tree`);
  const treeData = (await treeRes.json()) as { tree: TreeItem[] };
  const allFiles = treeData.tree.filter((f) => f.type === 'blob');

  const treeText = allFiles.map((f) => `${f.path} (${f.size ?? 0}B)`).slice(0, 300).join('\n');

  const priority = ['README.md', 'package.json', 'requirements.txt', 'pyproject.toml', '.env.example'];
  const interesting = allFiles
    .filter(
      (f) =>
        priority.includes(path.basename(f.path)) ||
        ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'].some((ext) => f.path.endsWith(ext))
    )
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, 12);

  const keyFiles: Record<string, string> = {};
  for (const file of interesting) {
    const raw = await fetch(
      `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${file.path}`,
      { headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {} }
    );
    if (raw.ok) {
      const text = await raw.text();
      keyFiles[file.path] = text.slice(0, 3000);
    }
  }

  const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/commits?per_page=50`, { headers });
  const commitsData = commitsRes.ok ? ((await commitsRes.json()) as any[]) : [];
  const commits = commitsData
    .map((c) => `${c.commit.author.date.slice(0, 10)} ${c.commit.message.split('\n')[0]}`)
    .join('\n');

  return { tree: treeText, keyFiles, commits };
}

/**
 * SECURITY FIX: Replaced execSync (shell injection vulnerable) with execFileSync.
 * Arguments are passed as an array so no shell is spawned and user-controlled
 * input in repoUrl cannot break out into arbitrary commands.
 */
export async function runGitleaks(repoUrl: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grader-'));
  try {
    // execFileSync passes args as array — no shell spawned, no injection possible
    execFileSync('git', ['clone', '--depth=1', '--quiet', repoUrl, path.join(tmpDir, 'repo')], {
      stdio: 'pipe',
      timeout: GIT_CLONE_TIMEOUT_MS,
    });
    const reportPath = path.join(tmpDir, 'gitleaks.json');
    try {
      execFileSync('gitleaks', [
        'detect',
        `--source=${path.join(tmpDir, 'repo')}`,
        '--report-format=json',
        `--report-path=${reportPath}`,
        '--no-git',
      ], {
        stdio: 'pipe',
        timeout: GIT_CLONE_TIMEOUT_MS,
      });
      return '[]';
    } catch {
      if (fs.existsSync(reportPath)) return fs.readFileSync(reportPath, 'utf8');
      return '[]';
    }
  } catch (err) {
    console.warn('gitleaks scan failed (is gitleaks installed?):', (err as Error).message);
    return '[]';
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
