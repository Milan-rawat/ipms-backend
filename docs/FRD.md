# Functional Requirement Document (FRD)

## Internal Project Management System (IPMS)

**Version**: 1.1  
**Date**: August 2026  
**Status**: Approved for Implementation

---

## 1. Core Features

### 1.1 User Authentication

- Users register with name, email, and password
- Users log in with email and password, receiving a JWT access token
- All subsequent API requests are authenticated via JWT in the Authorization header
- Users can log out (client-side token removal)

### 1.2 Project Management

- Any authenticated user can create a new project (becoming its Admin)
- Project Admins can update project details (name, description)
- Project Admins can delete projects (associated tasks are deleted)
- Project Admins can add members by specifying the email of an already-registered user
- Project Admins can remove members from the project
- Users see only projects where they are a member (including projects they own)

**Clarification**: "Add member by email" means the Admin enters the email address of an existing registered user. The system looks up that user and adds them to the project. There is no email invitation delivery or signup link. The target user must already have an account.

### 1.3 Task Management

- Project members (Admin or Member) can create tasks within a project
- Tasks have: title, description (optional), status, priority, assignee (optional)
- Task statuses: `Todo`, `In Progress`, `Done`
- Task priorities: `Low`, `Medium`, `High`
- Any project member can update any task's details or status
- Project Admins can delete any task; Members can only delete tasks they created

### 1.4 Real-Time Collaboration

- When a task is created, updated, or deleted by any user, all other online members of the same project see the change instantly without refreshing
- Real-time updates are delivered via Socket.IO
- The database is the source of truth; socket events are a synchronization mechanism
- Users who open the project after a change occurred see the persisted (latest) state from the database

### 1.5 Task Board

- Visual board displaying tasks in columns by status: Todo | In Progress | Done
- Tasks can be moved between columns (triggering a status update)
- The board updates in real-time when other members make changes

---

## 2. User Roles & Permissions

### Roles

| Role | Scope | How Assigned |
|---|---|---|
| Admin | Per project | Automatically assigned to the user who creates the project |
| Member | Per project | Added by a project Admin |

**Note**: A single user can be Admin on some projects and Member on others. Role is always relative to a specific project.

### Permission Matrix

The column headers refer to the user's role **within a specific project**:

| Action | Admin | Member | Not a member of this project |
|---|---|---|---|
| Create a new project | Yes (becomes Admin of it) | Yes (becomes Admin of it) | Yes (becomes Admin of it) |
| View this project | Yes | Yes | No |
| Update this project | Yes | No | No |
| Delete this project | Yes | No | No |
| Add/remove members | Yes | No | No |
| Create tasks | Yes | Yes | No |
| View tasks | Yes | Yes | No |
| Update any task | Yes | Yes | No |
| Delete any task | Yes | Only tasks they created | No |
| Receive real-time updates | Yes | Yes | No |

**Engineering Assumption**: The PDF requires "User roles & permissions" but does not specify exact roles. Admin + Member is the minimum model that makes a project management tool functional. It is simple, covers all required operations, and avoids RBAC over-engineering.

---

## 3. Assumptions

1. All users are trusted internal employees (no public registration concerns)
2. Any person with the application URL can register (no email verification for MVP)
3. A user can participate in multiple projects with different roles
4. There is no global superadmin — all admin rights are project-scoped
5. Task status transitions are unrestricted (any status can transition to any other status)
6. Real-time updates are best-effort; the database is the authoritative source of truth
7. The system targets modern browsers (Chrome, Firefox, Safari, Edge — current versions)
8. MongoDB Atlas (free tier) will host the database
9. Redis Cloud (free tier) or equivalent will host the Redis instance
10. Adding a member means selecting an already-registered user — no email invitations are sent

---

## 4. Out-of-Scope Items

| Feature | Reason |
|---|---|
| Email verification / password reset | Not required by assessment |
| Email invitation delivery | Not required — member addition is in-app only |
| File attachments on tasks | Not required by assessment |
| Task comments / discussion | Not required by assessment |
| Notifications (email or in-app) | Not required by assessment |
| Task dependencies / subtasks | Not required by assessment |
| Time tracking / effort estimation | Not required by assessment |
| Gantt chart / calendar view | Not required by assessment |
| Search and advanced filtering | Not required by assessment |
| User profile management | Not required by assessment |
| Multi-tenancy / organizations | Not required by assessment |
| Audit trail / activity log | Not required by assessment |
| Mobile application | Not required by assessment |
| Drag-and-drop (stretch goal only) | Not a PDF requirement; button-based status change is sufficient |
| Server-side token revocation | Engineering decision — unnecessary complexity for internal tool MVP |

---

## 5. Non-Functional Requirements

| Requirement | Target | Category |
|---|---|---|
| Real-time delivery | Best-effort, typically sub-second | Engineering target |
| API response time | Reasonable for typical CRUD operations | Engineering target |
| Concurrent users | Architecture supports growth; not load-tested for MVP | Engineering target |
| Availability | Best-effort (constrained by free-tier hosting) | Infrastructure |
| Security | JWT auth, input validation, CORS, secure headers | Mandatory (PDF) |
| Browser support | Latest Chrome, Firefox, Safari, Edge | Engineering assumption |
| Deployment | Automated via GitHub Actions | Mandatory (PDF) |

**Note**: Specific latency numbers (e.g., "< 200ms") are engineering targets, not guarantees. The MVP has not been load-tested.
