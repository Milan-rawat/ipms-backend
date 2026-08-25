# IPMS — Internal Project Management System

A real-time collaborative project management tool built with the MERN stack + Socket.IO + Redis.

Authenticated users can create projects, manage members, and collaborate on tasks — with changes appearing instantly across all connected clients via WebSocket communication.

---

## Live Demo

| Resource | URL |
|---|---|
| Frontend | https://ipms-frontend-895w.onrender.com |
| Backend API | https://ipms-backend-7mly.onrender.com |
| Health Check | https://ipms-backend-7mly.onrender.com/api/health |
| Backend Repo | https://github.com/Milan-rawat/ipms-backend |
| Frontend Repo | https://github.com/Milan-rawat/ipms-frontend |

> Note: Render free tier may cold-start after inactivity (~30s first request).

---

## Key Features

- JWT authentication with bcrypt password hashing
- Project creation and management with Admin/Member roles
- Add/remove project members by email
- Task CRUD with status (Todo / In Progress / Done) and priority (Low / Medium / High)
- Task assignment to project members
- Real-time task updates via Socket.IO (create/update/delete)
- Real-time member events (added/removed)
- Project-based Socket.IO rooms with membership authorization
- Redis adapter for multi-instance Socket.IO scaling
- Reconnection with automatic state recovery
- Server-side authorization on every operation
- Input validation (Joi), rate limiting, Helmet security headers
- Centralized error handling
- GitHub Actions CI (lint + test + build)

---

## Tech Stack

**Backend:** Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, Joi, Socket.IO, Redis (ioredis), @socket.io/redis-adapter, Helmet, CORS, express-rate-limit

**Frontend:** React 19, Vite 8, React Router, Zustand, Axios, Socket.IO Client

**Infrastructure:** GitHub Actions, Render, MongoDB Atlas, Upstash Redis

**Testing:** Jest + Supertest (backend), Vitest + Testing Library (frontend)

---

## Architecture Overview

```
Browser (React SPA)
    |
    | HTTPS / WSS
    v
Render Platform (SSL + Routing)
    |
    v
Node.js + Express + Socket.IO
    |           |
    v           v
MongoDB       Redis
(Atlas)       (Upstash - Socket.IO Adapter)
```

**Data flow for real-time updates:**

```
User A: REST mutation (POST/PUT/DELETE)
  → Express route → Auth middleware → Validation → Controller
    → Service → MongoDB persistence (source of truth)
      → SUCCESS → Socket.IO emit to project room
        → Redis adapter propagates across instances
          → User B's socket receives event
            → Zustand store updates → React re-renders
```

**Key architectural principles:**
- MongoDB is the single source of truth
- Socket.IO events are emitted ONLY after successful database persistence
- REST handles all mutations; Socket.IO handles real-time notifications
- Redis enables horizontal scaling (not used as cache or session store)
- Frontend authorization is UX; backend authorization is security

---

## Authentication & Authorization

**Authentication:**
- JWT access token (7-day expiry)
- bcrypt password hashing (10 salt rounds)
- Token in `Authorization: Bearer <token>` header
- Socket.IO authenticates via `auth: { token }` handshake
- Session restoration via `GET /api/auth/me`

**Authorization (server-enforced):**
- **Admin**: project creator — full control (update, delete, manage members)
- **Member**: invited user — can create/update tasks, view project
- **Task deletion**: Admin (any task) or task creator (own tasks)
- Project membership checked on every API request and socket room join
- Cross-project access prevented (task.project verified against route projectId)

---

## Design Decisions & Trade-offs

| # | Decision | Why | Trade-off |
|---|---|---|---|
| 1 | React + Vite (not Next.js) | Internal SPA, no SSR/SEO needed | No server rendering |
| 2 | Zustand (not Redux/Context) | Selective subscriptions critical for real-time | Smaller ecosystem |
| 3 | REST + Socket.IO | REST for mutations (status codes, validation); WS for push | Two communication patterns |
| 4 | Emit after persistence | Never notify about uncommitted state | Slight latency |
| 5 | Redis = Socket.IO adapter only | Single responsibility, enables scaling | Extra infra component |
| 6 | JWT 7-day, no refresh token | Simple, sufficient for internal tool | Longer exposure window |
| 7 | localStorage for token | Needed for Socket.IO handshake auth | XSS exposure (mitigated by React escaping + CSP) |
| 8 | Project rooms = auth boundary | Natural isolation per project | Memory per room |
| 9 | Last-write-wins concurrency | Simple, low collision at small team scale | Silent overwrites possible |
| 10 | Admin + Member only | Minimum viable RBAC | Less granular permissions |
| 11 | Separate repos | Independent deploy and CI | Two repos to manage |
| 12 | Render (not VM) | PDF allows free services; instant, free | Cold starts on free tier |
| 13 | Sequential cascade deletion | Simple, orphans harmless | Not atomic |

Full decision log: [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md)

---

## API List

### Authentication

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, receive JWT |
| POST | `/api/auth/logout` | Yes | Acknowledge logout |
| GET | `/api/auth/me` | Yes | Get current user |

### Projects

| Method | Endpoint | Auth | Authorization | Purpose |
|---|---|---|---|---|
| POST | `/api/projects` | Yes | Any auth user | Create project |
| GET | `/api/projects` | Yes | Returns member projects | List projects |
| GET | `/api/projects/:id` | Yes | Member | Get project details |
| PUT | `/api/projects/:id` | Yes | Admin | Update project |
| DELETE | `/api/projects/:id` | Yes | Admin | Delete project + tasks |
| POST | `/api/projects/:id/members` | Yes | Admin | Add member by email |
| DELETE | `/api/projects/:id/members/:userId` | Yes | Admin | Remove member |

### Tasks

| Method | Endpoint | Auth | Authorization | Purpose |
|---|---|---|---|---|
| POST | `/api/projects/:projectId/tasks` | Yes | Member | Create task |
| GET | `/api/projects/:projectId/tasks` | Yes | Member | List project tasks |
| GET | `/api/projects/:projectId/tasks/:taskId` | Yes | Member | Get task |
| PUT | `/api/projects/:projectId/tasks/:taskId` | Yes | Member | Update task |
| DELETE | `/api/projects/:projectId/tasks/:taskId` | Yes | Admin or creator | Delete task |

### Health

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | No | Liveness check |

---

## Socket Events List

### Connection

Authentication via Socket.IO handshake: `auth: { token: "<JWT>" }`

Server verifies JWT → attaches `socket.user = { id, email }` → accepts/rejects connection.

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `project:join` | `{ projectId }` | Join project room (server validates membership) |
| `project:leave` | `{ projectId }` | Leave project room |

### Server → Project Room

| Event | Payload | Trigger |
|---|---|---|
| `task:created` | `{ task }` | Task created via REST |
| `task:updated` | `{ task }` | Task updated via REST |
| `task:deleted` | `{ taskId, projectId }` | Task deleted via REST |
| `member:added` | `{ user: { _id, name, email } }` | Member added to project |
| `member:removed` | `{ userId, projectId }` | Member removed from project |

### Room Naming

Pattern: `project:<projectId>`

### Reconnection Strategy

1. Socket.IO auto-reconnects with exponential backoff
2. On `connect` event: automatically rejoins pending/current room
3. Client fetches fresh task list from REST API (state reconciliation)
4. MongoDB/REST is the recovery mechanism — no event replay

---

## Database

**Collections:** Users, Projects, Tasks

| Collection | Key Fields | Relationships |
|---|---|---|
| Users | name, email, password (hashed, select:false) | — |
| Projects | name, description, owner, members[{user, role}] | owner→User, members→User[] |
| Tasks | title, description, status, priority, project, assignee, createdBy | project→Project, assignee→User, createdBy→User |

**Indexes:** `{ email: 1 }` (unique), `{ 'members.user': 1 }`, `{ project: 1, status: 1 }`

**Cascade:** Project deletion removes all associated tasks sequentially.

---

## Security

- bcrypt password hashing (10 rounds)
- JWT verification on every protected route
- Server-side project membership authorization
- Joi input validation on all endpoints
- ObjectId format validation
- Helmet security headers
- CORS restricted to `FRONTEND_URL`
- Rate limiting (100 req/15min)
- Production errors sanitized (no stack traces)
- Environment variables for all secrets
- Socket.IO authenticated + room membership verified
- No secrets in frontend VITE_* variables

**Known trade-off:** JWT stored in localStorage (required for Socket.IO auth). Mitigated by React's JSX escaping, input validation, and no `dangerouslySetInnerHTML`.

---

## Local Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Redis (local or Upstash) — optional for single instance
- Git

### Backend

```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, Redis URL, frontend URL
npm install
npm run dev      # development with hot reload
npm start        # production
npm test         # run tests
npm run lint     # lint
```

**Required environment variables:**

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Random secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (e.g., `7d`) |
| `REDIS_URL` | Redis connection URL (e.g., `rediss://...`) |
| `FRONTEND_URL` | Frontend origin for CORS |

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env with backend URLs
npm install
npm run dev      # development server (port 5173)
npm run build    # production build
npm test         # run tests
npm run lint     # lint
```

**Required environment variables:**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend REST API URL (e.g., `http://localhost:5000/api`) |
| `VITE_SOCKET_URL` | Socket.IO server URL (e.g., `http://localhost:5000`) |

---

## Testing

| | Backend | Frontend |
|---|---|---|
| Framework | Jest + Supertest | Vitest + Testing Library |
| Test suites | 5 | 4 |
| Tests | 131 | 35 |
| Status | All passing | All passing |
| Lint | 0 errors | 0 errors |

Backend covers: auth, projects, tasks, socket.IO, health endpoint.
Frontend covers: auth store, project store, task store, real-time event handlers.

---

## Git & CI/CD

**Repositories:** Separate backend + frontend repos with independent histories.

**Branch strategy:** `main` (stable) + `feature/*` branches merged via `--no-ff`.

**Commit convention:** `feat(scope)`, `fix(scope)`, `test(scope)`, `ci(scope)`, `chore(scope)`

**GitHub Actions:**
- Backend: `npm ci` → lint → test (on push/PR to main)
- Frontend: `npm ci` → lint → test → build (on push/PR to main)

**Deployment:** Render auto-deploys from `main` after push. CI validates quality; Render handles deployment.

---

## Deployment

### Architecture

| Component | Provider | Notes |
|---|---|---|
| Frontend | Render Static Site | Vite build, SPA rewrite `/* → /index.html` |
| Backend | Render Web Service | Node.js, auto-SSL, WebSocket support |
| Database | MongoDB Atlas | Free M0 cluster, TLS |
| Redis | Upstash | Free tier, TLS (`rediss://`) |

### Steps

1. Push to GitHub → GitHub Actions validates (lint + test + build)
2. Render auto-deploys backend from `ipms-backend` main branch
3. Render auto-deploys frontend from `ipms-frontend` main branch
4. Backend env vars configured in Render dashboard (secrets never committed)
5. Frontend build-time env vars point to production backend URL
6. MongoDB Atlas: IP whitelist `0.0.0.0/0` (required for Render dynamic IPs), authenticated
7. Redis: Upstash TLS connection via `rediss://` URL
8. Health check: `GET /api/health` returns `{ success: true }`

### VM/Nginx Note

The assignment states: *"If you have a VM then deploy this way otherwise you can use free services like netlify, render etc."*

This project uses the **Render (free service) deployment path** as explicitly permitted by the assignment. Render provides managed SSL termination, routing, and WebSocket support — equivalent to what Nginx provides on a VM. The Nginx/Let's Encrypt/domain configuration applies to the alternative VM deployment path.

---

## Documentation

| Document | Location | Contents |
|---|---|---|
| FRD | [docs/FRD.md](docs/FRD.md) | Core features, roles, assumptions, out-of-scope |
| Architecture Report | [docs/PHASE1_ARCHITECTURE_REPORT.md](docs/PHASE1_ARCHITECTURE_REPORT.md) | Full system design |
| Architecture Decisions | [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) | Decision log with trade-offs |
| AI Usage Declaration | [docs/AI_USAGE_DECLARATION.md](docs/AI_USAGE_DECLARATION.md) | AI tool usage disclosure |
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment details |

---

## AI Usage Declaration

AI (Kiro) was used as a development assistant throughout this project. See [docs/AI_USAGE_DECLARATION.md](docs/AI_USAGE_DECLARATION.md) for full disclosure. All code was reviewed, tested, and validated by the developer. The developer understands and can explain every architectural decision and implementation detail.
