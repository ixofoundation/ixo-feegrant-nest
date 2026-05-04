import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';

import { IxoFeegrant } from '../granter';
import { pool, withTransaction } from '../postgres/client';
import { chunkArray } from '../utils/chunk';
import {
  REFRESH_BATCH_SIZE,
  REFRESH_CRON_ENABLED,
  REFRESH_CRON_SCHEDULE,
  REFRESH_GRANT_DURATION_DAYS,
} from '../utils/secrets';
import { fetchActiveGrantees } from './chain';
import { fetchGrantMessagesPage } from './blocksync';

const CURSOR_NAME = 'blocksync_grant_messages';

@Injectable()
export class RefreshService implements OnModuleInit {
  private readonly logger = new Logger(RefreshService.name);
  private running = false;

  async onModuleInit() {
    if (!REFRESH_CRON_ENABLED) {
      this.logger.warn(
        'REFRESH_CRON_ENABLED=0 — refresh cron will not be scheduled',
      );
    } else {
      this.logger.log(
        `Refresh cron enabled with schedule "${REFRESH_CRON_SCHEDULE}"`,
      );
    }
  }

  // Cron schedule is read from env at module load. The decorator argument is
  // evaluated once when the class is decorated, so the env var must be set
  // before the module is imported (true since main.ts loads dotenv first).
  @Cron(REFRESH_CRON_SCHEDULE, { name: 'refresh-feegrants' })
  async refreshTick() {
    if (!REFRESH_CRON_ENABLED) return;
    if (this.running) {
      this.logger.warn('Previous refresh tick still running — skipping');
      return;
    }
    this.running = true;
    const startedAt = Date.now();
    try {
      await this.runOnce();
      this.logger.log(
        `Refresh tick completed in ${Date.now() - startedAt}ms`,
      );
    } catch (err: any) {
      this.logger.error(
        `Refresh tick failed: ${err?.message ?? err}`,
        err?.stack,
      );
      Sentry.captureException(err);
    } finally {
      this.running = false;
    }
  }

  // Public so it can be triggered manually if needed (e.g. from a controller).
  async runOnce() {
    const granter = await IxoFeegrant.instance.getGranterAddress();

    // 1. Snapshot currently-active grants from the chain. This is the
    // authoritative "is grant live right now" set.
    const active = await fetchActiveGrantees(granter);
    this.logger.log(`Chain reports ${active.size} active grants`);

    // 2. Pull any new MsgGrantAllowance messages since our last cursor and
    // upsert their grantees into our local set. Done after the chain snapshot
    // so a brand-new grant observed in this tick is already in `active`.
    const ingested = await this.ingestNewGrantMessages(granter);
    this.logger.log(
      `Blocksync ingest: ${ingested.added} new grantees added, ` +
        `cursor advanced to ${ingested.cursor}`,
    );

    // 3. Diff and re-grant anything that has fallen out of the active set.
    const missing = await this.findMissingGrantees(active);
    if (missing.length === 0) {
      this.logger.log('No missing grantees — nothing to refresh');
      return;
    }
    this.logger.log(`Granting ${missing.length} missing grantees`);

    await this.grantInBatches(missing);
  }

  // Walk blocksync forward from the persisted cursor, upserting every new
  // grantee that came from our granter, and persisting the cursor after each
  // page so partial bootstraps resume cleanly.
  private async ingestNewGrantMessages(
    ourGranter: string,
  ): Promise<{ added: number; cursor: number }> {
    let cursor = await this.getCursor();
    let added = 0;

    // Bound the loop so a runaway never blocks the cron tick. With a 1k page
    // size and ~64K historical messages, 200 pages is ample headroom.
    for (let i = 0; i < 200; i++) {
      const page = await fetchGrantMessagesPage(cursor, ourGranter);
      if (page.maxId === null) break;

      const inserted = await this.upsertGrantees(page.grantees, page.maxId);
      added += inserted;
      cursor = page.maxId;

      if (!page.hasMore) break;
    }

    return { added, cursor };
  }

  private async getCursor(): Promise<number> {
    const res = await pool.query<{ lastMessageId: string }>(
      `SELECT "lastMessageId" FROM "SyncCursor" WHERE name = $1`,
      [CURSOR_NAME],
    );
    if (res.rowCount === 0) return 0;
    // BIGINT comes back as a string from node-postgres.
    return Number(res.rows[0].lastMessageId);
  }

  // Upsert grantees and advance the cursor in a single transaction so partial
  // failures don't leave us with un-recorded grantees AND an advanced cursor.
  private async upsertGrantees(
    grantees: string[],
    newCursor: number,
  ): Promise<number> {
    return withTransaction(async (client) => {
      let inserted = 0;
      if (grantees.length > 0) {
        // ON CONFLICT DO NOTHING preserves the original firstSeenAt.
        const res = await client.query(
          `INSERT INTO "Grantee" ("address")
             SELECT * FROM UNNEST($1::text[])
             ON CONFLICT ("address") DO NOTHING`,
          [grantees],
        );
        inserted = res.rowCount ?? 0;
      }

      await client.query(
        `INSERT INTO "SyncCursor" ("name", "lastMessageId", "updatedAt")
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT ("name") DO UPDATE
             SET "lastMessageId" = EXCLUDED."lastMessageId",
                 "updatedAt" = EXCLUDED."updatedAt"`,
        [CURSOR_NAME, newCursor],
      );

      return inserted;
    });
  }

  // Return all addresses we've ever granted to that aren't currently active.
  private async findMissingGrantees(
    active: Set<string>,
  ): Promise<string[]> {
    const res = await pool.query<{ address: string }>(
      `SELECT "address" FROM "Grantee"`,
    );
    const missing: string[] = [];
    for (const row of res.rows) {
      if (!active.has(row.address)) missing.push(row.address);
    }
    return missing;
  }

  private async grantInBatches(grantees: string[]) {
    const batches = chunkArray(grantees, REFRESH_BATCH_SIZE);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const res = await IxoFeegrant.instance.feegrantBatch(
          batch,
          REFRESH_GRANT_DURATION_DAYS,
        );
        if (res.code !== 0) {
          // Tx made it on-chain but with a non-zero code — log and continue.
          this.logger.error(
            `Batch ${i + 1}/${batches.length} tx code=${res.code}: ${res.rawLog}`,
          );
          Sentry.captureException(
            new Error(`feegrant batch tx code ${res.code}: ${res.rawLog}`),
          );
          failed += batch.length;
          continue;
        }
        await this.markGranted(batch);
        succeeded += batch.length;
        this.logger.log(
          `Batch ${i + 1}/${batches.length} succeeded (${batch.length} grantees, hash ${res.transactionHash})`,
        );
      } catch (err: any) {
        // One batch failure shouldn't block the rest. Anything left unfixed
        // will be retried on the next cron tick.
        this.logger.error(
          `Batch ${i + 1}/${batches.length} failed: ${err?.message ?? err}`,
          err?.stack,
        );
        Sentry.captureException(err);
        failed += batch.length;
      }
    }

    this.logger.log(
      `Grant refresh summary: ${succeeded} succeeded, ${failed} failed`,
    );
  }

  private async markGranted(grantees: string[]) {
    if (grantees.length === 0) return;
    await pool.query(
      `UPDATE "Grantee"
         SET "lastGrantedAt" = CURRENT_TIMESTAMP
         WHERE "address" = ANY($1::text[])`,
      [grantees],
    );
  }
}
