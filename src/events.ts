/**
 * Normalized Blackboard activity-event schema for downstream event ingestion.
 */
import { z } from "zod";

/** Supported normalized Blackboard activity event types. */
export const ACTIVITY_EVENT_TYPES = [
  "grade.posted",
  "submission.created",
  "login.recorded",
  "course.updated",
] as const;

/** Union of supported activity event type names. */
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

const baseEvent = z.object({
  eventId: z.string().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  userId: z.string().min(1),
});

/** Validates the normalized payload for each supported activity event. */
export const ActivityEventSchema = z.discriminatedUnion("type", [
  baseEvent.extend({
    type: z.literal("grade.posted"),
    courseId: z.string().min(1),
    columnId: z.string().min(1),
  }),
  baseEvent.extend({
    type: z.literal("submission.created"),
    courseId: z.string().min(1),
    assignmentId: z.string().min(1),
  }),
  baseEvent.extend({
    type: z.literal("login.recorded"),
  }),
  baseEvent.extend({
    type: z.literal("course.updated"),
    courseId: z.string().min(1),
    changed: z.array(z.string().min(1)).min(1),
  }),
]);

/** Parsed normalized activity event. */
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

/**
 * Parse an unknown value as an activity event.
 *
 * @param input - Untrusted event payload.
 * @returns The validated event, or null when validation fails.
 */
export function parseActivityEvent(input: unknown): ActivityEvent | null {
  const result = ActivityEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
