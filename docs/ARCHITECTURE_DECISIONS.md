# Architecture Decision Log

## IPMS — Internal Project Management System

This document records key architectural decisions, their rationale, and trade-offs. Each decision is defensible in a Team Lead interview context.

---

## Decisions

| # | Decision | Choice | Why | Trade-off | Category |
|---|---|---|---|---|---|
| 1 | Frontend framework | React (Vite) | Internal SPA, no SSR/SEO needed. Static build deploys anywhere. Simpler mental model for real-time state. | Cannot add SSR later without migration to Next.js or Remix. | Mandatory (PDF: React or Next.js) |
| 2 | State management | Zustand | Selective subscriptions prevent cascade re-renders from socket events. Works outside React (socket listeners update store directly). Minimal boilerplate for 3 screens. | Smaller ecosystem than Redux. Fewer devtools. | Mandatory (PDF: justified choice) |
| 3 | Communication pattern | REST for mutations + Socket.IO for push | REST provides request/response semantics, status codes, standard error handling. Socket.IO provides instant push notifications. Each protocol does what it's best at. | Two communication patterns to maintain and test. | Engineering decision |
| 4 | Source of truth | MongoDB (database) | All state changes persist to DB before any notification. If sockets fail, data is safe. Clients can always GET fresh state. | Extra DB write on every mutation (vs optimistic socket-only). | Engineering decision |
| 5 | Event emission timing | After successful DB persistence | Never notify users about state that might be rolled back. Guarantees consistency between DB and notifications. | Adds ~5-15ms latency vs emitting optimistically before DB confirms. | Engineering decision |
| 6 | Redis responsibility | Socket.IO pub/sub adapter only | Single clear purpose. Enables horizontal scaling without code changes. No unnecessary second use that complicates the architecture. | Redis is underutilized for MVP (single instance). | Mandatory (PDF: Redis) |
| 7 | Socket room strategy | `project:<projectId>` | Natural 1:1 mapping between project access control and event isolation. Joining a room = subscribing to a project's updates. | Memory per room. User must re-join on reconnect. | Engineering decision |
| 8 | JWT lifetime | 7 days, no refresh token | Internal tool — users shouldn't re-login daily. No refresh token = no rotation logic, no cookie management, simpler implementation. | 7-day exposure window if token stolen. No server-side revocation. | Engineering decision |
| 9 | Token storage | localStorage | Needed for Socket.IO auth (JS must access token for handshake). Avoids CSRF complexity of cookies. Mitigated by React escaping + CSP + validation. | Vulnerable to XSS. If attacker injects JS, token is accessible. | Engineering decision |
| 10 | Server-side token revocation | None (client-side logout only) | Avoids per-request Redis lookup. Internal tool with trusted users. 7-day expiry limits exposure naturally. | A logged-out token remains valid until expiry. Attacker with stolen token has a window. | Engineering decision |
| 11 | Role model | Admin + Member (per-project) | Minimum model that covers all required operations. Simple to implement and explain. Avoids RBAC over-engineering. | No granular permissions (e.g., "can assign but not delete"). | Engineering decision |
| 12 | Member storage | Array of ObjectIds on Project document | Efficient for typical project sizes. Single query to check membership. No join collection needed. | Doesn't scale beyond ~1000 members per project (array size). | Engineering decision |
| 13 | Add member mechanism | Lookup registered user by email | No email delivery system needed. Admin types email of existing user. Simple, meets requirement. | User must already be registered. No invitation flow. | Engineering decision |
| 14 | Task concurrency | Last-write-wins | Simple. MongoDB document locking prevents corruption. Collision probability is very low for small teams. Easy to explain. | Simultaneous edits silently overwrite. No conflict detection. | Engineering decision |
| 15 | Project deletion | Sequential delete (tasks then project) | Simple, sufficient. Orphaned tasks (partial failure) are harmless — no query will find them. | Not atomic — partial failure leaves orphans (but they're invisible). | Engineering decision |
| 16 | Reconnection strategy | Full state refresh from REST API | Correct by definition — no missed events possible. Simple to implement. | Re-fetches all tasks even if nothing changed. More bandwidth. | Engineering decision |
| 17 | Deployment platform | Render (free tier) primary | PDF permits free services. Demonstrates deployment without requiring VM access. SSL automatic. | Cold starts on free tier. No custom Nginx control. | Mandatory (PDF: VM or free service) |
| 18 | Nginx | VM deployment path only | PDF requires Nginx. On Render, the platform provides equivalent functionality. Nginx config documented for VM alternative. | On Render, we don't control the reverse proxy layer. | Mandatory (PDF: Nginx) |
| 19 | Git branching | `main` + feature branches | Solo developer — `develop` branch adds merge ceremony without value. Feature branches give clean history. Merge to main = deploy. | No integration branch. Less gatekeeping. | Mandatory (PDF: branching strategy) |
| 20 | CI pipeline | GitHub Actions (lint + build) | PDF requires it. Lint catches errors pre-deploy. Build verifies frontend compiles. | No integration tests in CI (would need test DB). | Mandatory (PDF: CI pipeline) |

---

## Decisions Changed During Review (v1.0 → v1.1)

| Decision | v1.0 | v1.1 | Reason for Change |
|---|---|---|---|
| JWT lifetime | 24 hours | 7 days | 24h too aggressive for internal tool UX. Also conflicted with Redis section that mentioned "15min". Resolved to single consistent value. |
| Redis JWT blacklist | Yes (secondary Redis responsibility) | Removed | Adds per-request latency, complicates auth middleware, unnecessary for internal tool with client-side logout. Redis should have single clear purpose. |
| Token storage justification | "Internal = lower XSS risk" | Honest trade-off documented | The original wording was indefensible. XSS risk exists regardless of audience. Documented real mitigations instead. |
| "Invite by email" meaning | Ambiguous (implied email delivery) | Clarified: lookup existing user by email | No email service needed. Simpler. PDF doesn't require email delivery. |
| Git strategy | main + develop + feature | main + feature | `develop` branch is unnecessary ceremony for solo developer. |
| Scalability claims | "10,000 connections", "hundreds comfortably" | Architectural statements without specific numbers | Unverified claims are indefensible in interview. Replaced with "what enables scaling." |
| Nginx requirement | Listed as mandatory for all deployments | Mandatory for VM path; platform-handled on Render | On Render there is no Nginx — the platform provides equivalent functionality. |
| PATCH /tasks/:id/status | Separate endpoint | Merged into PUT /tasks/:id | Unnecessary API surface. PUT handles all task updates including status. |

---

## Meta-Decisions (How We Decide)

1. **PDF requirement = non-negotiable**: If the PDF says it, we do it.
2. **Simpler = better** (unless simplicity sacrifices a PDF requirement): Every added component must solve a real problem.
3. **Defensible > impressive**: Choose the solution you can explain in 60 seconds, not the one that looks complex.
4. **Document trade-offs honestly**: Never claim a decision has no downsides. Acknowledge and explain why the downside is acceptable.
5. **Distinguish fact from assumption**: Label engineering assumptions explicitly.
