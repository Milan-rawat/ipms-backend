# AI Usage Declaration

## Project: IPMS — Internal Project Management System

---

## AI Tool Used

**Kiro** — AI-powered development environment (IDE assistant)

---

## How AI Was Used

| Area | AI Involvement |
|---|---|
| Architecture exploration | AI assisted in discussing architecture options, trade-offs, and decisions |
| System design | AI helped produce the FRD, architecture report, and decision log |
| Backend implementation | AI assisted with code generation for Express routes, services, models, middleware |
| Frontend implementation | AI assisted with React components, Zustand stores, and Socket.IO integration |
| Test creation | AI helped write Jest and Vitest test suites |
| Debugging | AI assisted in diagnosing real-time race conditions and Redis connection issues |
| CI/CD configuration | AI helped create GitHub Actions workflow files |
| Deployment preparation | AI assisted with production configuration audit and environment setup |
| Documentation | AI helped produce README, deployment docs, and this declaration |
| Code review / audit | AI performed compliance audits against the original assignment requirements |

---

## Developer Responsibility

- The developer reviewed every architectural decision and implementation choice
- All automated tests (131 backend + 35 frontend) were executed and verified
- Production deployment was manually smoke-tested with multiple users
- Real-time collaboration was manually verified with two browser sessions
- The developer understands the complete codebase and can explain any technical decision
- The developer can walk through any API endpoint, socket event flow, or authorization chain line-by-line

---

## What AI Did NOT Do

- AI did not deploy to production autonomously
- AI did not configure secrets or credentials
- AI did not make unsupervised architectural changes
- AI-generated code was not accepted without review and testing
- AI did not replace the developer's understanding of the system

---

## Verification Process

Every phase of development followed this workflow:

1. AI assists with implementation
2. Developer reviews the output
3. Automated tests executed (`npm test`)
4. Linting verified (`npm run lint`)
5. Production build verified (`npm run build`)
6. Manual testing performed where applicable
7. Code committed only after verification passes

---

## Statement

AI was used extensively as a productivity tool. The final implementation is understood, tested, and defensible by the developer. The developer takes full responsibility for the submitted work and can explain every technical decision during an interview.
