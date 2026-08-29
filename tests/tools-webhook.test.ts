import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();

const bbClientMock = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: parseIdentityMock,
  checkAuthorization: checkAuthorizationMock,
}));

vi.mock("../src/bb-client.js", () => ({
  bbClient: bbClientMock,
}));

function parseToolText(result: any): any {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
  parseIdentityMock.mockImplementation((raw: unknown) => raw as any);
});

describe("webhook subscription tools", () => {
  it("list_webhook_subscriptions returns mapped subscriptions", async () => {
    const { listWebhookSubscriptionsHandler } =
      await import("../src/tools/webhook-tools.js");

    bbClientMock.get.mockResolvedValue({
      data: {
        results: [
          {
            id: "sub1",
            url: "https://example.com/hook",
            eventTypes: ["course.created"],
            format: "JSON",
            active: true,
            createdDate: "2026-01-01",
          },
        ],
      },
    });

    const result = await listWebhookSubscriptionsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 50,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.subscriptions[0].id).toBe("sub1");
  });

  it("list_webhook_subscriptions falls back when the endpoint is unavailable", async () => {
    const { listWebhookSubscriptionsHandler } =
      await import("../src/tools/webhook-tools.js");
    bbClientMock.get.mockRejectedValue(new Error("404"));

    const result = await listWebhookSubscriptionsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 50,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(0);
    expect(parsed.note).toContain("not available");
  });

  it("get_webhook_subscription returns a single subscription", async () => {
    const { getWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");

    bbClientMock.get.mockResolvedValue({
      data: {
        id: "sub1",
        url: "https://example.com/hook",
        eventTypes: ["grade.posted"],
        format: "JSON",
        active: true,
        createdDate: "2026-01-01",
      },
    });

    const result = await getWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      subscriptionId: "sub1",
    });

    const parsed = parseToolText(result);
    expect(parsed.subscription.id).toBe("sub1");
  });

  it("get_webhook_subscription reports an error when not found", async () => {
    const { getWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");
    bbClientMock.get.mockRejectedValue(new Error("404"));

    const result = await getWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      subscriptionId: "missing",
    });

    const parsed = parseToolText(result);
    expect(parsed.error).toContain("not found");
    expect(parsed.subscriptionId).toBe("missing");
  });

  it("create_webhook_subscription posts the new subscription", async () => {
    const { createWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");

    bbClientMock.post.mockResolvedValue({
      data: {
        id: "sub2",
        url: "https://example.com/hook2",
        eventTypes: ["course.created"],
        format: "JSON",
        active: true,
        createdDate: "2026-01-02",
      },
    });

    const result = await createWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      url: "https://example.com/hook2",
      eventTypes: ["course.created"],
      format: "JSON",
    });

    expect(bbClientMock.post).toHaveBeenCalledWith(
      "/webhooks/subscriptions",
      expect.objectContaining({ active: true }),
    );
    const parsed = parseToolText(result);
    expect(parsed.subscription.id).toBe("sub2");
  });

  it("create_webhook_subscription reports an error when creation fails", async () => {
    const { createWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");
    bbClientMock.post.mockRejectedValue(new Error("500"));

    const result = await createWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      url: "https://example.com/hook3",
      eventTypes: ["grade.posted"],
      format: "JSON",
    });

    const parsed = parseToolText(result);
    expect(parsed.error).toContain("Failed to create");
  });

  it("update_webhook_subscription sends only the provided fields", async () => {
    const { updateWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");

    bbClientMock.patch.mockResolvedValue({
      data: {
        id: "sub1",
        url: "https://example.com/new",
        eventTypes: ["course.created"],
        format: "JSON",
        active: false,
        createdDate: "2026-01-01",
        modifiedDate: "2026-01-03",
      },
    });

    const result = await updateWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      subscriptionId: "sub1",
      url: "https://example.com/new",
      active: false,
    });

    expect(bbClientMock.patch).toHaveBeenCalledWith(
      "/webhooks/subscriptions/sub1",
      { url: "https://example.com/new", active: false },
    );
    const parsed = parseToolText(result);
    expect(parsed.subscription.active).toBe(false);
  });

  it("update_webhook_subscription rejects a request with no mutable fields", async () => {
    const { updateWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");

    await expect(
      updateWebhookSubscriptionHandler({
        caller_identity: { userId: "admin-1", role: "admin" },
        subscriptionId: "sub1",
      }),
    ).rejects.toThrow(/requires at least one of/);

    expect(bbClientMock.patch).not.toHaveBeenCalled();
  });

  it("update_webhook_subscription reports an error when the update fails", async () => {
    const { updateWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");
    bbClientMock.patch.mockRejectedValue(new Error("500"));

    const result = await updateWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      subscriptionId: "sub1",
      description: "updated",
      eventTypes: ["grade.posted"],
      format: "XML",
    });

    const parsed = parseToolText(result);
    expect(parsed.error).toContain("Failed to update");
  });

  it("delete_webhook_subscription deletes the subscription", async () => {
    const { deleteWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");
    bbClientMock.delete.mockResolvedValue({ data: {} });

    const result = await deleteWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      subscriptionId: "sub1",
    });

    expect(bbClientMock.delete).toHaveBeenCalledWith(
      "/webhooks/subscriptions/sub1",
    );
    const parsed = parseToolText(result);
    expect(parsed.success).toBe(true);
  });

  it("delete_webhook_subscription reports an error when deletion fails", async () => {
    const { deleteWebhookSubscriptionHandler } =
      await import("../src/tools/webhook-tools.js");
    bbClientMock.delete.mockRejectedValue(new Error("500"));

    const result = await deleteWebhookSubscriptionHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      subscriptionId: "sub1",
    });

    const parsed = parseToolText(result);
    expect(parsed.error).toContain("Failed to delete");
  });
});
