/**
 * Webhook subscription management MCP tools.
 * Each tool requires role=admin and ferpa_authorized=true.
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import { checkAuthorization, parseIdentity } from "../auth.js";
import { withMetrics } from "../metrics.js";

interface BbWebhookSubscription {
  id: string;
  url: string;
  description?: string;
  eventTypes: string[];
  format: string;
  active: boolean;
  createdDate: string;
  modifiedDate?: string;
}

// ── list_webhook_subscriptions ──────────────────────────────────────────────
export const ListWebhookSubscriptionsInput = z.object({
  caller_identity: z.unknown(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const listWebhookSubscriptionsHandler = withMetrics(
  "list_webhook_subscriptions",
  async (args: z.infer<typeof ListWebhookSubscriptionsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "list_webhook_subscriptions",
    });

    try {
      const res = await bbClient.get<{ results: BbWebhookSubscription[] }>(
        `/webhooks/subscriptions`,
        {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      );

      const subscriptions = (res.data.results ?? []).map(
        (sub: BbWebhookSubscription) => ({
          id: sub.id,
          url: sub.url,
          description: sub.description,
          eventTypes: sub.eventTypes,
          format: sub.format,
          active: sub.active,
          createdDate: sub.createdDate,
          modifiedDate: sub.modifiedDate,
        }),
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                subscriptions,
                limit: args.limit,
                offset: args.offset,
                count: subscriptions.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch {
      // Webhook endpoint might not be available on all Blackboard instances
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                subscriptions: [],
                limit: args.limit,
                offset: args.offset,
                count: 0,
                note: "Webhook subscription endpoint not available on Blackboard instance. Check if webhooks feature is enabled.",
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

export const listWebhookSubscriptionsSchema = {
  name: "list_webhook_subscriptions",
  description:
    "Returns all webhook subscriptions. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      limit: {
        type: "number",
        description: "Max results (1-100)",
        default: 50,
      },
      offset: { type: "number", description: "Pagination offset", default: 0 },
    },
    required: ["caller_identity"],
  },
};

// ── get_webhook_subscription ───────────────────────────────────────────────
export const GetWebhookSubscriptionInput = z.object({
  caller_identity: z.unknown(),
  subscriptionId: z.string(),
});

export const getWebhookSubscriptionHandler = withMetrics(
  "get_webhook_subscription",
  async (args: z.infer<typeof GetWebhookSubscriptionInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_webhook_subscription",
    });

    try {
      const res = await bbClient.get<BbWebhookSubscription>(
        `/webhooks/subscriptions/${args.subscriptionId}`,
      );

      const sub = res.data;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                subscription: {
                  id: sub.id,
                  url: sub.url,
                  description: sub.description,
                  eventTypes: sub.eventTypes,
                  format: sub.format,
                  active: sub.active,
                  createdDate: sub.createdDate,
                  modifiedDate: sub.modifiedDate,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch {
      // Webhook endpoint might not be available on all Blackboard instances
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  "Webhook subscription not found or endpoint not available",
                subscriptionId: args.subscriptionId,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

export const getWebhookSubscriptionSchema = {
  name: "get_webhook_subscription",
  description:
    "Returns a single webhook subscription by ID. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      subscriptionId: {
        type: "string",
        description: "Webhook subscription ID",
      },
    },
    required: ["caller_identity", "subscriptionId"],
  },
};

// ── create_webhook_subscription ───────────────────────────────────────────
export const CreateWebhookSubscriptionInput = z.object({
  caller_identity: z.unknown(),
  url: z.string().url(),
  description: z.string().optional(),
  eventTypes: z.array(z.string()).min(1),
  format: z.enum(["JSON", "XML"]).default("JSON"),
});

export const createWebhookSubscriptionHandler = withMetrics(
  "create_webhook_subscription",
  async (args: z.infer<typeof CreateWebhookSubscriptionInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "create_webhook_subscription",
    });

    try {
      const res = await bbClient.post<BbWebhookSubscription>(
        `/webhooks/subscriptions`,
        {
          url: args.url,
          description: args.description,
          eventTypes: args.eventTypes,
          format: args.format,
          active: true,
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                subscription: {
                  id: res.data.id,
                  url: res.data.url,
                  description: res.data.description,
                  eventTypes: res.data.eventTypes,
                  format: res.data.format,
                  active: res.data.active,
                  createdDate: res.data.createdDate,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch {
      // Webhook endpoint might not be available on all Blackboard instances
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  "Failed to create webhook subscription. Endpoint might not be available.",
                url: args.url,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

export const createWebhookSubscriptionSchema = {
  name: "create_webhook_subscription",
  description:
    "Creates a new webhook subscription. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      url: {
        type: "string",
        description: "URL to receive webhook events",
        format: "uri",
      },
      description: {
        type: "string",
        description: "Description of the webhook subscription (optional)",
      },
      eventTypes: {
        type: "array",
        items: { type: "string" },
        description:
          "List of event types to subscribe to (e.g., ['course.created', 'grade.posted'])",
        minItems: 1,
      },
      format: {
        type: "string",
        enum: ["JSON", "XML"],
        description: "Format of webhook payload",
        default: "JSON",
      },
    },
    required: ["caller_identity", "url", "eventTypes"],
  },
};

// ── update_webhook_subscription ───────────────────────────────────────────
export const UpdateWebhookSubscriptionInput = z.object({
  caller_identity: z.unknown(),
  subscriptionId: z.string(),
  url: z.string().url().optional(),
  description: z.string().optional(),
  eventTypes: z.array(z.string()).min(1).optional(),
  format: z.enum(["JSON", "XML"]).optional(),
  active: z.boolean().optional(),
});

export const updateWebhookSubscriptionHandler = withMetrics(
  "update_webhook_subscription",
  async (args: z.infer<typeof UpdateWebhookSubscriptionInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "update_webhook_subscription",
    });

    try {
      const updateData: Record<string, unknown> = {};
      if (args.url !== undefined) updateData.url = args.url;
      if (args.description !== undefined)
        updateData.description = args.description;
      if (args.eventTypes !== undefined)
        updateData.eventTypes = args.eventTypes;
      if (args.format !== undefined) updateData.format = args.format;
      if (args.active !== undefined) updateData.active = args.active;

      const res = await bbClient.patch<BbWebhookSubscription>(
        `/webhooks/subscriptions/${args.subscriptionId}`,
        updateData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                subscription: {
                  id: res.data.id,
                  url: res.data.url,
                  description: res.data.description,
                  eventTypes: res.data.eventTypes,
                  format: res.data.format,
                  active: res.data.active,
                  createdDate: res.data.createdDate,
                  modifiedDate: res.data.modifiedDate,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch {
      // Webhook endpoint might not be available on all Blackboard instances
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  "Failed to update webhook subscription. Endpoint might not be available.",
                subscriptionId: args.subscriptionId,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

export const updateWebhookSubscriptionSchema = {
  name: "update_webhook_subscription",
  description:
    "Updates an existing webhook subscription. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      subscriptionId: {
        type: "string",
        description: "Webhook subscription ID",
      },
      url: {
        type: "string",
        description: "URL to receive webhook events (optional)",
        format: "uri",
      },
      description: {
        type: "string",
        description: "Description of the webhook subscription (optional)",
      },
      eventTypes: {
        type: "array",
        items: { type: "string" },
        description: "List of event types to subscribe to (optional)",
        minItems: 1,
      },
      format: {
        type: "string",
        enum: ["JSON", "XML"],
        description: "Format of webhook payload (optional)",
      },
      active: {
        type: "boolean",
        description: "Whether the subscription is active (optional)",
      },
    },
    required: ["caller_identity", "subscriptionId"],
  },
};

// ── delete_webhook_subscription ───────────────────────────────────────────
export const DeleteWebhookSubscriptionInput = z.object({
  caller_identity: z.unknown(),
  subscriptionId: z.string(),
});

export const deleteWebhookSubscriptionHandler = withMetrics(
  "delete_webhook_subscription",
  async (args: z.infer<typeof DeleteWebhookSubscriptionInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "delete_webhook_subscription",
    });

    try {
      await bbClient.delete(`/webhooks/subscriptions/${args.subscriptionId}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                subscriptionId: args.subscriptionId,
                message: "Webhook subscription deleted",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch {
      // Webhook endpoint might not be available on all Blackboard instances
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  "Failed to delete webhook subscription. Endpoint might not be available.",
                subscriptionId: args.subscriptionId,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

export const deleteWebhookSubscriptionSchema = {
  name: "delete_webhook_subscription",
  description:
    "Deletes a webhook subscription. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      subscriptionId: {
        type: "string",
        description: "Webhook subscription ID",
      },
    },
    required: ["caller_identity", "subscriptionId"],
  },
};
