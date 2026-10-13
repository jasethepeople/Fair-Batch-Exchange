# Fair Exchange

A simulation of a censorship-resistant batch-auction exchange designed to reduce velocity advantages through sealed orders, McAfee double-auction clearing, and committee validation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-server run test:mechanisms` — run clearing-rule and engine tests
- `pnpm --filter @workspace/api-server run compare:mechanisms` — compare McAfee and max-volume policies
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fair-exchange/` — browser exchange simulation
- `artifacts/api-server/src/lib/exchange-engine.ts` — in-memory auction and committee simulation
- `artifacts/api-server/src/lib/mcafee.ts` — active McAfee clearing rule
- `artifacts/api-server/src/lib/max-volume.ts` — max-volume uniform-price comparison policy
- `artifacts/api-server/scripts/compare-mechanisms.ts` — reproducible economic comparison
- `artifacts/api-server/src/routes/exchange.ts` — exchange API routes
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `artifacts/fair-exchange/README.md` — simulation limits, auction policy, failure assumptions, and future phases
- `MECHANISM_COMPARISON.md` and `whitepaper-outline.md` — experiment summary and protocol-paper structure

## Architecture decisions

- This first milestone is an in-memory simulation; it does not connect to a chain, custody assets, or perform threshold encryption.
- The target product must remain non-custodial, with no privileged administrative keys or central operator.
- The active McAfee rule can use either a uniform price or trade reduction with separate buyer/seller prices. Changes to clearing policy require economic review because allocation and surplus affect incentives.
- McAfee's classic truthfulness result is for single-unit traders. This demo accepts divisible orders and makes no strategy-proofness claim.

## Product

Traders can inspect a demo batch, submit or cancel sealed limit orders, observe simulated committee quorum and reveal steps, clear the batch under McAfee, and explore failure scenarios and the audit log.

## User preferences

- The product blueprint prioritizes fairness over speed, transparent failure behavior, user autonomy, and structural resilience.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
