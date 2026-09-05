import { describe, it, expect, vi, afterEach } from "vitest";

const mockFindUniqueRoom = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    room: {
      findUnique: (...args: unknown[]) => mockFindUniqueRoom(...args),
    },
  },
}));

describe("generateUniqueRoomCode", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 6-digit numeric string", async () => {
    mockFindUniqueRoom.mockResolvedValue(null);
    const { generateUniqueRoomCode } = await import("./roomCode.js");

    const code = await generateUniqueRoomCode();

    expect(code).toMatch(/^\d{6}$/);
  });

  it("retries when a collision occurs, and returns the next unique candidate", async () => {
    mockFindUniqueRoom
      .mockResolvedValueOnce({ id: "existing-room" })
      .mockResolvedValueOnce(null);
    const { generateUniqueRoomCode } = await import("./roomCode.js");

    const code = await generateUniqueRoomCode();

    expect(code).toMatch(/^\d{6}$/);
    expect(mockFindUniqueRoom).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retry attempts on persistent collisions", async () => {
    mockFindUniqueRoom.mockResolvedValue({ id: "existing-room" });
    const { generateUniqueRoomCode } = await import("./roomCode.js");

    await expect(generateUniqueRoomCode()).rejects.toThrow();
  });
});
