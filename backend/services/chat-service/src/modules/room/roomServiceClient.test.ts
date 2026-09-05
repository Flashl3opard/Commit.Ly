import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";

describe("getRoomMembership", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends the x-internal-service-secret header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ membership: { role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getRoomMembership } = await import("./roomServiceClient.js");
    await getRoomMembership("room-1", "user-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4003/internal/rooms/room-1/members/user-1",
      expect.objectContaining({
        headers: { "x-internal-service-secret": "test-internal-secret" },
      }),
    );
  });

  it("returns the membership on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ membership: { role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" } }),
    }) as unknown as typeof fetch;

    const { getRoomMembership } = await import("./roomServiceClient.js");
    const result = await getRoomMembership("room-1", "user-1");

    expect(result).toEqual({ role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" });
  });

  it("returns null when Room Service responds 404 (not a member)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: "Not a member of this room" }),
    }) as unknown as typeof fetch;

    const { getRoomMembership } = await import("./roomServiceClient.js");
    const result = await getRoomMembership("room-1", "user-1");

    expect(result).toBeNull();
  });

  it("throws RoomServiceClientError for a non-404 failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "Internal error" }),
    }) as unknown as typeof fetch;

    const { getRoomMembership, RoomServiceClientError } = await import("./roomServiceClient.js");
    await expect(getRoomMembership("room-1", "user-1")).rejects.toThrow(RoomServiceClientError);
  });
});
