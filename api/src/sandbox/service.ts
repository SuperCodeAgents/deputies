import { randomUUID } from 'node:crypto';
import type { EventService } from '../events/service.js';
import type { AppStore, SandboxRecord } from '../store/types.js';
import type { SandboxHandle, SandboxProvider } from './types.js';

export type EnsureSandboxResult = {
  sandbox: SandboxHandle;
  record: SandboxRecord;
  created: boolean;
};

export class SandboxLifecycleService {
  constructor(
    private readonly store: AppStore,
    private readonly provider: SandboxProvider,
  ) {}

  async ensure(sessionId: string): Promise<EnsureSandboxResult> {
    const existing = await this.store.getActiveSandbox(sessionId, this.provider.name);
    if (existing) {
      const connected = await this.tryConnect(existing);
      if (connected) return { ...connected, created: false };
    }

    const sandbox = await this.provider.create({ sessionId });
    const now = new Date();
    const record = await this.store.createSandbox({
      id: randomUUID(),
      sessionId,
      provider: this.provider.name,
      providerSandboxId: sandbox.providerSandboxId,
      status: 'ready',
      workspacePath: sandbox.workspacePath,
      metadata: sandbox.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return { sandbox, record, created: true };
  }

  private async tryConnect(record: SandboxRecord): Promise<Omit<EnsureSandboxResult, 'created'> | null> {
    const checkedAt = new Date();
    const health = await this.provider.health(record);
    const checkedRecord: SandboxRecord = {
      ...record,
      status: health.status === 'ready' ? 'ready' : health.status === 'stopped' ? 'stopped' : 'unhealthy',
      lastHealthCheckAt: checkedAt,
      updatedAt: checkedAt,
    };
    await this.store.updateSandbox(checkedRecord);

    if (health.status === 'stopped') {
      if (!this.provider.start) return null;
      await this.provider.start(record);
    } else if (health.status !== 'ready') {
      return null;
    }

    try {
      const sandbox = await this.provider.connect({
        providerSandboxId: record.providerSandboxId,
        sessionId: record.sessionId,
        metadata: record.metadata,
      });
      const updated = await this.store.updateSandbox({
        ...checkedRecord,
        status: 'ready',
        workspacePath: sandbox.workspacePath,
        metadata: { ...record.metadata, ...sandbox.metadata },
        updatedAt: new Date(),
      });
      return { sandbox, record: updated };
    } catch {
      await this.store.updateSandbox({
        ...checkedRecord,
        status: 'unhealthy',
        updatedAt: new Date(),
      });
      return null;
    }
  }
}

export type SandboxCleanupResult = {
  destroyed: number;
  failed: number;
};

export class SandboxCleanupService {
  constructor(
    private readonly store: AppStore,
    private readonly events: EventService,
    private readonly provider: SandboxProvider,
  ) {}

  async destroySessionSandboxes(sessionId: string): Promise<SandboxCleanupResult> {
    const sandboxes = await this.store.listActiveSandboxes(sessionId, this.provider.name);
    return this.destroySandboxes(sandboxes, 'archive');
  }

  async destroyIdleSandboxes(input: { idleBefore: Date; limit: number }): Promise<SandboxCleanupResult> {
    const sandboxes = await this.store.listIdleSandboxes({
      provider: this.provider.name,
      idleBefore: input.idleBefore,
      limit: input.limit,
    });
    return this.destroySandboxes(sandboxes, 'idle_reaper');
  }

  private async destroySandboxes(sandboxes: SandboxRecord[], reason: string): Promise<SandboxCleanupResult> {
    let destroyed = 0;
    let failed = 0;

    for (const sandbox of sandboxes) {
      try {
        await this.provider.destroy(sandbox);
        const destroyedAt = new Date();
        await this.store.updateSandbox({
          ...sandbox,
          status: 'destroyed',
          updatedAt: destroyedAt,
          destroyedAt,
        });
        await this.events.append({
          sessionId: sandbox.sessionId,
          type: 'sandbox_destroyed',
          payload: {
            reason,
            provider: sandbox.provider,
            providerSandboxId: sandbox.providerSandboxId,
          },
        });
        destroyed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sandbox destroy error';
        await this.events.append({
          sessionId: sandbox.sessionId,
          type: 'sandbox_destroy_failed',
          payload: {
            reason,
            provider: sandbox.provider,
            providerSandboxId: sandbox.providerSandboxId,
            error: message,
          },
        });
        failed += 1;
      }
    }

    return { destroyed, failed };
  }
}
