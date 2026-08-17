import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;

// ── Security & Token Exhaustion Limits ────────────────────────────────────
const MAX_FILE_COUNT = 100; // Reduced to save processing time
const MAX_FILE_SIZE_BYTES = 50_000; // 50 KB max per file
const MAX_CHUNK_BYTES = 24_000; // ~6000 tokens
const MAX_TOTAL_CHUNKS = 5; // ~30,000 tokens max per repo to prevent infinite bills
const GIT_CLONE_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 30_000;
const FILE_FETCH_TIMEOUT_MS = 10_000;

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

// Expanded blacklists to heavily filter out junk
const IGNORED_DIRECTORIES = [
  'node_modules', 'dist', '.git', '.next', 'build', 'out', 'coverage',
  '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'public', 'assets', 'vendor'
];

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  '.pyc', '.pyo', '.class', '.o', '.obj',
  '.db', '.sqlite', '.sqlite3', '.ds_store', '.map'
]);

const IGNORED_EXACT_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'cargo.lock', 'poetry.lock', 'gemfile.lock', '.ds_store', 'thumbs.db'
]);

function shouldIgnoreFile(filePath: string): boolean {
  const parts = filePath.split('/');
  if (parts.some((part) => IGNORED_DIRECTORIES.includes(part.toLowerCase()))) return true;

  const fileName = parts[parts.length - 1].toLowerCase();
  if (IGNORED_EXACT_FILES.has(fileName)) return true;

  const ext = path.extname(fileName).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) return true;

  return false;
}

export async function cloneAndParseRepo(githubUrl: string): Promise<string[]> {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    const headers = getHeaders();

    // 1. Fetch Repository Info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!repoRes.ok) throw new Error(`GitHub API error (${repoRes.status}): Unable to fetch metadata.`);
    const repoData = (await repoRes.json()) as { default_branch: string };
    const defaultBranch = repoData.default_branch || 'main';

    // 2. Fetch recursive git tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );

    if (!treeRes.ok) throw new Error(`GitHub API error (${treeRes.status}): Failed to fetch file tree.`);
    const treeData = (await treeRes.json()) as { tree?: TreeItem[] };
    if (!treeData.tree) throw new Error(`Invalid repository tree structure.`);

    // 3. Filter tree for code files
    let codeFiles = treeData.tree
      .filter((item) => item.type === 'blob' && !shouldIgnoreFile(item.path))
      .filter((item) => !item.size || item.size <= MAX_FILE_SIZE_BYTES);

    // 4. SMART SORTING: Prioritize the most important files first so they aren't cut off by the byte limit
    codeFiles.sort((a, b) => {
      const aLower = a.path.toLowerCase();
      const bLower = b.path.toLowerCase();

      const getScore = (p: string) => {
        if (p.includes('readme.md')) return 100;
        if (p.includes('package.json') || p.includes('requirements.txt')) return 90;
        if (p.startsWith('src/') || p.startsWith('app/') || p.startsWith('lib/')) return 80;
        return 0; // Everything else
      };

      return getScore(bLower) - getScore(aLower);
    });

    codeFiles = codeFiles.slice(0, MAX_FILE_COUNT);

    if (codeFiles.length === 0) return [`// --- Repository: ${owner}/${repo} ---\n// No matching code files found.`];

    // 5. Fetch raw contents and enforce strict byte limit per chunk
    const chunks: string[] = [];
    let currentChunk = '';
    let currentChunkBytes = 0;

    for (const file of codeFiles) {
      if (chunks.length >= MAX_TOTAL_CHUNKS) {
        console.warn(`[GitHub Scraper] Reached max chunks (${MAX_TOTAL_CHUNKS}) for ${owner}/${repo}.`);
        break;
      }

      try {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`,
          { headers, signal: AbortSignal.timeout(FILE_FETCH_TIMEOUT_MS) }
        );

        if (rawRes.ok) {
          const fileContent = await rawRes.text();
          if (Buffer.byteLength(fileContent, 'utf8') > MAX_FILE_SIZE_BYTES) continue;

          const chunkText = `// --- File: ${file.path} ---\n${fileContent.trim()}\n`;
          const chunkBytes = Buffer.byteLength(chunkText, 'utf8');

          if (currentChunkBytes + chunkBytes > MAX_CHUNK_BYTES && currentChunkBytes > 0) {
            chunks.push(currentChunk);
            currentChunk = '';
            currentChunkBytes = 0;
          }

          if (chunks.length >= MAX_TOTAL_CHUNKS) {
            break;
          }

          currentChunk += chunkText;
          currentChunkBytes += chunkBytes;
        }
      } catch (fileErr) {
        console.warn(`[GitHub Scraper] Timeout fetching ${file.path}`);
      }
    }

    if (currentChunkBytes > 0 && chunks.length < MAX_TOTAL_CHUNKS) {
      chunks.push(currentChunk);
    }

    if (chunks.length === 0) return [`// --- Repository: ${owner}/${repo} ---\n// No matching code files found.`];

    return chunks;
  } catch (error) {
    console.error(`[GitHub Scraper Error] Failed to parse repository:`, error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Legacy & Scanner Helpers
// -----------------------------------------------------------------------------

export async function fetchRepoContext(repoUrl: string): Promise<{ tree: string; keyFiles: Record<string, string>; commits: string; }> {
  // Unchanged for legacy support
  const { owner, repo: name } = parseGitHubUrl(repoUrl);
  const headers = getHeaders();

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
  if (!repoRes.ok) throw new Error(`API error`);
  const repo = (await repoRes.json()) as { default_branch: string };
  const branch = repo.default_branch;

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`, { headers });
  if (!treeRes.ok) throw new Error(`API error`);
  const treeData = (await treeRes.json()) as { tree: TreeItem[] };
  const allFiles = treeData.tree.filter((f) => f.type === 'blob');

  const treeText = allFiles.map((f) => `${f.path}`).slice(0, 300).join('\n');
  return { tree: treeText, keyFiles: {}, commits: "" };
}

export async function runGitleaks(repoUrl: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grader-'));
  try {
    execFileSync('git', ['clone', '--depth=1', '--quiet', repoUrl, path.join(tmpDir, 'repo')], { stdio: 'pipe', timeout: GIT_CLONE_TIMEOUT_MS });
    const reportPath = path.join(tmpDir, 'gitleaks.json');
    try {
      execFileSync('gitleaks', ['detect', `--source=${path.join(tmpDir, 'repo')}`, '--report-format=json', `--report-path=${reportPath}`, '--no-git'], { stdio: 'pipe', timeout: GIT_CLONE_TIMEOUT_MS });
      return '[]';
    } catch {
      if (fs.existsSync(reportPath)) return fs.readFileSync(reportPath, 'utf8');
      return '[]';
    }
  } catch (err) {
    return '[]';
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}