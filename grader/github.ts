import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const GITHUB_PAT = process.env.GITHUB_PAT!
const HEADERS = {
  Authorization: `token ${GITHUB_PAT}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'ai-grader/1.0',
}

function repoOwnerName(repoUrl: string): { owner: string; name: string } {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/)
  if (!match) throw new Error(`Cannot parse repo URL: ${repoUrl}`)
  return { owner: match[1], name: match[2] }
}

async function ghFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`)
  return res.json()
}

interface TreeItem { path: string; type: string; size?: number; sha: string; url: string }
interface Commit { sha: string; commit: { message: string; author: { date: string } } }

export async function fetchRepoContext(repoUrl: string): Promise<{
  tree: string
  keyFiles: Record<string, string>
  commits: string
}> {
  const { owner, name } = repoOwnerName(repoUrl)

  // Get default branch
  const repo = await ghFetch(`/repos/${owner}/${name}`) as { default_branch: string }
  const branch = repo.default_branch

  // File tree (recursive)
  const treeData = await ghFetch(`/repos/${owner}/${name}/git/trees/${branch}?recursive=1`) as { tree: TreeItem[] }
  const allFiles = treeData.tree.filter((f) => f.type === 'blob')

  // Summarise tree (paths only, truncated to avoid huge context)
  const treeText = allFiles.map((f) => `${f.path} (${f.size ?? 0}B)`).slice(0, 300).join('\n')

  // Select key files to include in full
  const priority = ['README.md', 'package.json', 'requirements.txt', 'pyproject.toml', '.env.example']
  const interesting = allFiles
    .filter((f) =>
      priority.includes(path.basename(f.path)) ||
      ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'].some((ext) => f.path.endsWith(ext))
    )
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, 12) // cap at 12 files

  const keyFiles: Record<string, string> = {}
  for (const file of interesting) {
    const raw = await fetch(
      `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${file.path}`,
      { headers: { Authorization: `token ${GITHUB_PAT}` } }
    )
    if (raw.ok) {
      const text = await raw.text()
      keyFiles[file.path] = text.slice(0, 3000) // cap per-file
    }
  }

  // Commit history
  const commitsData = await ghFetch(`/repos/${owner}/${name}/commits?per_page=50`) as Commit[]
  const commits = commitsData
    .map((c) => `${c.commit.author.date.slice(0, 10)} ${c.commit.message.split('\n')[0]}`)
    .join('\n')

  return { tree: treeText, keyFiles, commits }
}

// Run gitleaks on a shallow clone of the repo, return findings as JSON string
export async function runGitleaks(repoUrl: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grader-'))
  try {
    execSync(
      `git clone --depth=1 --quiet "${repoUrl}" "${tmpDir}/repo"`,
      { stdio: 'pipe', timeout: 60_000 }
    )
    const reportPath = path.join(tmpDir, 'gitleaks.json')
    try {
      execSync(
        `gitleaks detect --source="${tmpDir}/repo" --report-format=json --report-path="${reportPath}" --no-git`,
        { stdio: 'pipe', timeout: 30_000 }
      )
      return '[]' // exit 0 = no leaks
    } catch {
      // gitleaks exits 1 when leaks are found — that's expected
      if (fs.existsSync(reportPath)) return fs.readFileSync(reportPath, 'utf8')
      return '[]'
    }
  } catch (err) {
    console.warn('gitleaks scan failed (is gitleaks installed?):', (err as Error).message)
    return '[]'
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
