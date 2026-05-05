import { randomUUID } from 'node:crypto';
import type { EventService } from '../events/service.js';
import type { Runner } from '../runner/types.js';
import type { SandboxProvider } from '../sandbox/types.js';
import type { AppStore, ClaimedMessage } from '../store/types.js';

export type WorkerServiceOptions = {
  store: AppStore;
  events: EventService;
  runner: Runner;
  runnerType: string;
  sandboxProvider: SandboxProvider;
  leaseOwner: string;
  leaseDurationMs?: number;
};

export class WorkerService {
  private readonly leaseDurationMs: number;

  constructor(private readonly options: WorkerServiceOptions) {
    this.leaseDurationMs = options.leaseDurationMs ?? 60_000;
  }

  async processNext(): Promise<boolean> {
    const now = new Date();
    const claimed = await this.options.store.claimNextPendingMessage({
      runId: randomUUID(),
      runnerType: this.options.runnerType,
      leaseOwner: this.options.leaseOwner,
      leaseExpiresAt: new Date(now.getTime() + this.leaseDurationMs),
      now,
    });

    if (!claimed) return false;

    await this.options.events.append({
      sessionId: claimed.message.sessionId,
      runId: claimed.run.id,
      messageId: claimed.message.id,
      type: 'message_started',
      payload: { sequence: claimed.message.sequence },
    });

    try {
      await this.runClaimedMessage(claimed);
      const completed = await this.options.store.completeRun({ runId: claimed.run.id, completedAt: new Date() });
      await this.options.events.append({
        sessionId: completed.message.sessionId,
        runId: completed.run.id,
        messageId: completed.message.id,
        type: 'message_completed',
        payload: { sequence: completed.message.sequence },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      const failed = await this.options.store.failRun({ runId: claimed.run.id, failedAt: new Date(), error: message });
      await this.options.events.append({
        sessionId: failed.message.sessionId,
        runId: failed.run.id,
        messageId: failed.message.id,
        type: 'run_failed',
        payload: { error: message },
      });
      await this.options.events.append({
        sessionId: failed.message.sessionId,
        runId: failed.run.id,
        messageId: failed.message.id,
        type: 'message_failed',
        payload: { error: message },
      });
    }

    return true;
  }

  private async runClaimedMessage(claimed: ClaimedMessage): Promise<void> {
    const sandbox = await this.options.sandboxProvider.create({ sessionId: claimed.message.sessionId });
    await this.options.runner.run({
      sessionId: claimed.message.sessionId,
      runId: claimed.run.id,
      messageId: claimed.message.id,
      prompt: claimed.message.prompt,
      context: claimed.message.context ?? {},
      sandbox,
      emit: async (event) => {
        await this.options.events.append({
          sessionId: event.sessionId,
          runId: event.runId ?? claimed.run.id,
          messageId: event.messageId ?? claimed.message.id,
          type: event.type,
          payload: event.payload,
        });
      },
    });
  }
}

export function startWorkerLoop(worker: WorkerService, pollIntervalMs = 1_000): () => void {
  const timer = setInterval(() => {
    worker.processNext().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
    });
  }, pollIntervalMs);

  return () => clearInterval(timer);
}
