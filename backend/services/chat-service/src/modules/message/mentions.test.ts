import { describe, it, expect, vi, afterEach } from "vitest";

const mockResolveMentionedMembers = vi.fn();

// RoomServiceClientError is redeclared inside the factory (rather than
// imported from roomServiceClient, even via vi.importActual) because that
// module reads INTERNAL_SERVICE_SECRET/ROOM_SERVICE_URL at import time —
// vi.mock factories are hoisted above everything else in the file, so no
// process.env assignment here could run first, and any top-level variable
// referenced from the factory hits the same hoisting restriction.
vi.mock("../room/roomServiceClient", () => {
  class RoomServiceClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    RoomServiceClientError,
    resolveMentionedMembers: (...args: unknown[]) => mockResolveMentionedMembers(...args),
  };
});

import { extractMentionCandidates, resolveMentions } from "./mentions";
import { RoomServiceClientError } from "../room/roomServiceClient";

const ROOM_ID = "11111111-1111-4111-8111-111111111111";

describe("extractMentionCandidates", () => {
  it("returns an empty array when there are no @ handles", () => {
    expect(extractMentionCandidates("just a normal message")).toEqual([]);
  });

  it("extracts a single @handle", () => {
    expect(extractMentionCandidates("hey @alice can you look at this")).toEqual(["alice"]);
  });

  it("extracts multiple distinct @handles", () => {
    expect(extractMentionCandidates("@alice and @bob please review")).toEqual(["alice", "bob"]);
  });

  it("de-duplicates repeated @handles", () => {
    expect(extractMentionCandidates("@alice ping @alice again")).toEqual(["alice"]);
  });

  it("allows dots, dashes, and underscores in a handle", () => {
    expect(extractMentionCandidates("@alice.smith @bob_jones @dev-1")).toEqual(["alice.smith", "bob_jones", "dev-1"]);
  });

  it("extracts the domain fragment from an email address as a candidate (not special-cased)", () => {
    // The parser doesn't special-case emails — "@example.com" is extracted
    // like any other handle. Per resolveMentions' contract, this simply
    // fails to resolve against real room members and is dropped there.
    expect(extractMentionCandidates("reach me at user@example.com")).toEqual(["example.com"]);
  });
});

describe("resolveMentions", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array without calling Room Service when there are no @ handles", async () => {
    const result = await resolveMentions(ROOM_ID, "no mentions here");
    expect(result).toEqual([]);
    expect(mockResolveMentionedMembers).not.toHaveBeenCalled();
  });

  it("returns the resolved user ids for candidates Room Service confirms are members", async () => {
    mockResolveMentionedMembers.mockResolvedValue([
      { userId: "user-1", username: "alice" },
      { userId: "user-2", username: "bob" },
    ]);

    const result = await resolveMentions(ROOM_ID, "@alice and @bob please review");

    expect(result).toEqual(["user-1", "user-2"]);
    expect(mockResolveMentionedMembers).toHaveBeenCalledWith(ROOM_ID, ["alice", "bob"]);
  });

  it("drops candidates Room Service doesn't confirm as members", async () => {
    mockResolveMentionedMembers.mockResolvedValue([{ userId: "user-1", username: "alice" }]);

    const result = await resolveMentions(ROOM_ID, "@alice @not-a-member");

    expect(result).toEqual(["user-1"]);
  });

  it("degrades to no mentions (does not throw) when Room Service is unreachable", async () => {
    mockResolveMentionedMembers.mockRejectedValue(new RoomServiceClientError("unreachable", 502));

    const result = await resolveMentions(ROOM_ID, "@alice");

    expect(result).toEqual([]);
  });

  it("re-throws an unexpected (non-RoomServiceClientError) error", async () => {
    mockResolveMentionedMembers.mockRejectedValue(new Error("boom"));

    await expect(resolveMentions(ROOM_ID, "@alice")).rejects.toThrow("boom");
  });
});
