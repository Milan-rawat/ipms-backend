# Deployment Documentation

## IPMS Production Deployment

---

## Architecture

```
Internet (HTTPS)
     |
     v
+---------------------------+        +---------------------------+
| Render Static Site        |        | Render Web Service        |
| Frontend (React build)    | -----> | Backend (Node.js)         |
| ipms-frontend-895w        |  API   | ipms-backend-7mly         |
|                           |  +WSS  |                           |
+---------------------------+        +-----+-------------+-------+
                                           |             |
                                           v             v
                                    +-----------+  +-----------+
                                    | MongoDB   |  | Redis     |
                                    | Atlas     |  | Upstash   |
                                    | (M0 Free) |  | (Free)    |
                                    +-----------+  +-----------+
```

---

## Production URLs

| Service | URL |
|---|---|
| Frontend | https://ipms-frontend-895w.onrender.com |
| Backend | https://ipms-backend-7mly.onrender.com |
| Health Check | https://ipms-backend-7mly.onrender.com/api/health |

---

## Services

### Backend — Render Web Service

- **Repository:** Milan-rawat/ipms-backend
- **Branch:** main
- **Build command:** `npm ci`
- **Start command:** `npm start`
- **Health check:** `/api/health`
- **Auto-deploy:** On push to main
- **Node.js:** Determined by `engines` in package.json (>=18)

### Frontend — Render Static Site

- **Repository:** Milan-rawat/ipms-frontend
- **Branch:** main
- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`
- **Rewrite rule:** `/* → /index.html` (required for React Router SPA)
- **Auto-deploy:** On push to main

### MongoDB — Atlas

- **Tier:** Free M0 (shared)
- **Network access:** `0.0.0.0/0` (required for Render's dynamic IPs)
- **Authentication:** Username/password
- **Connection:** TLS encrypted (`mongodb+srv://` or standard connection string)

### Redis — Upstash

- **Tier:** Free
- **Protocol:** `rediss://` (TLS required)
- **Purpose:** Socket.IO adapter only (pub/sub for multi-instance scaling)

---

## Environment Variables

### Backend (Render Dashboard — secret)

| Variable | Value Type | Notes |
|---|---|---|
| `NODE_ENV` | `production` | — |
| `MONGODB_URI` | Atlas connection string | Secret |
| `JWT_SECRET` | Random 64+ char string | Secret — generate a strong random value |
| `JWT_EXPIRES_IN` | `7d` | — |
| `REDIS_URL` | Upstash `rediss://` URL | Secret |
| `FRONTEND_URL` | Frontend Render URL | For CORS |

### Frontend (Build-time — public)

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://ipms-backend-7mly.onrender.com/api` | Baked into build |
| `VITE_SOCKET_URL` | `https://ipms-backend-7mly.onrender.com` | Baked into build |

---

## CORS Configuration

Backend CORS is restricted to `FRONTEND_URL` environment variable:
- REST API: `origin: env.frontendUrl`
- Socket.IO: `origin: env.frontendUrl`

Only the deployed frontend origin is permitted. No wildcard `*` in production.

---

## Socket.IO / WebSocket

- Render Web Services support WebSocket upgrade natively
- Socket.IO connects via WSS (same origin as backend HTTPS)
- JWT authentication in Socket.IO handshake
- Redis adapter enables cross-instance event propagation

---

## HTTPS / SSL

Render provides automatic TLS certificates for all services. No manual Let's Encrypt configuration required.

- Frontend: `https://ipms-frontend-895w.onrender.com`
- Backend: `https://ipms-backend-7mly.onrender.com`
- WebSocket: `wss://ipms-backend-7mly.onrender.com`

---

## CI/CD Relationship

```
Developer pushes to main
  → GitHub Actions runs (lint + test + build)
  → Render detects push to main
  → Render builds and deploys automatically
```

CI validates code quality. Render handles deployment.

---

## VM / Nginx Alternative

The assignment states: *"If you have a VM then deploy this way otherwise you can use free services like netlify, render etc."*

This project uses the **Render deployment path** as explicitly permitted. If a VM were used instead, the equivalent setup would be:

```
Internet → Domain (DNS) → Nginx (SSL via Let's Encrypt)
  → /api/* → Node.js :5000 (PM2 managed)
  → /socket.io/* → Node.js :5000 (WebSocket upgrade)
  → /* → Static files (React build)
```

Render provides the managed equivalent: SSL termination, routing, WebSocket support, and process management.

---

## Production Verification Checklist

- [x] Backend health endpoint responding
- [x] MongoDB Atlas connected
- [x] Redis (Upstash) connected
- [x] Socket.IO adapter attached
- [x] Frontend loads and renders
- [x] User registration works
- [x] User login works
- [x] Projects CRUD works
- [x] Member management works
- [x] Tasks CRUD works
- [x] Real-time task events verified (two browsers)
- [x] Reconnection recovery works
- [x] CORS configured correctly
- [x] HTTPS on both services
- [x] No secrets committed to Git
- [x] GitHub Actions CI passing
