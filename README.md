<div align=center>

![Logo](/logo.png)

# ixo-feegrant-nest

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)![PostgreSQL](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)

[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/invite/ixo) [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ixonetwork) [![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/ixoworld)

</div>

## Overview

`ixo-feegrant-nest` is the service that issues Cosmos SDK [feegrants](https://docs.cosmos.network/main/build/modules/feegrant) to users of ixo client applications. New users sign up through an ixo client (Jambo, IXO Portal, etc.); the client calls this service, which broadcasts a `MsgGrantAllowance` from a funded granter wallet so the user can transact on the ixo blockchain without holding `uixo` themselves.

The service exposes a small REST API for issuing grants on demand, plus a built-in **refresh cron** that periodically re-grants any user whose allowance has lapsed — so a user who once received a grant never permanently loses gas-coverage as long as the cron is running.

## Why the refresh cron exists

The ixo blockchain currently runs on Cosmos SDK `v0.50.10` (with the `informalsystems` LSM fork). The standalone `cosmossdk.io/x/feegrant@v0.1.1` module that ships with this SDK contains a known state-machine bug:

> When a grant is revoked (manually, via `MsgRevokeAllowance`, or automatically when a `BasicAllowance` `spend_limit` reaches zero), `revokeAllowance` deletes the expiration-queue entry using **inverted granter/grantee key order**. The deletion silently no-ops, leaving a stale entry behind. When that stale entry's expiration time is later reached, the EndBlocker's `RemoveExpiredAllowances` walks the queue, parses the addresses out of the stale key, and deletes the **currently-active grant** under that granter/grantee pair — even though it hasn't expired.

Tracking issue: [cosmos-sdk#20057](https://github.com/cosmos/cosmos-sdk/issues/20057). Fix: [cosmos-sdk#25541](https://github.com/cosmos/cosmos-sdk/pull/25541), shipped in cosmos-sdk `v0.50.15`. We can't upgrade the chain to v0.50.15+ because no LSM fork exists for that line yet.

To work around the bug at the application layer, this service:

1. **Never calls `MsgRevokeAllowance`** — that is the code path that triggers the leak. We only call `MsgGrantAllowance`.
2. **Issues 1-year expirations by default** so renewals are rare.
3. **Lets grants expire naturally** — the chain's `RemoveExpiredAllowances` cleanup uses a different (correct) code path that doesn't leak queue entries.
4. **Runs a refresh cron** that periodically diffs *every grantee we've ever observed receiving a grant from us* against *currently-active grants on chain*, and re-grants any address that has fallen out of the active set. Worst-case coverage gap is one cron interval.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health probe — returns a welcome string. |
| `POST` | `/feegrant/:address` | Issue a fresh `MsgGrantAllowance` for `:address`. Default duration is 365 days. |
| `POST` | `/feegrant/extend/:address` | Issue a 7-day `MsgGrantAllowance` for `:address`. Used by clients for short-lived top-ups. |

Both `POST` endpoints require the `Authorization: <AUTHORIZATION>` (or `<JAMBO_AUTHORIZATION>`) header.

Note: cosmos-sdk's `MsgGrantAllowance` errors if a grant for the same `(granter, grantee)` pair already exists. The endpoints don't pre-check, so callers should only invoke them for addresses without an active grant.

## Refresh cron

The `RefreshService` wakes on a configurable schedule (default: every 30 minutes) and runs four steps:

1. **Snapshot active grants from chain** — paginates `cosmos.feegrant.v1beta1.Query/AllowancesByGranter` for the configured granter address and builds a `Set<string>` of grantee addresses that currently hold a live allowance.
2. **Ingest new grant messages from blocksync** — reads the persisted `SyncCursor.lastMessageId`, then walks the blocksync GraphQL `messages` table forward (filtered to `typeUrl = /cosmos.feegrant.v1beta1.MsgGrantAllowance` and `id > lastMessageId`), upserting any grantee whose `value.granter` matches our address into the local `Grantee` table. Cursor is committed per page so a partial run resumes cleanly.
3. **Diff** — `(every grantee we've ever observed) − (currently active)` = grantees who need a fresh grant.
4. **Batch grant** — chunks the missing list into batches of 180, broadcasts each as a single tx of `N` `MsgGrantAllowance` messages with sim-based gas. Per-batch try/catch so one bad chunk doesn't block the rest; failures retry next tick.

A simple in-memory mutex prevents overlapping ticks if a run takes longer than the cron interval (e.g. the first historical bootstrap, which walks ~64K messages and takes ~70s).

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MNEMONIC` | yes | — | Mnemonic of the granter wallet that funds all feegrants. |
| `RPC_URL` | yes | — | ixo chain RPC endpoint (e.g. `https://rpc.ixo.earth/`). |
| `AUTHORIZATION` | yes | — | Bearer token required by `/feegrant/*` endpoints. |
| `JAMBO_AUTHORIZATION` | no | — | Alternate bearer token accepted by the same endpoints. |
| `PORT` | no | `3000` | HTTP listen port. |
| `SENTRY_DSN` | no | — | Sentry project DSN; cron-tick errors are reported here. |
| `DATABASE_URL` | yes | — | Postgres connection string used by the refresh cron. |
| `DATABASE_USE_SSL` | no | `0` | Set `1` if your Postgres requires SSL (managed providers). |
| `MIGRATE_DB_PROGRAMATICALLY` | no | `0` | Set `1` to run pending migrations at process start (useful when no shell access on the host). |
| `BLOCKSYNC_GRAPHQL_URL` | no | `https://blocksync-graphql.ixo.earth/graphql` | Source of historical grant-message backfill. |
| `REFRESH_CRON_ENABLED` | no | `1` | Set `0` to disable the refresh cron. |
| `REFRESH_CRON_SCHEDULE` | no | `0 */30 * * * *` | 6-field cron expression (`sec min hour dom mon dow`). |
| `REFRESH_GRANT_DURATION_DAYS` | no | `365` | Expiration of grants the cron issues. |
| `REFRESH_BATCH_SIZE` | no | `180` | Max grantees per broadcast tx. |
| `BLOCKSYNC_PAGE_SIZE` | no | `1000` | Page size for blocksync GraphQL ingest. |
| `CHAIN_PAGE_SIZE` | no | `1000` | Page size for chain `allowancesByGranter` pagination. |

## Database

The cron uses two Postgres tables, created by `src/postgres/migrations/00000000000000000_init.sql`:

- **`Grantee`** (`address PK`, `firstSeenAt`, `lastGrantedAt`) — every address ever observed as the recipient of a `MsgGrantAllowance` from our granter. Grows monotonically; we never delete from it.
- **`SyncCursor`** (`name PK`, `lastMessageId`, `updatedAt`) — named sync cursors. The cron uses one row keyed `blocksync_grant_messages` to remember the highest blocksync `MessageCore.id` it has ingested.

Run migrations either by setting `MIGRATE_DB_PROGRAMATICALLY=1` (fires at process start) or out-of-band:

```bash
npx node-pg-migrate -d $DATABASE_URL -m src/postgres/migrations up
```

## Getting started

### Local

```bash
yarn install
cp .env.example .env
# fill in MNEMONIC, RPC_URL, AUTHORIZATION, DATABASE_URL ...
yarn start:dev
```

### Docker

```bash
docker build -t ixo-feegrant-nest .
docker run --rm -p 3000:3000 --env-file .env ixo-feegrant-nest
```

The image is multi-stage: builder on `node:22.16.0`, runtime on `node:22.16.0-slim`, production-only `node_modules`, and only the migrations `.sql` files copied into the runtime layer (so `MIGRATE_DB_PROGRAMATICALLY=1` works).

### docker-compose

The included `docker-compose.yaml` defines two services — `prod` (pulls the published GHCR image) and `dev` (builds locally with a volume mount for hot-reload). Both run the same `dist/main` entrypoint.

## Project structure

```
src/
├── app.controller.ts          # REST endpoints
├── app.module.ts              # NestJS root module — wires Schedule + Refresh
├── app.service.ts             # Implements /feegrant/* handlers
├── auth.middleware.ts         # Bearer-token check
├── granter.ts                 # IxoFeegrant singleton: wallet + signing client + grant helpers
├── main.ts                    # Bootstrap (with optional programmatic migrate)
├── sentry.interceptor.ts      # Wraps controller errors into Sentry
├── postgres/
│   ├── client.ts              # pg Pool + transaction helpers
│   ├── migrations.ts          # Programmatic node-pg-migrate runner
│   └── migrations/            # SQL migration files
├── refresh/
│   ├── refresh.module.ts      # NestJS module
│   ├── refresh.service.ts     # @Cron tick — orchestrates the four-step refresh
│   ├── chain.ts               # Paginates allowancesByGranter into a Set<address>
│   └── blocksync.ts           # Paginates new MsgGrantAllowance messages from blocksync
└── utils/
    ├── secrets.ts             # Env var registry (sourced from process.env via dotenv)
    └── chunk.ts               # chunkArray helper
```

## Operational notes

- **First cron tick** does a full historical backfill from blocksync (~70s for ~64K messages). Subsequent ticks process only the delta and run in milliseconds.
- **Granter wallet funding**: the cron only re-grants users whose allowance has lapsed, so steady-state burn is low. Plan for a sufficient `uixo` balance on the granter address to cover both signups (via the API) and lapsed-grant refreshes.
- **Coverage gap**: a user whose grant has just expired will be without coverage until the next cron tick — at default settings, at most 30 minutes.
- **Disabling the cron**: set `REFRESH_CRON_ENABLED=0` to run as an API-only service. The schema still applies but no ticks fire.

## Disclaimer

This service issues real chain transactions that spend `uixo` from the configured granter wallet. Treat the `MNEMONIC` env var with the same care as any other production private-key material; never commit it to source
