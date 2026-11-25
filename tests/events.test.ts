import { describe, expect, it } from "vitest";
import {
  ACTIVITY_EVENT_TYPES,
  ActivityEventSchema,
  parseActivityEvent,
} from "../src/events.js";

const base = {
  eventId: "evt-1",
  occurredAt: "2026-11-25T12:00:00Z",
  userId: "user-1",
};

describe("ActivityEventSchema", () => {
  it.each([
    { ...base, type: "grade.posted", courseId: "course-1", columnId: "column-1" },
    { ...base, type: "submission.created", courseId: "course-1", assignmentId: "assignment-1" },
    { ...base, type: "login.recorded" },
    { ...base, type: "course.updated", courseId: "course-1", changed: ["name"] },
  ])("accepts a valid $type event", (event) => {
    expect(ActivityEventSchema.safeParse(event).success).toBe(true);
    expect(parseActivityEvent(event)).toEqual(event);
  });

  it("rejects an unknown event type", () => {
    expect(parseActivityEvent({ ...base, type: "user.deleted" })).toBeNull();
  });

  it("rejects missing required fields", () => {
    expect(parseActivityEvent({ ...base, type: "grade.posted", courseId: "course-1" })).toBeNull();
  });

  it("rejects invalid datetimes", () => {
    expect(parseActivityEvent({ ...base, occurredAt: "yesterday", type: "login.recorded" })).toBeNull();
  });

  it("rejects an empty changed list", () => {
    expect(parseActivityEvent({ ...base, type: "course.updated", courseId: "course-1", changed: [] })).toBeNull();
  });

  it("exposes the four supported event types", () => {
    expect(ACTIVITY_EVENT_TYPES).toHaveLength(4);
    expect(ACTIVITY_EVENT_TYPES).toEqual([
      "grade.posted",
      "submission.created",
      "login.recorded",
      "course.updated",
    ]);
  });
});
