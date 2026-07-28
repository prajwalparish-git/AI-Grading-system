// ──────────────────────────────────────────────────────────────────────────
// Mock submission data for Applicant Drill-Down drill-down view
// In production this would be fetched from Supabase by submission ID
// ──────────────────────────────────────────────────────────────────────────

export interface CriterionScore {
  key: string
  label: string
  score: number
  maxScore: number
  weight: number // percentage weight in final score
}

export interface VulnerabilityItem {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  lineRef?: string
  title: string
  description: string
  suggestion: string
}

export interface MockSubmission {
  id: string
  applicantName: string
  applicantEmail: string
  applicantId: string
  cohort: string
  language: string
  repoUrl: string
  demoUrl: string
  submittedAt: string
  gradedAt: string
  totalScore: number
  status: 'graded' | 'submitted' | 'draft'
  aiSummary: string
  criteria: CriterionScore[]
  vulnerabilities: VulnerabilityItem[]
  codeSnippet: string
}

export const MOCK_SUBMISSIONS: Record<string, MockSubmission> = {
  'APP-9021': {
    id: 'APP-9021',
    applicantName: 'Elena Rostova',
    applicantEmail: 'elena.r@dev.io',
    applicantId: 'APP-9021',
    cohort: 'Cohort 2026 - Backend Track',
    language: 'Rust',
    repoUrl: 'https://github.com/elena-r/ai-task-scheduler',
    demoUrl: 'https://demo.elena-r.io/scheduler',
    submittedAt: '2026-07-28T09:42:00Z',
    gradedAt: '2026-07-28T09:55:00Z',
    totalScore: 97.8,
    status: 'graded',
    aiSummary:
      "Elena's submission demonstrates exceptional systems-level thinking. The async task scheduler is architecturally sound, leveraging Rust's ownership model to achieve zero-copy message passing between worker threads. The lock-free queue implementation is technically impressive. Minor documentation gaps in the `TaskGraph` trait and a missing `panic!` guard on edge index bounds are the only deductions. AI Integrity check passed with 100% clean signal — zero copy-paste detected across 1,847 tokens analyzed.",
    criteria: [
      { key: 'correctness', label: 'Correctness', score: 100, maxScore: 100, weight: 20 },
      { key: 'timeComplexity', label: 'Time Complexity', score: 98, maxScore: 100, weight: 15 },
      { key: 'memoryEfficiency', label: 'Memory Efficiency', score: 99, maxScore: 100, weight: 10 },
      { key: 'codeCleanliness', label: 'Cleanliness', score: 96, maxScore: 100, weight: 10 },
      { key: 'architecture', label: 'Architecture', score: 97, maxScore: 100, weight: 15 },
      { key: 'edgeCases', label: 'Edge Cases', score: 95, maxScore: 100, weight: 10 },
      { key: 'unitTesting', label: 'Unit Testing', score: 96, maxScore: 100, weight: 10 },
      { key: 'security', label: 'Security', score: 100, maxScore: 100, weight: 5 },
      { key: 'documentation', label: 'Documentation', score: 94, maxScore: 100, weight: 3 },
      { key: 'aiIntegrity', label: 'AI Integrity', score: 100, maxScore: 100, weight: 2 },
    ],
    vulnerabilities: [
      {
        severity: 'medium',
        category: 'Bounds Safety',
        lineRef: 'task_graph.rs:L214',
        title: 'Missing bounds check on edge index',
        description:
          'Direct array indexing with `edges[task_id]` without prior length validation. In adversarial input scenarios, this could cause a panic instead of a graceful `Result::Err`.',
        suggestion:
          'Replace with `.get(task_id).ok_or(GraphError::InvalidEdge)?` for safe indexing and idiomatic error propagation.',
      },
      {
        severity: 'low',
        category: 'Documentation',
        lineRef: 'scheduler.rs:L89-L102',
        title: 'Public trait `TaskGraph` missing doc comments',
        description:
          'The `TaskGraph` trait exposes 4 public methods without `///` documentation. Trait surface without documentation creates friction for downstream consumers.',
        suggestion:
          'Add `/// # Errors` and `/// # Examples` sections to each trait method. Consider a doc test for `enqueue_batch`.',
      },
      {
        severity: 'info',
        category: 'Style',
        lineRef: 'worker.rs:L44',
        title: 'Prefer `let else` over nested `match`',
        description:
          'A nested `match` on `Option<TaskHandle>` could be simplified using Rust 1.65+ `let else` syntax for improved readability.',
        suggestion: "Use `let Some(handle) = task_opt else { continue };` pattern.",
      },
    ],
    codeSnippet: `// task_graph.rs — Async Lock-Free Task Scheduler
// Cohort 2026 · Elena Rostova · APP-9021

use std::sync::Arc;
use tokio::sync::mpsc;
use std::collections::HashMap;

/// A lock-free, async-compatible task scheduler
/// using a multi-producer, single-consumer channel pattern.
pub struct TaskScheduler<T: Send + 'static> {
    sender: mpsc::Sender<Task<T>>,
    worker_count: usize,
    task_registry: Arc<TaskRegistry<T>>,
}

#[derive(Debug)]
pub struct Task<T> {
    pub id: TaskId,
    pub priority: Priority,
    pub payload: T,
    pub dependencies: Vec<TaskId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TaskId(pub u64);

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority { Low = 0, Normal = 1, High = 2, Critical = 3 }

impl<T: Send + 'static + Clone> TaskScheduler<T> {
    pub fn new(worker_count: usize) -> Self {
        let (tx, rx) = mpsc::channel::<Task<T>>(1024);
        let registry = Arc::new(TaskRegistry::new());
        let registry_clone = Arc::clone(&registry);

        // Spawn N worker coroutines for parallel execution
        for worker_id in 0..worker_count {
            let registry_ref = Arc::clone(&registry_clone);
            tokio::spawn(async move {
                Self::run_worker(worker_id, registry_ref).await;
            });
        }

        Self {
            sender: tx,
            worker_count,
            task_registry: registry,
        }
    }

    /// Enqueue a batch of tasks, sorted by priority descending.
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

    async fn run_worker(
        id: usize, 
        registry: Arc<TaskRegistry<T>>
    ) {
        loop {
            if let Some(task) = registry.dequeue().await {
                registry.mark_running(task.id.clone());
                // Execute task payload — zero-copy via Arc<T>
                registry.execute(task).await;
            }
            tokio::task::yield_now().await;
        }
    }
}`,
  },

  'APP-8492': {
    id: 'APP-8492',
    applicantName: 'Alexander Chen',
    applicantEmail: 'alex.chen@stanford.edu',
    applicantId: 'APP-8492',
    cohort: 'Cohort 2026 - Full-Stack Track',
    language: 'TypeScript',
    repoUrl: 'https://github.com/alexchen-dev/event-sourcing-engine',
    demoUrl: 'https://event-engine.vercel.app',
    submittedAt: '2026-07-28T09:20:00Z',
    gradedAt: '2026-07-28T09:38:00Z',
    totalScore: 96.4,
    status: 'graded',
    aiSummary:
      "Alexander's event-sourcing engine shows strong architectural depth. The CQRS pattern is cleanly separated, and the event store abstraction is well-designed. TypeScript generics are used effectively throughout the command bus. Test coverage is excellent at 92%. The primary deductions are for a memory leak in the event replay buffer (unconsumed Observable subscriptions) and some inconsistency in error type exhaustiveness. AI Integrity check returned a clean 99% original signal.",
    criteria: [
      { key: 'correctness', label: 'Correctness', score: 98, maxScore: 100, weight: 20 },
      { key: 'timeComplexity', label: 'Time Complexity', score: 95, maxScore: 100, weight: 15 },
      { key: 'memoryEfficiency', label: 'Memory Efficiency', score: 92, maxScore: 100, weight: 10 },
      { key: 'codeCleanliness', label: 'Cleanliness', score: 98, maxScore: 100, weight: 10 },
      { key: 'architecture', label: 'Architecture', score: 96, maxScore: 100, weight: 15 },
      { key: 'edgeCases', label: 'Edge Cases', score: 94, maxScore: 100, weight: 10 },
      { key: 'unitTesting', label: 'Unit Testing', score: 95, maxScore: 100, weight: 10 },
      { key: 'security', label: 'Security', score: 99, maxScore: 100, weight: 5 },
      { key: 'documentation', label: 'Documentation', score: 97, maxScore: 100, weight: 3 },
      { key: 'aiIntegrity', label: 'AI Integrity', score: 100, maxScore: 100, weight: 2 },
    ],
    vulnerabilities: [
      {
        severity: 'high',
        category: 'Memory Leak',
        lineRef: 'event-store.ts:L167',
        title: 'Observable subscription not disposed in event replay',
        description:
          'The `replayEvents$` observable in `EventStore.replay()` creates an RxJS subscription without a corresponding `unsubscribe()` or `takeUntil()` guard. Long-running replays will accumulate subscriptions in the GC root.',
        suggestion:
          'Pipe through `takeUntil(this.destroy$)` and call `this.destroy$.next()` in the class destructor, or convert to an `async generator` pattern to avoid RxJS subscription management.',
      },
      {
        severity: 'medium',
        category: 'Type Safety',
        lineRef: 'command-bus.ts:L88',
        title: 'Non-exhaustive discriminated union handling',
        description:
          'The `CommandResult` discriminated union has a `never` branch that throws at runtime rather than being caught at compile time. TypeScript 5.x exhaustiveness checking is not enforced here.',
        suggestion:
          "Add `const _exhaustive: never = result;` before the `default` case and enable `noImplicitReturns: true` in `tsconfig.json`.",
      },
    ],
    codeSnippet: `// event-store.ts — CQRS Event Sourcing Engine
// Cohort 2026 · Alexander Chen · APP-8492

import { Observable, Subject, takeUntil, from } from 'rxjs'
import { Injectable, OnDestroy } from '@angular/core'

export interface DomainEvent<T = unknown> {
  readonly eventId:   string
  readonly eventType: string
  readonly streamId:  string
  readonly version:   number
  readonly occurredAt: Date
  readonly payload:   T
  readonly metadata:  EventMetadata
}

export interface EventStore {
  append<T>(streamId: string, events: DomainEvent<T>[]): Promise<void>
  load<T>(streamId: string, fromVersion?: number): Promise<DomainEvent<T>[]>
  replay<T>(streamId: string): Observable<DomainEvent<T>>
}

@Injectable({ providedIn: 'root' })
export class PostgresEventStore implements EventStore, OnDestroy {
  private readonly destroy$ = new Subject<void>()

  constructor(private readonly db: DatabaseService) {}

  async append<T>(streamId: string, events: DomainEvent<T>[]): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (const event of events) {
        await trx.query(
          \`INSERT INTO event_store (stream_id, event_type, version, payload)
           VALUES ($1, $2, $3, $4)\`,
          [event.streamId, event.eventType, event.version, event.payload]
        )
      }
    })
  }

  replay<T>(streamId: string): Observable<DomainEvent<T>> {
    return from(this.load<T>(streamId)).pipe(
      takeUntil(this.destroy$) // ✓ Fixed: subscription disposal
    ) as unknown as Observable<DomainEvent<T>>
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }
}`,
  },
}

/** Returns a mock submission by applicant ID, or the first one as fallback */
export function getMockSubmission(id: string): MockSubmission {
  return MOCK_SUBMISSIONS[id] ?? MOCK_SUBMISSIONS['APP-9021']
}
