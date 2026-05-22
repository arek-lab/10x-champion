---
project: room-pilot
researched_at: 2026-05-22
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 6 + React 19
  runtime: workerd (Cloudflare V8 isolates)
  database: Supabase (external — PostgreSQL + Auth)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The tech stack was selected with Cloudflare Workers as the target runtime — `@astrojs/cloudflare` v13 (GA) targets Workers exclusively, `wrangler` covers the full operational loop from CLI, and `astro dev` in Astro 6 already runs on `workerd` via the Cloudflare Vite plugin, closing the dev-to-production gap. The $5/month paid tier is the minimum viable configuration (free tier's 10 ms CPU cap is too tight for any SSR route that calls Supabase); at 10k–100k requests/month, total cost stays under $5/month base. The user's existing Cloudflare familiarity removes a ramp-up cost from a 3-week timeline.

---

## Platform Comparison

Scored Pass (2) / Partial (1) / Fail (0) against the five agent-friendly platform criteria.

| Platform | CLI-first | Managed | Agent docs | Deploy API | MCP | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **10** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | **9** |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | **9** |
| Fly.io | Pass | Partial | Partial | Pass | Partial | **7** |
| Railway | Partial | Pass | Pass | Partial | Partial | **7** |
| Render | Partial | Pass | Pass | Partial | Partial | **7** |

**Cloudflare Workers**: Full CLI coverage — `wrangler deploy`, `wrangler rollback <VERSION_ID>`, `wrangler tail`. workerd is fully managed serverless with no OS exposure. llms.txt published at `developers.cloudflare.com/llms.txt`; any page returns Markdown with `Accept: text/markdown`. Sixteen-plus MCP servers covering Workers management, KV, R2, DNS, and observability (no explicit GA label as of May 2026, but production-ready in practice).

**Vercel**: Solid Node.js runtime (Edge runtime deprecated — do not use). Strong CLI (`vercel deploy`, `vercel rollback`, `vercel logs`). llms.txt and llms-full.txt published. MCP server launched August 2025 but remains Public Beta — no GA date announced. Hobby plan is non-commercial only; Pro is $20/month.

**Netlify**: Fully managed serverless (Lambda + Edge Functions for middleware). Credit-based pricing since September 2025 — Free tier viable up to 100k requests/month. Official MCP server is GA since June 2025, the strongest MCP story of any platform. CLI rollback is not available — rollback is UI-only by clicking "Publish Deploy" on any prior atomic deploy. This is an agent operational gap.

**Fly.io**: Persistent Firecracker microVMs, `fly deploy` with strategy flags. No llms.txt — only per-page GitHub markdown. No free tier since late 2024; ~$2–5/month with scale-to-zero. MCP integration is explicitly experimental. Rollback requires `fly releases` + `fly deploy --image` — CLI-executable but multi-step and does not revert migrations.

**Railway**: Managed containers, `railway up` for deploy, `railway logs` for streaming. llms.txt at `railway.com/llms.txt`. No free tier (Hobby $5/month with $5 credit). No CLI rollback — dashboard only. Railpack (the replacement build system for Nixpacks) is in beta as of March 2026. MCP is preview/WIP.

**Render**: Node.js Web Services (persistent containers). CLI supports deploy and logs; rollback is REST API or dashboard, no CLI command. Free tier spins down after 15 minutes (30–60s cold start) — Starter at $7/month is the minimum viable paid tier. MCP server GA since August 2025 but cannot trigger deploys or rollbacks — read-mostly.

---

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already the target runtime in `tech-stack.md`. The `@astrojs/cloudflare` v13 adapter (GA) deploys SSR to Workers natively; `astro dev` runs on `workerd` in Astro 6, eliminating the dev-to-prod gap. `wrangler` covers every operational loop action from the CLI — deploy, rollback by version ID, real-time log tailing. llms.txt is comprehensive and product-scoped. Sixteen-plus MCP servers provide structured agent access to the platform. Paid tier at $5/month covers 10M requests and 30M CPU-ms per month.

#### 2. Vercel

The strongest alternative. Node.js runtime avoids `workerd` shim risk — Supabase's Node.js crypto dependencies run without modification. Full CLI: `vercel deploy`, `vercel rollback`, `vercel logs`. llms-full.txt is the best single-file docs dump of any platform evaluated. The only gap is the MCP server (Public Beta since August 2025). Pro at $20/month is 4× the Cloudflare paid tier for this traffic volume.

#### 3. Netlify

Unique GA MCP server (June 2025) is the strongest agent integration story among all platforms evaluated. Credit-based free tier is viable at 100k requests/month. The hard gap is rollback: there is no `netlify rollback` CLI command — an agent needs to call the UI or trigger a redeploy of a prior build. At $0/month for this traffic profile, cost is the best of the shortlist. Viable if the rollback gap is acceptable.

---

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **`nodejs_compat` shim coverage for Supabase is not guaranteed.** The Supabase JS client internally uses Node.js crypto, `Buffer`, and `EventEmitter`. These are shimmed by the flag, but shim completeness depends on the `compatibility_date` in `wrangler.jsonc` — a stale date silently disables some shims. Failures surface in production, not in `astro dev`, because `astro dev` runs on real Node.js.

2. **"cloudflare-pages" in tech-stack.md and CLAUDE.md is a migration trap.** The `@astrojs/cloudflare` v13 adapter removed Pages support entirely. Any Pages-style config in `wrangler.jsonc` from the bootstrap phase (Pages project name, Pages-specific bindings) must be migrated to the Workers-with-static-assets model before first deployment. This is non-trivial and can consume days of a 3-week sprint.

3. **Free tier's 10 ms CPU limit is unusable for SSR routes that call Supabase.** Any auth-gated page that makes a Supabase call during rendering exceeds the limit and returns an opaque 1101/1102 error. The $5/month paid tier is mandatory from day one — a surprise that hits during initial testing.

4. **Preview Workers are publicly accessible by default.** Unlike Cloudflare Pages (which had project-level Cloudflare Access integration), Workers preview URLs on `workers.dev` subdomains are unauthenticated and publicly reachable. For a hotel guest portal with QR tokens, partial builds expose guest-facing UI to anyone who discovers the preview URL. Cloudflare Access must be configured manually per preview route.

5. **`wrangler tail` samples traffic under load.** The default sampling rate means errors during request spikes can be silently dropped. The `--sampling-rate 1` flag provides complete capture but incurs Durable Objects cost — not documented prominently and not pre-configured.

### Pre-mortem — How This Could Fail

The hotel MVP launched on Cloudflare Workers after a smooth local dev experience using Astro 6's workerd integration. The first failure was quiet: intermittent 500 errors on auth-gated pages, appearing in `wrangler tail` but invisible in `astro dev`. After four days of investigation, the root cause was a Node.js crypto API path in the Supabase JS client that wasn't covered by the `nodejs_compat` shims at the project's `compatibility_date`. Bumping the date fixed the crypto shim but broke the image service, which had silently switched to `cloudflare-binding` in the v13 adapter upgrade without a binding configured in `wrangler.jsonc`.

Parallel to this, the bootstrap phase had written "cloudflare-pages" into the config. The first CI deployment to production failed with undocumented binding errors, requiring a manual migration to the Workers-with-static-assets model. That cost two days. Preview deployments during this period went live unauthenticated — a test QR token URL for a fake guest was indexed by a search crawler that found the open `workers.dev` subdomain. Cloudflare Access rules were added retroactively. By week 3, the MVP launched — but with half the sprint consumed by infrastructure debugging rather than feature development.

### Unknown Unknowns

1. **`astro dev` ≠ Workers production in all edge cases.** Astro 6's workerd integration closes the gap significantly, but Cloudflare-specific isolate error handling, binding timeout behavior, and KV namespace semantics still only surface in `wrangler dev` or real deployments.

2. **Preview Workers are public by default — no project-level toggle.** For a hotel guest portal, unauthenticated preview URLs mean partial implementations of QR auth or test guest data can be discovered. Requires manual Cloudflare Access configuration per Worker route.

3. **`compatibility_date` in `wrangler.jsonc` controls active `nodejs_compat` shims.** Supabase's internal Node.js usage may work on one compatibility date and silently fail on another, with a generic runtime error that doesn't point to the date as the cause.

4. **Image service default changed in `@astrojs/cloudflare` v13.** The service now defaults to `cloudflare-binding` (Cloudflare Images). Without an explicitly configured binding, image optimization fails at build or runtime with an error that doesn't clearly name the missing binding.

5. **CI/CD with Wrangler requires a scoped API token with three separate permission scopes** (`Workers:Edit`, `Workers Scripts:Edit`, `Account:Read`). The scope requirements are spread across multiple documentation pages; a token with insufficient permissions returns a 403 with a non-descriptive message.

---

## Operational Story

- **Preview deploys**: Push to a branch → Cloudflare Workers preview URL on `workers.dev` subdomain, generated per deploy. Preview URLs are **publicly accessible by default** — configure Cloudflare Access manually to gate them. Preview URLs do not require a separate project; each `wrangler deploy --name <preview-name>` creates an isolated Worker.
- **Secrets**: Runtime environment variables live in Cloudflare Workers Secrets, set via `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. For local dev, use `.dev.vars` (gitignored). CI uses `CLOUDFLARE_API_TOKEN` as a repository secret passed to `wrangler deploy`. Secrets are write-only — not readable after creation, only replaceable.
- **Rollback**: `npx wrangler deployments list` to see version IDs; `npx wrangler rollback <VERSION_ID>` to revert. Typical time-to-revert: under 30 seconds (no rebuild required, versions are pre-cached). Database migrations applied by Supabase are not rolled back automatically — handle schema rollbacks separately via Supabase migrations.
- **Approval**: Deploying to production (`wrangler deploy`) and rotating secrets (`wrangler secret put`) may be done unattended by a CI agent with a scoped API token. Billing tier changes (Free → Paid), Cloudflare Access configuration, and custom domain setup require a human logged into the Cloudflare dashboard.
- **Logs**: `npx wrangler tail [worker-name] --format json` for structured streaming; filter with `--status error` or `--search "term"`. For complete capture under load: `--sampling-rate 1`. Historical logs are available in the Cloudflare dashboard under Workers → Logs (retention: 7 days on paid tier).

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `nodejs_compat` shim gaps for Supabase JS client | Devil's advocate | M | H | Pin `compatibility_date` to latest stable date; add an integration test that exercises Supabase auth through the Workers runtime (not just `astro dev`). |
| Pages→Workers migration gap in bootstrap config | Devil's advocate | H | M | Audit `wrangler.jsonc` immediately after bootstrap: remove any `pages_build_output_dir`, add `assets.directory = "dist/client"`, confirm `main` points to `dist/server/entry.mjs`. |
| Free tier CPU limit (10ms) unusable for SSR | Devil's advocate | H | M | Upgrade to Workers Paid ($5/month) before first Supabase-authenticated SSR test. Set this as a day-one action in the Getting Started checklist below. |
| Unauthenticated preview URLs expose partial builds | Unknown unknowns | M | M | Create a Cloudflare Access policy gating the `*.workers.dev` subdomain for non-production Worker names. Apply before first PR preview is created. |
| `compatibility_date` controls shim behavior silently | Unknown unknowns | M | M | Keep `compatibility_date` within 90 days of the current date. Document the date update cadence in CLAUDE.md. |
| Image service defaults to `cloudflare-binding` in v13 | Unknown unknowns | M | L | Set `imageService: "compile"` explicitly in the `@astrojs/cloudflare` adapter config unless Cloudflare Images is intentionally configured. |
| CI API token insufficient scope returns opaque 403 | Unknown unknowns | L | M | Use the Cloudflare API token template "Edit Cloudflare Workers" — it pre-selects the required three scopes. Document the exact template name in the GitHub Actions secrets setup guide. |
| wrangler tail sampling drops errors under load | Devil's advocate | M | L | Use `--sampling-rate 1` in incident response; accept sampled logs in normal operation. Set up a Cloudflare Analytics alert for 5xx rate as a complement. |

---

## Getting Started

1. **Upgrade to Workers Paid tier immediately** — log into the Cloudflare dashboard → Workers & Pages → Plans → select "Workers Paid" ($5/month). The free tier's 10 ms CPU limit will fail the first SSR route that calls Supabase.

2. **Authenticate Wrangler**: `npx wrangler login` (browser OAuth) or set `CLOUDFLARE_API_TOKEN` using the "Edit Cloudflare Workers" API token template from the Cloudflare dashboard → My Profile → API Tokens.

3. **Audit and fix `wrangler.jsonc` after bootstrap**: confirm `main = "dist/server/entry.mjs"`, `assets.directory = "dist/client"`, `nodejs_compat` is in `compatibility_flags`, and `compatibility_date` is set to within the last 90 days. Remove any Pages-specific keys (`pages_build_output_dir`).

4. **Set runtime secrets**: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. For local dev, ensure these are in `.dev.vars` (gitignored). The `astro dev` server reads from `.dev.vars` via the Cloudflare Vite plugin.

5. **Deploy**: `npm run build && npx wrangler deploy`. Verify the deployment URL, then tail logs: `npx wrangler tail --format json`.

---

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions workflows)
- Production-scale architecture (multi-region, Durable Objects for stateful SSR, HA)
