// ──────────────────────────────────────────────────────────────────────────
// Deterministic mock data generator — produces 500 applicant profiles
// with realistic bell-curve score distributions and varied metadata.
//
// Uses a seeded PRNG so results are consistent between renders/builds.
// ──────────────────────────────────────────────────────────────────────────

import type {
  LeaderboardEntry,
  SubmissionDetail,
  ProgrammingLanguage,
  SubmissionStatus,
  CriterionScore,
  VulnerabilityItem,
  VulnerabilitySeverity,
} from './types'

// ── Seeded PRNG (mulberry32) for deterministic output ────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(42)

/** Returns a random float in [min, max) */
function randRange(min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Returns a random integer in [min, max] */
function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1))
}

/** Pick a random element from an array */
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

/** Gaussian-ish score centered around `mean` with `spread` */
function gaussianScore(mean: number, spread: number): number {
  // Box-Muller approximation using our seeded rng
  const u1 = rng()
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2)
  return Math.max(0, Math.min(100, Math.round(mean + z * spread)))
}

// ── Roster data pools ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Elena', 'Alexander', 'Marcus', 'Sophia', 'David', 'Aisha', 'Liam', 'Kenji',
  'Priya', 'Nikolai', 'Chloe', 'Rafael', 'Yuki', 'Maya', 'Ethan', 'Fatima',
  'Lucas', 'Amara', 'Oscar', 'Leila', 'Noah', 'Zara', 'Adrian', 'Rin',
  'Hassan', 'Valentina', 'Soren', 'Naomi', 'Andre', 'Mei', 'Hugo', 'Isla',
  'Viktor', 'Ananya', 'Felix', 'Saara', 'Gabriel', 'Hana', 'Callum', 'Aya',
  'Diego', 'Emilia', 'Ravi', 'Linnea', 'Mateo', 'Ingrid', 'Kian', 'Daria',
  'Dante', 'Freya',
]

const LAST_NAMES = [
  'Rostova', 'Chen', 'Vance', 'Patel', 'Lindqvist', 'Al-Mansoor', "O'Connor", 'Takahashi',
  'Sharma', 'Petrov', 'Dubois', 'Ramirez', 'Tanaka', 'Williams', 'Kim', 'Hassan',
  'Müller', 'Santos', 'Johansson', 'Okafor', 'Larsen', 'Morales', 'Park', 'Ishida',
  'Torres', 'Volkov', 'Berg', 'Watanabe', 'Ferreira', 'Liu', 'Andersson', 'Nakamura',
  'Kowalski', 'Gupta', 'Nordström', 'Fernandez', 'Reyes', 'Yamamoto', 'Fischer', 'Aoki',
  'Mendez', 'Svensson', 'Das', 'Eriksson', 'Cruz', 'Holm', 'Chowdhury', 'Sorokin',
  'Bianchi', 'Hedlund',
]

const DOMAINS = ['dev.io', 'stanford.edu', 'mit.edu', 'ethz.ch', 'kth.se', 'todai.jp', 'tech.org', 'berkeley.edu', 'ox.ac.uk', 'cmu.edu']

const LANGUAGES: ProgrammingLanguage[] = ['TypeScript', 'Python', 'Rust', 'Go', 'C++', 'Java']
const LANGUAGE_WEIGHTS = [25, 30, 10, 15, 10, 10] // % distribution

const COHORTS = ['Cohort 2026 - Backend Track', 'Cohort 2026 - Full-Stack Track', 'Cohort 2026 - Systems Track', 'Cohort 2026 - ML Track']

const VULN_CATEGORIES = ['Memory Leak', 'Bounds Safety', 'Type Safety', 'Injection', 'Concurrency', 'Documentation', 'Style', 'Performance', 'Error Handling', 'Authentication']
const VULN_TITLES: Record<string, string[]> = {
  'Memory Leak': ['Unclosed database connection pool', 'Observable subscription never disposed', 'Retained closure over large buffer'],
  'Bounds Safety': ['Missing bounds check on edge index', 'Unchecked array access in critical path', 'Integer overflow on batch size'],
  'Type Safety': ['Non-exhaustive discriminated union handling', 'Unsafe any cast in parser module', 'Missing null guard on API response'],
  'Injection': ['Unsanitized SQL parameter interpolation', 'Template literal XSS vector', 'Command injection via unescaped shell arg'],
  'Concurrency': ['Data race on shared mutable state', 'Deadlock potential in lock ordering', 'Missing mutex guard on counter increment'],
  'Documentation': ['Public trait missing doc comments', 'Exported function has no JSDoc', 'README missing setup instructions'],
  'Style': ['Prefer let-else over nested match', 'Inconsistent naming convention', 'Magic number without named constant'],
  'Performance': ['N+1 query pattern in loop', 'Synchronous file I/O in async handler', 'Redundant cloning of Arc pointer'],
  'Error Handling': ['Swallowed exception in catch block', 'Panic instead of Result propagation', 'Missing retry logic on transient failure'],
  'Authentication': ['JWT secret hardcoded in source', 'Session token not rotated after auth', 'CORS wildcard on authenticated endpoint'],
}

function pickWeightedLanguage(): ProgrammingLanguage {
  const r = rng() * 100
  let cumulative = 0
  for (let i = 0; i < LANGUAGES.length; i++) {
    cumulative += LANGUAGE_WEIGHTS[i]
    if (r < cumulative) return LANGUAGES[i]
  }
  return 'TypeScript'
}

function generateVulnerabilities(baseScore: number): VulnerabilityItem[] {
  // Higher scoring applicants have fewer vulnerabilities
  const maxVulns = baseScore >= 95 ? 2 : baseScore >= 85 ? 3 : baseScore >= 70 ? 4 : 6
  const count = randInt(0, maxVulns)
  const vulns: VulnerabilityItem[] = []
  const usedCategories = new Set<string>()

  for (let i = 0; i < count; i++) {
    let category = pick(VULN_CATEGORIES)
    while (usedCategories.has(category)) category = pick(VULN_CATEGORIES)
    usedCategories.add(category)

    const titles = VULN_TITLES[category] || ['Unknown issue']
    const severity: VulnerabilitySeverity =
      baseScore >= 90
        ? pick(['low', 'info', 'medium'] as const)
        : baseScore >= 75
        ? pick(['medium', 'low', 'high'] as const)
        : pick(['high', 'critical', 'medium'] as const)

    vulns.push({
      severity,
      category,
      lineRef: `module.${pick(['rs', 'ts', 'py', 'go'])}:L${randInt(10, 400)}`,
      title: pick(titles),
      description: `Automated analysis detected a ${severity}-severity ${category.toLowerCase()} issue. This finding may impact production reliability if left unaddressed.`,
      suggestion: `Refactor the affected code path to follow established ${category.toLowerCase()} best practices. See project coding guidelines section ${randInt(2, 12)}.${randInt(1, 9)}.`,
    })
  }
  return vulns
}

// ── Generate the 500-entry dataset ───────────────────────────────────────

let _cachedEntries: LeaderboardEntry[] | null = null

export function generateLeaderboardEntries(): LeaderboardEntry[] {
  if (_cachedEntries) return _cachedEntries

  const entries: LeaderboardEntry[] = []

  for (let i = 0; i < 500; i++) {
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)
    const name = `${firstName} ${lastName}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/'/g, '')}@${pick(DOMAINS)}`

    // Bell curve: mean=8.0, spread=1.2 → most scores 6.5–9.5
    const baseScore = gaussianScore(8.0, 1.2) / 10
    const completion = gaussianScore(baseScore + 0.2, 0.4)
    const innovation = gaussianScore(baseScore, 0.5)
    const codeLiteracy = gaussianScore(baseScore - 0.2, 0.6)
    const gitHygiene = gaussianScore(baseScore + 0.1, 0.4)
    const architectureStack = gaussianScore(baseScore, 0.5)
    const functionality = gaussianScore(baseScore - 0.1, 0.5)
    const uiUxDesign = gaussianScore(baseScore, 0.5)
    const errorHandling = gaussianScore(baseScore + 0.2, 0.4)
    const documentation = gaussianScore(baseScore - 0.3, 0.6)
    const performance = gaussianScore(baseScore, 0.3)
    const promptEngineering = gaussianScore(baseScore + 0.1, 0.4)
    const apiSecurity = gaussianScore(baseScore + 0.2, 0.5)
    const integrityHonesty = gaussianScore(baseScore + 0.5, 0.3) // Most people are clean

    const vulns = generateVulnerabilities(baseScore * 10)
    const flaggedVulnerabilities = vulns.filter(v => v.severity === 'critical' || v.severity === 'high').length

    // 85% graded, 8% still grading, 5% submitted, 2% error
    const statusRoll = rng()
    const status: SubmissionStatus =
      statusRoll < 0.85 ? 'graded' :
      statusRoll < 0.93 ? 'grading' :
      statusRoll < 0.98 ? 'submitted' : 'error'

    const totalScore = status === 'graded' || status === 'error'
      ? parseFloat((
          (completion + innovation + codeLiteracy + gitHygiene + architectureStack + functionality + uiUxDesign + errorHandling + documentation + performance + promptEngineering + apiSecurity + integrityHonesty) / 13
        ).toFixed(1))
      : 0

    const hoursAgo = randInt(0, 240)
    const submittedAt = hoursAgo < 1 ? `${randInt(1, 59)} mins ago` : `${hoursAgo} hours ago`

    entries.push({
      id: `APP-${String(1000 + i).padStart(4, '0')}`,
      rank: 0, // will be set after sort
      name,
      email,
      language: pickWeightedLanguage(),
      submittedAt,
      status,
      totalScore,
      flaggedVulnerabilities,
      criteria: {
        completion,
        innovation,
        codeLiteracy,
        gitHygiene,
        architectureStack,
        functionality,
        uiUxDesign,
        errorHandling,
        documentation,
        performance,
        promptEngineering,
        apiSecurity,
        integrityHonesty,
      },
    })
  }

  // Sort by total score descending, assign ranks
  entries.sort((a, b) => b.totalScore - a.totalScore)
  entries.forEach((e, i) => { e.rank = i + 1 })

  _cachedEntries = entries
  return entries
}

// ── Submission detail generator (for drill-down) ─────────────────────────

const CODE_SNIPPETS: Record<ProgrammingLanguage, string> = {
  Rust: `use std::sync::Arc;
use tokio::sync::mpsc;

pub struct TaskScheduler<T: Send + 'static> {
    sender: mpsc::Sender<Task<T>>,
    worker_count: usize,
    task_registry: Arc<TaskRegistry<T>>,
}

impl<T: Send + 'static + Clone> TaskScheduler<T> {
    pub fn new(worker_count: usize) -> Self {
        let (tx, _rx) = mpsc::channel::<Task<T>>(1024);
        let registry = Arc::new(TaskRegistry::new());

        for worker_id in 0..worker_count {
            let reg = Arc::clone(&registry);
            tokio::spawn(async move {
                Self::run_worker(worker_id, reg).await;
            });
        }

        Self { sender: tx, worker_count, task_registry: registry }
    }

    pub async fn enqueue_batch(&self, mut tasks: Vec<Task<T>>)
        -> Result<(), SchedulerError>
    {
        tasks.sort_by(|a, b| b.priority.cmp(&a.priority));
        for task in tasks {
            self.sender.send(task).await
                .map_err(|_| SchedulerError::QueueFull)?;
        }
        Ok(())
    }
}`,

  TypeScript: `import { Observable, Subject, takeUntil } from 'rxjs'

export interface DomainEvent<T = unknown> {
  readonly eventId: string
  readonly eventType: string
  readonly streamId: string
  readonly version: number
  readonly payload: T
}

export class EventStore {
  private readonly destroy$ = new Subject<void>()

  async append<T>(streamId: string, events: DomainEvent<T>[]): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (const event of events) {
        await trx.query(
          \`INSERT INTO events (stream_id, type, version, payload)
           VALUES ($1, $2, $3, $4)\`,
          [event.streamId, event.eventType, event.version, event.payload]
        )
      }
    })
  }

  replay<T>(streamId: string): Observable<DomainEvent<T>> {
    return this.load<T>(streamId).pipe(takeUntil(this.destroy$))
  }
}`,

  Python: `from dataclasses import dataclass
from typing import List, Optional
import asyncio

@dataclass
class EvalResult:
    score: float
    criteria: dict
    vulnerabilities: List[str]

class GradingPipeline:
    def __init__(self, model_name: str, max_workers: int = 4):
        self.model_name = model_name
        self.max_workers = max_workers
        self._semaphore = asyncio.Semaphore(max_workers)

    async def evaluate(self, submission: str) -> EvalResult:
        async with self._semaphore:
            tokens = await self._tokenize(submission)
            criteria = await self._score_criteria(tokens)
            vulns = await self._scan_vulnerabilities(tokens)
            total = sum(c * w for c, w in criteria.items())
            return EvalResult(score=total, criteria=criteria, vulnerabilities=vulns)

    async def batch_evaluate(self, submissions: List[str]) -> List[EvalResult]:
        tasks = [self.evaluate(s) for s in submissions]
        return await asyncio.gather(*tasks)`,

  Go: `package scheduler

import (
    "context"
    "sync"
)

type Task struct {
    ID       string
    Priority int
    Payload  []byte
}

type Scheduler struct {
    mu       sync.RWMutex
    queue    chan Task
    workers  int
    running  bool
}

func New(workers, bufSize int) *Scheduler {
    return &Scheduler{
        queue:   make(chan Task, bufSize),
        workers: workers,
    }
}

func (s *Scheduler) Start(ctx context.Context) {
    s.mu.Lock()
    s.running = true
    s.mu.Unlock()

    var wg sync.WaitGroup
    for i := 0; i < s.workers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            s.runWorker(ctx, id)
        }(i)
    }
    wg.Wait()
}`,

  'C++': `#include <queue>
#include <mutex>
#include <thread>
#include <vector>
#include <functional>

template<typename T>
class ThreadPool {
public:
    explicit ThreadPool(size_t num_threads)
        : stop_(false) {
        for (size_t i = 0; i < num_threads; ++i) {
            workers_.emplace_back([this] { this->WorkerLoop(); });
        }
    }

    ~ThreadPool() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            stop_ = true;
        }
        cv_.notify_all();
        for (auto& w : workers_) w.join();
    }

    void Submit(std::function<void()> task) {
        std::lock_guard<std::mutex> lock(mutex_);
        tasks_.push(std::move(task));
        cv_.notify_one();
    }

private:
    void WorkerLoop() {
        while (true) {
            std::function<void()> task;
            {
                std::unique_lock<std::mutex> lock(mutex_);
                cv_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
                if (stop_ && tasks_.empty()) return;
                task = std::move(tasks_.front());
                tasks_.pop();
            }
            task();
        }
    }

    std::vector<std::thread> workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex mutex_;
    std::condition_variable cv_;
    bool stop_;
};`,

  Java: `import java.util.concurrent.*;
import java.util.List;
import java.util.ArrayList;

public class GradingExecutor {
    private final ExecutorService pool;
    private final int maxConcurrency;

    public GradingExecutor(int maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.pool = Executors.newFixedThreadPool(maxConcurrency);
    }

    public List<EvalResult> evaluateBatch(List<Submission> submissions)
            throws InterruptedException, ExecutionException {
        List<Future<EvalResult>> futures = new ArrayList<>();
        for (Submission sub : submissions) {
            futures.add(pool.submit(() -> evaluate(sub)));
        }
        List<EvalResult> results = new ArrayList<>();
        for (Future<EvalResult> f : futures) {
            results.add(f.get());
        }
        return results;
    }

    private EvalResult evaluate(Submission sub) {
        var tokens = tokenize(sub.getCode());
        var criteria = scoreCriteria(tokens);
        var vulns = scanVulnerabilities(tokens);
        double total = criteria.values().stream()
            .mapToDouble(Double::doubleValue).sum();
        return new EvalResult(total, criteria, vulns);
    }
}`,
}

const AI_SUMMARY_TEMPLATES = [
  "The submission demonstrates {quality} engineering fundamentals. {strength}. {weakness}. AI Integrity check returned {integrity}% clean signal — {integrityNote}.",
  "This candidate's code shows {quality} systems-level thinking. {strength}. {weakness}. The AI integrity scanner reports {integrity}% original authorship with {integrityNote}.",
  "A {quality} submission overall. {strength}. {weakness}. Plagiarism analysis shows {integrity}% unique content — {integrityNote}.",
]

const QUALITIES = { high: 'exceptional', mid: 'solid', low: 'developing' }
const STRENGTHS = [
  'Clean separation of concerns with well-defined module boundaries',
  'Efficient use of concurrency primitives with minimal lock contention',
  'Comprehensive error handling with idiomatic Result/Option propagation',
  'Strong test coverage (92%+) with meaningful edge case scenarios',
  'Thoughtful API design with clear naming conventions and consistent patterns',
  'Excellent memory management with zero unnecessary allocations',
]
const WEAKNESSES = [
  'Minor documentation gaps in public interfaces',
  'Some edge cases around empty input are unhandled',
  'Error messages could be more descriptive for debugging',
  'A few magic numbers should be extracted to named constants',
  'Missing retry logic on network-dependent operations',
  'Slight inconsistency in naming conventions across modules',
]

export function generateSubmissionDetail(entry: LeaderboardEntry): SubmissionDetail {
  const quality = entry.totalScore >= 90 ? 'high' : entry.totalScore >= 70 ? 'mid' : 'low'
  const template = pick(AI_SUMMARY_TEMPLATES)
  const aiSummary = template
    .replace('{quality}', QUALITIES[quality])
    .replace('{strength}', pick(STRENGTHS))
    .replace('{weakness}', pick(WEAKNESSES))
    .replace('{integrity}', String(entry.criteria.integrityHonesty))
    .replace('{integrityNote}', entry.criteria.integrityHonesty >= 9.5 ? 'no copy-paste patterns detected' : 'some overlapping token sequences flagged for review')

  const vulns = generateVulnerabilities(entry.totalScore)

  const hoursAgoMatch = entry.submittedAt.match(/(\d+)\s*(min|hour)/)
  const hoursAgo = hoursAgoMatch
    ? hoursAgoMatch[2] === 'min' ? 0 : parseInt(hoursAgoMatch[1])
    : randInt(1, 48)
  const submittedDate = new Date(Date.now() - hoursAgo * 3600 * 1000)
  const gradedDate = new Date(submittedDate.getTime() + randInt(5, 30) * 60 * 1000)

  return {
    id: entry.id,
    applicantName: entry.name,
    applicantEmail: entry.email,
    applicantId: entry.id,
    cohort: pick(COHORTS),
    language: entry.language,
    repoUrl: `https://github.com/${entry.name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}/submission-${entry.id.toLowerCase()}`,
    demoUrl: `https://demo.${entry.name.toLowerCase().replace(/\s+/g, '')}.dev`,
    submittedAt: submittedDate.toISOString(),
    gradedAt: gradedDate.toISOString(),
    totalScore: entry.totalScore,
    status: entry.status,
    aiSummary,
    criteria: [
      { key: 'completion', label: 'Completion', score: entry.criteria.completion, maxScore: 10, weight: 7.7 },
      { key: 'innovation', label: 'Innovation', score: entry.criteria.innovation, maxScore: 10, weight: 7.7 },
      { key: 'codeLiteracy', label: 'Code Literacy', score: entry.criteria.codeLiteracy, maxScore: 10, weight: 7.7 },
      { key: 'gitHygiene', label: 'Git Hygiene', score: entry.criteria.gitHygiene, maxScore: 10, weight: 7.7 },
      { key: 'architectureStack', label: 'Architecture', score: entry.criteria.architectureStack, maxScore: 10, weight: 7.7 },
      { key: 'functionality', label: 'Functionality', score: entry.criteria.functionality, maxScore: 10, weight: 7.7 },
      { key: 'uiUxDesign', label: 'UI/UX Design', score: entry.criteria.uiUxDesign, maxScore: 10, weight: 7.7 },
      { key: 'errorHandling', label: 'Error Handling', score: entry.criteria.errorHandling, maxScore: 10, weight: 7.7 },
      { key: 'documentation', label: 'Documentation', score: entry.criteria.documentation, maxScore: 10, weight: 7.7 },
      { key: 'performance', label: 'Performance', score: entry.criteria.performance, maxScore: 10, weight: 7.7 },
      { key: 'promptEngineering', label: 'Prompt Eng', score: entry.criteria.promptEngineering, maxScore: 10, weight: 7.7 },
      { key: 'apiSecurity', label: 'Security', score: entry.criteria.apiSecurity, maxScore: 10, weight: 7.7 },
      { key: 'integrityHonesty', label: 'Integrity', score: entry.criteria.integrityHonesty, maxScore: 10, weight: 7.7 },
    ],
    vulnerabilities: vulns,
    codeSnippet: CODE_SNIPPETS[entry.language] || CODE_SNIPPETS['TypeScript'],
  }
}
