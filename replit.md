# Fair Exchange

A simulation of a censorship-resistant batch-auction exchange designed to reduce velocity advantages through sealed orders, uniform pricing, and committee validation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
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
- `artifacts/api-server/src/routes/exchange.ts` — exchange API routes
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `artifacts/fair-exchange/README.md` — simulation limits, auction policy, failure assumptions, and future phases

## Architecture decisions

- This first milestone is an in-memory simulation; it does not connect to a chain, custody assets, or perform threshold encryption.
- The target product must remain non-custodial, with no privileged administrative keys or central operator.
- Uniform-price auction tie-breaking is explicit and documented; changes require economic review because allocation policy affects incentives.

## Product

Traders can inspect a demo batch, submit or cancel sealed limit orders, observe simulated committee quorum and reveal steps, clear the batch at a uniform price, and explore failure scenarios and the audit log.

## User preferences

- The product blueprint prioritizes fairness over speed, transparent failure behavior, user autonomy, and structural resilience.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
