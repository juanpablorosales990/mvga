import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as os from 'os';

/**
 * Database-based distributed cron lock service.
 *
 * Uses a partial unique index on CronLock(jobName) WHERE completedAt IS NULL
 * AND expiresAt > now(). This means only ONE active lock per job can exist.
 *
 * Works with PgBouncer transaction-mode pooling (unlike advisory locks).
 */
@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);
  private readonly instanceId: string;

  constructor(private readonly prisma: PrismaService) {
    this.instanceId = `${os.hostname()}-${process.pid}-${Date.now()}`;
  }

  /**
   * Attempt to acquire a lock for a cron job.
   * @returns lock ID if acquired, null if another instance holds it.
   */
  async acquireLock(jobName: string, maxDurationMs: number = 300_000): Promise<string | null> {
    // Clean up expired locks first (stale from crashed instances)
    try {
      await this.prisma.$executeRaw`
        UPDATE "CronLock"
        SET "completedAt" = NOW()
        WHERE "jobName" = ${jobName}
          AND "completedAt" IS NULL
          AND "expiresAt" < NOW()
      `;
    } catch {
      // Non-critical: if cleanup fails, the insert will still work
    }

    // Check for existing active lock before inserting (defense-in-depth
    // even without the partial unique index deployed yet)
    const existing = await this.prisma.cronLock.findFirst({
      where: { jobName, completedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existing) {
      this.logger.debug(`Lock for ${jobName} already held by ${existing.lockedBy}`);
      return null;
    }

    // Attempt to insert — unique partial index prevents duplicates
    try {
      const lock = await this.prisma.cronLock.create({
        data: {
          jobName,
          lockedBy: this.instanceId,
          expiresAt: new Date(Date.now() + maxDurationMs),
        },
      });
      this.logger.debug(`Lock acquired for ${jobName} (id: ${lock.id})`);
      return lock.id;
    } catch (error: unknown) {
      // P2002 = unique constraint violation → lock already held
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2002'
      ) {
        this.logger.debug(`Lock for ${jobName} already held by another instance`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Release a previously acquired lock.
   */
  async releaseLock(lockId: string): Promise<void> {
    try {
      await this.prisma.cronLock.update({
        where: { id: lockId },
        data: { completedAt: new Date() },
      });
      this.logger.debug(`Lock released (id: ${lockId})`);
    } catch (error) {
      this.logger.error(`Failed to release lock ${lockId}:`, error);
    }
  }
}
