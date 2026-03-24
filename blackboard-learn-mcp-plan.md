# Blackboard Learn — MCP Server & Agent-Board Integration

> Build an MCP server wrapping the Blackboard Learn REST API, then surface it as a
> "Blackboard Learn" experience tab inside agent-board. Two deliverables, one story.

---

## Why This Is The Right Demo

1. **It's real** — Blackboard Learn has a public REST API and a free developer sandbox
2. **It's relevant** — you're applying to build AI-native products on top of Blackboard
3. **It's transferable** — an MCP server is reusable by any MCP-compatible client, not just agent-board
4. **It answers their concerns** — student-facing UX, FERPA-aware safety, audit logging, metrics
5. **It shows range** — you built an MCP server at Netflix, now you're doing it in your own time for their domain

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  agent-board                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Dev Chat │  │ Research │  │  Blackboard   │  │
│  │  (now)   │  │  (now)   │  │  Learn (new)  │  │
│  └──────────┘  └──────────┘  └───────┬───────┘  │
│                                      │           │
│              ┌───────────────────────┘           │
│              ↓                                   │
│     ┌─────────────────┐                          │
│     │  MCP Client     │  ← existing agent-board  │
│     │  (new connector)│    model layer            │
│     └────────┬────────┘                          │
└──────────────┼──────────────────────────────────┘
               │ MCP Protocol
               ↓
┌──────────────────────────────────────────────────┐
│         blackboard-learn-mcp (new repo)           │
│                                                   │
│  Tools:                                           │
│  - get_courses          - get_assignments         │
│  - get_grades           - get_announcements       │
│  - get_course_content   - get_due_dates           │
│  - get_discussion_posts - get_student_feedback    │
│  - search_content       - draft_announcement      │
│                                                   │
│  Resources:                                       │
│  - course://[id]        - student://[id]          │
│  - assignment://[id]    - grade://[id]            │
└────────────────────────┬─────────────────────────┘
                         │ REST API
                         ↓
              ┌─────────────────────┐
              │  Blackboard Learn   │
              │  REST API           │
              │  (dev sandbox)      │
              └─────────────────────┘
```

---

## Deliverable 1 — blackboard-learn-mcp

A standalone open source MCP server. New repo under nitsuah or Nitsuah-Labs.

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **HTTP Client:** axios or native fetch
- **Auth:** OAuth 2.0 (Blackboard Learn uses 3-legged OAuth)
- **Testing:** Vitest
- **Deployment:** npm package + Docker image

### MCP Tools to Implement

#### Student-Facing Tools
```typescript
get_my_courses()
// Returns: course list with name, instructor, term, status

get_upcoming_assignments(courseId?: string, daysAhead?: number)
// Returns: assignments due within N days, sorted by due date

get_my_grades(courseId?: string)
// Returns: grade breakdown, current standing, weighted average

get_course_content(courseId: string, searchQuery?: string)
// Returns: modules, documents, relevant materials

get_assignment_feedback(assignmentId: string)
// Returns: instructor comments, rubric scores, annotations

get_announcements(courseId?: string, unreadOnly?: boolean)
// Returns: course or global announcements
```

#### Instructor-Facing Tools
```typescript
get_submission_status(assignmentId: string)
// Returns: who submitted, who hasn't, submission timestamps

get_grade_distribution(assignmentId: string)
// Returns: average, median, spread, outliers

get_discussion_summary(threadId: string)
// Returns: participant count, key themes, unread posts

get_at_risk_students(courseId: string)
// Returns: students with low grades, missing submissions, low engagement

draft_announcement(courseId: string, topic: string, tone?: string)
// Returns: AI-drafted announcement text for instructor review
```

#### Shared Tools
```typescript
search_course_materials(query: string, courseId?: string)
// Returns: relevant documents, pages, content matched to query

get_calendar(startDate: string, endDate: string)
// Returns: all events, due dates, sessions across enrolled courses
```

### MCP Resources
```typescript
// Expose structured data as readable resources
course://[courseId]           // Full course metadata
assignment://[assignmentId]   // Assignment details + rubric
student://[userId]            // Student profile (own only)
grade://[courseId]            // Grade summary for a course
```

### Auth & Security
- OAuth 2.0 flow against Blackboard Learn
- Token stored locally, never transmitted to model
- **FERPA boundary enforcement** — every tool validates that the requesting user owns the data being returned. No cross-user data leakage.
- All data access logged as audit events (see metrics below)
- No PII in tool names or descriptions — only in returned data, handled by response filter layer

### Project Structure
```
blackboard-learn-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── student/          # Student-facing tools
│   │   ├── instructor/       # Instructor-facing tools
│   │   └── shared/           # Shared tools
│   ├── resources/            # MCP resource handlers
│   ├── auth/                 # OAuth flow + token management
│   ├── api/                  # Blackboard Learn REST client
│   │   ├── client.ts         # Base HTTP client + rate limiting
│   │   ├── courses.ts        # Course endpoints
│   │   ├── assignments.ts    # Assignment endpoints
│   │   ├── grades.ts         # Grade endpoints
│   │   └── users.ts          # User endpoints
│   ├── safety/               # FERPA boundary checks
│   └── audit/                # Access logging
├── tests/
├── docker/
├── .env.template
└── README.md
```

---

## Deliverable 2 — Blackboard Learn Tab in agent-board

Surface the MCP server as a first-class experience inside agent-board.

### The Experience

When a user selects "Blackboard Learn" from the experience selector:

1. **Auth flow** — OAuth handshake with Blackboard Learn, token stored in session
2. **Context injection** — system prompt pre-loaded with:
   - Student's enrolled courses
   - Assignments due in the next 7 days
   - Any unread announcements
   - User role (student vs instructor — different tools available)
3. **Guided prompts** — first-time users see suggested questions:
   - "What do I have due this week?"
   - "How am I doing in my courses?"
   - "Summarize what I missed this week"
4. **Safety config** — `strict` mode, FERPA-aware, no cross-user data
5. **Metrics tracking** — every query categorized and logged

### UI Changes to agent-board
- [ ] Add experience selector to landing page (card grid — Developer, Research, Blackboard Learn)
- [ ] Add Blackboard Learn experience config to `ExperienceConfig` system (from roadmap Phase 4)
- [ ] Add OAuth callback handler in Express server
- [ ] Add MCP client connector — agent-board talks to blackboard-learn-mcp via MCP protocol
- [ ] Add guided prompt suggestions component — context-aware chips above the input
- [ ] Add "Blackboard Learn" label to session history entries

---

## Metrics Specific to Edtech Experience

On top of the base metrics from the roadmap, track these for the Blackboard Learn tab:

| Event | What it tells you |
|-------|------------------|
| `tool_invoked` | Which Blackboard tools get used most |
| `query_category` | Grades / assignments / content / feedback / other |
| `ferpa_check_passed` | Normal access |
| `ferpa_check_blocked` | Attempted cross-user data access |
| `auth_completed` | OAuth conversion rate |
| `auth_abandoned` | Where students drop off in auth flow |
| `guided_prompt_used` | Which suggestions resonate |
| `session_context_loaded` | How long context injection takes |
| `tool_error` | Which Blackboard API calls fail and why |

These metrics tell a product story: what do students actually ask, where does the experience break down, what should be built next.

---

## FERPA Safety Implementation

This is the detail that shows you understand edtech specifically.

```typescript
// Every tool call passes through this before returning data
async function ferpaCheck(
  requestingUserId: string,
  dataOwnerId: string,
  dataType: string,
  toolName: string
): Promise<void> {

  // Students can only see their own data
  if (requestingUserId !== dataOwnerId) {
    await auditLog({
      event: 'ferpa_check_blocked',
      requestingUser: requestingUserId,
      attemptedDataOwner: dataOwnerId,
      dataType,
      toolName,
      timestamp: new Date().toISOString()
    });
    throw new FerpaViolationError(
      `Access denied: you can only access your own ${dataType}`
    );
  }

  // Log successful access too — full audit trail
  await auditLog({
    event: 'ferpa_check_passed',
    userId: requestingUserId,
    dataType,
    toolName,
    timestamp: new Date().toISOString()
  });
}
```

In the interview: "FERPA means every data access needs an audit trail and strict user boundary enforcement. I built that into the MCP server as a middleware layer — every tool call validates ownership before returning data and logs the access regardless of outcome. That's not a feature, it's a compliance requirement."

---

## Developer Sandbox Setup

Blackboard has a free developer program:

1. Register at developer.blackboard.com
2. Create an application to get OAuth credentials
3. Request access to the developer sandbox environment
4. Sandbox comes pre-loaded with test courses, students, assignments, grades

You can build and demo the entire thing without touching a real institution's data.

---

## Phased Build Order

### Week 1 — MCP Foundation
- [ ] Set up `blackboard-learn-mcp` repo with TypeScript + MCP SDK
- [ ] Implement OAuth flow against developer sandbox
- [ ] Build base REST client with rate limiting and error handling
- [ ] Implement `get_my_courses` and `get_upcoming_assignments` — enough to demo
- [ ] Basic FERPA check middleware
- [ ] README that explains what it is and why it exists

### Week 2 — Core Tools
- [ ] `get_my_grades`, `get_assignment_feedback`, `get_announcements`
- [ ] `get_submission_status` and `get_grade_distribution` for instructors
- [ ] Audit logging for all tool calls
- [ ] Vitest tests for core tools
- [ ] Docker image

### Week 3 — agent-board Integration
- [ ] Experience selector UI in agent-board
- [ ] Blackboard Learn experience config + system prompt
- [ ] MCP client connector in agent-board server
- [ ] Guided prompt suggestions
- [ ] Metrics events for edtech-specific categories

### Week 4 — Polish & Demo
- [ ] FERPA violation demo — show what happens when you try to access another user's data
- [ ] Metrics dashboard showing query categories and tool usage
- [ ] Onboarding flow for first-time users
- [ ] Record demo video
- [ ] Publish blackboard-learn-mcp as open source

---

## The Interview Pitch

> "I wanted to close the consumer product gap so I built something directly relevant to what you're working on. blackboard-learn-mcp is an open source MCP server wrapping the Blackboard Learn REST API — any MCP-compatible client can use it to let students ask natural language questions about their courses, assignments, and grades. I surfaced it as an experience tab inside agent-board so I had a real consumer-facing UI to test against. The interesting parts weren't the API calls — it was thinking through FERPA compliance as an audit logging and boundary enforcement problem, designing the metrics layer to understand what students actually ask versus what I assumed they'd ask, and building the auth flow for users who have no idea what OAuth is. That's the work I haven't done before and that's exactly why I built it."

---

*Ut prosim.*
