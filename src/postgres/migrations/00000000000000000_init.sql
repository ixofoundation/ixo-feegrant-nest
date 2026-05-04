-- INITIALIZATION SCRIPT
--
-- Tracks every address we've ever observed receiving a feegrant from our
-- granter, and a named cursor for incremental blocksync ingestion.

-- Up Migration

-- CreateTable
-- One row per grantee. Grows monotonically: we never delete from this table.
-- The cron diffs this set against currently-active grants on chain and
-- re-grants any address that has fallen out of the active set.
CREATE TABLE "Grantee" (
    "address" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastGrantedAt" TIMESTAMP(3),

    CONSTRAINT "Grantee_pkey" PRIMARY KEY ("address")
);

-- CreateTable
-- Named cursors for incremental sync sources. Currently used to track the
-- highest MessageCore.id observed via blocksync, so subsequent ingest only
-- pulls new MsgGrantAllowance messages.
CREATE TABLE "SyncCursor" (
    "name" TEXT NOT NULL,
    "lastMessageId" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("name")
);

-- Down Migration
-- DROP TABLE "SyncCursor";
-- DROP TABLE "Grantee";
