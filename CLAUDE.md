# CLAUDE.md

## Commands

 @README.md

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

Full SSR (`output: "server"`). API routes must export `const prerender = false`.

### Key conventions

- Path alias `@/*` → `./src/*` (tsconfig)
- Astro components for layout/static;Use React only for
   components that require useState, useEffect, or browser event handlers — wire with a client:* directive. Static content, layout wrappers, and navigation use .astro components.
- Tailwind merging: use `cn()` from `@/lib/utils` — never concatenate class strings manually
- shadcn/ui in `src/components/ui/`, new-york style; add with `npx shadcn@latest add [name]`
- API routes: uppercase `GET`/`POST` exports; validate with zod
- Supabase migrations: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`; always enable RLS with per-operation, per-role policies
- No Next.js directives (`"use client"` etc.); hooks go in `src/components/hooks/`
- Services/helpers in `src/lib/`; shared types/DTOs in `src/types.ts`

### Auth flow

- `src/lib/supabase.ts` — Supabase SSR client with cookie sessions; `SUPABASE_URL`/`SUPABASE_KEY` via `astro:env/server`
- `src/middleware.ts` — resolves user on every request, attaches to `context.locals.user`, redirects from `PROTECTED_ROUTES`
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`

### Environment

- Node.js v22.14.0 (`.nvmrc`)
- Copy `.env.example` → `.env` for Node; use `.dev.vars` for Cloudflare local dev (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler login`)

## CI
@.github/workflows/ci.yml.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 5

Scale the single-change cycle into parallel work with **worktrees, goal-directed delegation, and multi-session orchestration**:

```
worktree per change -> /goal or claude -p -> PR -> review -> merge
```

The lesson focus is safe throughput: isolated contexts, choosing the right execution mode, and capping parallelism at review capacity.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code isolation** | |
| `git worktree add` | You need a separate working directory for a parallel change. One change per worktree, one fresh agent context per worktree. |
| **Complex changes** | |
| `/10x-implement <change-id> phase <n>` | The change has multiple phases, needs manual gates, or benefits from interactive decision-making during execution. |
| **Simple changes** | |
| `/goal` | You have a clear, bounded task and want goal-directed delegation. The agent works autonomously toward the stated goal with a stop condition. |
| `claude -p` | You want headless execution for a well-defined task. The Ralph Wiggum loop (run, check, retry) is the universal autonomous pattern. |
| **Multi-session orchestration** | |
| Superset / Conductor / Antigravity / VS Code Agent View | You are running multiple agent sessions in parallel and need visibility, coordination, or session management across them. |

### Parallel work rules

- One change per worktree or isolated workspace. One fresh agent context per change.
- Choose interactive `/10x-implement` for complex changes, `/goal` or `claude -p` for simple ones.
- Parallelism is capped by review capacity. More agents without review means more unreviewed code, not higher throughput.
- The quality pain from faster shipping is intentional — it bridges into Module 3 testing gates.

### Lesson boundaries

- Do not reteach interactive `/10x-implement` or `/10x-impl-review`; those are Lessons 2 and 3.
- Do not introduce testing strategy here. The quality pain is the motivation for Module 3.
- Worktrees are a mechanism for isolation, not the topic of a full git tutorial.

### Paths used by this lesson

- `context/changes/<change-id>/` - active change folder
- `context/changes/<change-id>/plan.md` - implementation input for any execution mode

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
