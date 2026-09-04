# Project: blackboard-learn-mcp + agent-board Edtech Integration
## Design Requirements & Project Plan

> Built to demonstrate direct readiness for the Blackboard AI Product Engineer role.
> Every feature maps to a stated JD requirement. Nothing is padding.

---

## North Star

Build a working, observable, safety-enforced AI study assistant powered by a standalone
MCP server wrapping the Blackboard Learn REST API — surfaced as a consumer-facing
experience in agent-board with real metrics, real safety guardrails, and real personas.

**The demo should answer every concern they have before they ask it.**

---

## Two Repos, One Story

```
blackboard-learn-mcp/        ← standalone MCP server, open source, runs anywhere
agent-board/                 ← consumes the MCP, adds the consumer-facing experience
```

The MCP is the infrastructure. agent-board is the product surface.
They're independent but designed together.

---

## Personas

Everything is built around four real user types. Each has different data access,
different safety requirements, different useful queries, and different trust levels.

### 🎓 Student
- Sees only their own data (FERPA hard boundary)
- Primary use: assignments, grades, feedback, course content, study help
- Safety concern: cheating detection, self-harm guardrails, prompt injection
- Trust level: lowest — adversarial by assumption on academic integrity

### 👩‍🏫 Instructor
- Sees their own course data + enrolled student aggregate data (no individual PII in responses)
- Primary use: submission status, grade distributions, at-risk students, announcements
- Safety concern: accidental cross-section data access, student privacy
- Trust level: elevated — but scoped to their courses only

### 🏫 Administrator
- Sees institution-wide aggregate data — no individual student data without explicit audit log
- Primary use: engagement metrics, course completion rates, platform health
- Safety concern: FERPA compliance at scale, audit trail completeness
- Trust level: high — but every access logged

### 👨‍👩‍👧 Parent
- Most restricted — sees only their linked student's data with student consent model
- Primary use: grades, attendance, upcoming deadlines
- Safety concern: consent verification, no unsanctioned access to student communications
- Trust level: conditional on consent chain

---

## Repo 1: blackboard-learn-mcp

### Purpose
Standalone MCP server. Any MCP-compatible client points at it and gets natural
language access to Blackboard Learn. Runs as a Docker container or npm package.

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Auth:** OAuth 2.0 (Blackboard Learn 3-legged OAuth)
- **HTTP Client:** axios + retry logic + rate limiting
- **Safety:** NemoClaw sidecar for sandbox enforcement
- **Audit:** Postgres (shared with agent-board or standalone)
- **Testing:** Vitest
- **CI/CD:** GitHub Actions → Docker Hub

### Architecture

```
MCP Client (agent-board, Claude Desktop, Cursor, anything)
        │
        │ MCP Protocol (stdio or SSE)
        ↓
┌─────────────────────────────────────────────┐
│              MCP Server                      │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │ Tool Router  │    │ Resource Handler │   │
│  └──────┬───────┘    └────────┬─────────┘   │
│         │                    │              │
│  ┌──────▼────────────────────▼──────────┐   │
│  │         Middleware Pipeline           │   │
│  │                                       │   │
│  │  1. Auth Validator                    │   │
│  │     └─ Is token valid? Refresh?       │   │
│  │  2. Persona Resolver                  │   │
│  │     └─ Who is this? What role?        │   │
│  │  3. FERPA Boundary Check              │   │
│  │     └─ Can this persona see this?     │   │
│  │  4. Audit Logger                      │   │
│  │     └─ Log access regardless          │   │
│  │  5. Rate Limiter                      │   │
│  │     └─ Per user, per tool             │   │
│  └──────────────────┬────────────────────┘   │
│                     │                        │
│  ┌──────────────────▼────────────────────┐   │
│  │       Blackboard Learn REST Client    │   │
│  │                                       │   │
│  │  courses  │ assignments │ grades      │   │
│  │  users    │ content     │ discussions │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
        │
        │ REST API
        ↓
  Blackboard Learn
  (developer sandbox)
```

### MCP Tools — by Persona

#### Student Tools
```typescript
get_my_courses()
// Enrolled courses, instructor, term, status

get_upcoming_assignments(courseId?: string, daysAhead = 7)
// Due dates sorted ascending, overdue flagged

get_my_grades(courseId?: string)
// Current grade, breakdown, trend vs class average

get_assignment_feedback(assignmentId: string)
// Instructor comments, rubric scores, annotations

get_course_content(courseId: string, query?: string)
// Semantic search over course materials

get_announcements(unreadOnly = true)
// Course + global announcements

ask_tutor(question: string, courseId?: string)
// AI-assisted explanation — ACADEMIC INTEGRITY ENFORCED
// Will help understand concepts, will NOT produce submittable work
```

#### Instructor Tools
```typescript
get_submission_status(assignmentId: string)
// Submitted / not submitted / late breakdown

get_grade_distribution(assignmentId: string)
// Average, median, spread, outliers

get_at_risk_students(courseId: string)
// Low grades + missing submissions + low engagement composite

get_discussion_summary(threadId: string)
// Participation count, key themes, sentiment

draft_announcement(courseId: string, topic: string, tone?: string)
// AI draft — instructor reviews before sending, never auto-posts
```

#### Administrator Tools
```typescript
get_institution_summary()
// Aggregate engagement, completion rates, course health

get_course_health_report(term?: string)
// Courses with low engagement, at-risk sections

get_platform_usage(startDate: string, endDate: string)
// Activity trends, model usage, feature adoption
```

#### Parent Tools
```typescript
get_student_summary(studentId: string)
// Grades, upcoming deadlines, attendance
// REQUIRES: verified consent chain, student approval

get_upcoming_deadlines(studentId: string)
// Next 14 days of due dates
```

### Safety Layer

#### Academic Integrity Enforcement
```typescript
// Fires on ask_tutor and any content-generating tool
const academicIntegrityCheck = async (prompt: string, context: AssignmentContext) => {
  const flags = [
    /write.*essay/i,
    /complete.*assignment/i,
    /give me the answer/i,
    /do.*homework/i,
    /submit.*for me/i
  ];

  const isFlagged = flags.some(f => f.test(prompt));

  if (isFlagged) {
    await emitEvent('academic_integrity_flag', { prompt, context });
    return {
      blocked: true,
      response: "I can help you understand this topic but I can't produce work for submission. Want me to explain the underlying concept instead?"
    };
  }
};
```

#### Self-Harm Detection
```typescript
// Every message passes through this before tool invocation
const wellnessCheck = async (message: string, userId: string) => {
  // Uses local classifier — no external API for privacy
  const risk = await classifyWellnessRisk(message);

  if (risk === 'high') {
    await emitEvent('wellness_flag_high', { userId, risk });
    return {
      intercept: true,
      response: "It sounds like you might be going through something difficult. " +
                "Your school's counseling services are available at [resource]. " +
                "Would you like me to help you find support?"
    };
  }
};
```

#### Prompt Injection Detection
```typescript
const injectionPatterns = [
  /ignore (previous|all|prior) instructions/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /as (a )?DAN/i,
  /jailbreak/i,
  /bypass/i,
  /system prompt/i
];
```

#### FERPA Middleware
```typescript
// Every tool call — no exceptions
const ferpaCheck = async (
  requestingUserId: string,
  targetUserId: string,
  dataType: string,
  toolName: string,
  persona: Persona
) => {
  const allowed = evaluateAccess(persona, targetUserId, requestingUserId);

  await auditLog({
    event: allowed ? 'ferpa_check_passed' : 'ferpa_check_blocked',
    requestingUserId,
    targetUserId,
    dataType,
    toolName,
    persona,
    timestamp: new Date().toISOString()
  });

  if (!allowed) throw new FerpaViolationError();
};
```

#### NemoClaw Integration
- All tool execution runs inside NemoClaw sandbox
- `--cap-drop=all` with `NET_BIND_SERVICE` only
- `no-new-privileges` enforced
- Particularly relevant for `ask_tutor` — model execution is sandboxed
- Safety policy config per persona — student gets strictest policy

### Audit & Observability

Every tool call produces a structured audit event:
```typescript
interface AuditEvent {
  event_id: string;        // uuid
  timestamp: string;       // ISO8601
  user_id: string;         // or 'anonymous'
  persona: Persona;        // student | instructor | admin | parent
  tool_name: string;
  course_id?: string;
  ferpa_outcome: 'passed' | 'blocked';
  safety_flags: string[];  // academic_integrity | wellness | injection | none
  duration_ms: number;
  error?: string;
}
```

Stored in Postgres. Queryable by admin. Exportable for compliance.

---

## Repo 2: agent-board (additions only)

### What Changes
- Experience selector on landing page
- Blackboard Learn experience config
- MCP client connector (points at blackboard-learn-mcp)
- Persona-aware system prompt injection
- Guided prompts per persona
- Metrics dashboard tab
- Wellness escalation UI component

### Experience Config
```typescript
const blackboardExperience: ExperienceConfig = {
  id: 'blackboard-learn',
  name: 'Blackboard Learn',
  description: 'AI study assistant connected to your courses',
  icon: '🎓',
  mcp_server: process.env.BLACKBOARD_MCP_URL,
  safety_config: 'strict',
  requires_auth: true,
  auth_type: 'oauth',
  personas: ['student', 'instructor', 'admin', 'parent'],
  guided_prompts: {
    student: [
      "What do I have due this week?",
      "How am I doing in my courses?",
      "Can you help me understand this concept?",
      "What feedback did I get on my last assignment?"
    ],
    instructor: [
      "Who hasn't submitted the last assignment?",
      "How did students perform on the last quiz?",
      "Which students might be struggling?",
      "Draft a reminder for missing submissions"
    ],
    admin: [
      "How is platform engagement this term?",
      "Which courses have low completion rates?",
      "Show me activity trends for the last 30 days"
    ],
    parent: [
      "What does my student have due this week?",
      "How are they doing in their courses?"
    ]
  }
};
```

### Metrics Dashboard
New tab in agent-board showing:

**Usage**
- Sessions by persona over time
- Most used tools
- Query categories (grades / assignments / content / tutor / other)
- Average session length by persona

**Safety**
- Academic integrity flags over time
- Wellness flags — high/medium/low
- Prompt injection attempts
- FERPA blocks

**Quality**
- Tool error rates
- Response latency by tool
- User feedback (thumbs up/down per response)
- Bail rate (sessions with 1 message only)

**Compliance**
- Full audit log viewer — filterable by user, tool, date, outcome
- FERPA access report — exportable
- Safety event report — exportable

---

## Event Schema (shared between both repos)

```typescript
// Base event — everything extends this
interface BaseEvent {
  event_id: string;
  session_id: string;
  user_id: string;
  persona: 'student' | 'instructor' | 'admin' | 'parent' | 'unknown';
  timestamp: string;
  experience: string;
}

// All event types
type EventType =
  | 'session_start'
  | 'session_end'
  | 'message_sent'
  | 'tool_invoked'
  | 'tool_completed'
  | 'tool_error'
  | 'ferpa_check_passed'
  | 'ferpa_check_blocked'
  | 'academic_integrity_flag'
  | 'wellness_flag_low'
  | 'wellness_flag_high'
  | 'injection_attempt'
  | 'safety_block'
  | 'feedback_positive'
  | 'feedback_negative'
  | 'guided_prompt_used'
  | 'auth_completed'
  | 'auth_abandoned';
```

---

## Database Schema

```sql
-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  persona VARCHAR(20) NOT NULL,
  experience VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  model VARCHAR(100)
);

-- Events (append-only audit log)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  user_id UUID NOT NULL,
  persona VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  tool_name VARCHAR(100),
  course_id VARCHAR(100),
  ferpa_outcome VARCHAR(10),
  safety_flags TEXT[],
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);

-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  message_index INTEGER,
  sentiment VARCHAR(10), -- positive | negative
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Build Phases

### Phase 1 — MCP Foundation (Week 1)
*Goal: one working tool, end to end*

- [ ] Repo setup — TypeScript, MCP SDK, Vitest, GitHub Actions
- [ ] OAuth flow against Blackboard developer sandbox
- [ ] Base REST client with retry + rate limiting
- [ ] `get_my_courses` working end to end
- [ ] FERPA middleware skeleton
- [ ] Audit logger writing to Postgres
- [ ] Docker image builds and runs
- [ ] README explains what it is and how to run it

**Demo checkpoint:** "Here are my courses" working via MCP in Claude Desktop

---

### Phase 2 — Core Student Tools (Week 2)
*Goal: the full student happy path*

- [ ] `get_upcoming_assignments`
- [ ] `get_my_grades`
- [ ] `get_assignment_feedback`
- [ ] `get_announcements`
- [ ] Academic integrity check on `ask_tutor`
- [ ] Wellness detection on all inbound messages
- [ ] Prompt injection detection
- [ ] Vitest tests for all tools + safety layers
- [ ] NemoClaw sidecar wired up

**Demo checkpoint:** Student asks "what do I have due this week, how am I doing, and can you explain this concept" — all working, safety layers firing correctly

---

### Phase 3 — Instructor + Admin Tools (Week 2-3)
*Goal: show the full persona model works*

- [ ] `get_submission_status`
- [ ] `get_grade_distribution`
- [ ] `get_at_risk_students`
- [ ] `draft_announcement` (with explicit "instructor reviews before sending" guardrail)
- [ ] `get_institution_summary` for admin
- [ ] Persona resolver — OAuth token → role → available tools
- [ ] FERPA scoping per persona (instructor only sees their courses)

**Demo checkpoint:** Same MCP server, different persona, different available tools, different data boundaries

---

### Phase 4 — agent-board Integration (Week 3)
*Goal: consumer-facing UI that non-engineers can use*

- [ ] Experience selector landing page
- [ ] Blackboard Learn experience config
- [ ] MCP client connector in Express server
- [ ] OAuth callback handler
- [ ] Guided prompts per persona
- [ ] Wellness escalation UI — not just a block, a supportive redirect
- [ ] Session context injection — courses + upcoming deadlines in system prompt
- [ ] EventBus wired to all interaction points

**Demo checkpoint:** Open agent-board, select Blackboard Learn, authenticate, ask a question as a student, see the guided prompts, see a safety flag handled gracefully

---

### Phase 5 — Metrics & Observability (Week 4)
*Goal: show you understand what users actually do*

- [ ] All event types firing and persisting
- [ ] Metrics API endpoints
- [ ] Metrics dashboard tab in agent-board
- [ ] Safety event breakdown visible
- [ ] FERPA audit log exportable
- [ ] Health endpoint showing per-tool latency
- [ ] At least one insight from real sandbox usage — "here's what I learned"

**Demo checkpoint:** Show the dashboard updating in real time as queries come in. Show a FERPA block in the audit log. Show an academic integrity flag. Show feedback ratio.

---

### Phase 6 — Polish & Demo Ready (Week 4-5)
*Goal: something you'd be proud to screen share in an interview*

- [ ] Onboarding flow for first-time users
- [ ] Public demo mode — Safe Chat, no auth, limited tools
- [ ] Record 3-minute demo video
  - Experience selector → select Blackboard Learn
  - Authenticate as student
  - Ask "what do I have due this week"
  - Ask something that triggers academic integrity flag — show graceful response
  - Switch to instructor persona
  - Ask "who hasn't submitted" — show different tools, different data
  - Show metrics dashboard updating
  - Show audit log with FERPA checks
- [ ] Publish blackboard-learn-mcp to npm
- [ ] Update both READMEs with product framing

---

## JD Checklist — How We're Hitting Every Requirement

| JD Requirement | How We Hit It |
|---|---|
| Student-facing interfaces | agent-board Blackboard Learn tab, guided prompts, wellness UI |
| Real-time AI features | Streaming MCP responses, live metrics dashboard |
| Responsive performant UI | Existing agent-board React stack |
| API routes + backend services | blackboard-learn-mcp Express + MCP server |
| AI orchestration, streaming, agent outputs | MCP tool pipeline, NemoClaw sandbox |
| Event-driven ingestion pipelines | EventBus → Postgres, structured audit events |
| Data access controls + audit logging | FERPA middleware, per-persona scoping, full audit table |
| Storage architecture | Postgres schema designed to evolve — sessions, events, feedback |
| CI/CD, no dedicated DevOps | GitHub Actions, Netlify, Docker Hub, existing patterns |
| MCP experience | The whole thing IS an MCP |
| RAG pipeline design | Course content + assignment context injected as structured prompt context |
| Observability tooling | Metrics dashboard, structured logging, health endpoints, per-tool latency |
| Consumer product instincts | Four personas, guided prompts, onboarding, bail rate tracking |
| Move fast under ambiguity | Phased build — working demo by week 2, polish by week 5 |

---

## The Interview Pitch (60 seconds)

> "I built two things. First, an open source MCP server wrapping the Blackboard Learn
> REST API — any MCP-compatible client can point at it and get natural language access
> to course data. Second, I surfaced it as a consumer-facing experience in agent-board
> with four personas — student, instructor, admin, parent — each with different data
> access, different safety configs, and different useful queries.
>
> The interesting problems weren't the API calls. They were academic integrity
> enforcement, wellness detection at 2am when a student is struggling, FERPA boundary
> middleware that logs every access regardless of outcome, and prompt injection from
> students who are motivated to find the cracks. I used NemoClaw to sandbox model
> execution and built a metrics layer so I could watch what users actually did versus
> what I assumed they'd do.
>
> I built this because I wanted to close the consumer product gap on my resume. But I
> also genuinely think this is the right architecture for what you're building."

---

*Ut prosim.*
