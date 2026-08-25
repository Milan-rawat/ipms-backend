# IPMS Server

Backend API for the Internal Project Management System.

## Requirements

- Node.js >= 18
- MongoDB (local or Atlas)
- Redis (local or cloud)

## Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values
# Required: MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, REDIS_URL, FRONTEND_URL
```

## Development

```bash
# Start with hot reload
npm run dev

# Start without hot reload
npm start
```

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint issues |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development` / `production` / `test` (default: development) |
| `PORT` | No | Server port (default: 5000) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Yes | Token expiry (e.g., `7d`) |
| `REDIS_URL` | Yes | Redis connection URL |
| `FRONTEND_URL` | Yes | Frontend origin for CORS |

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Server liveness check |

*Additional endpoints will be documented as they are implemented.*
