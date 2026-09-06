import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("typingTracker", () => {
  const ROOM_A = "room-a";
  const USER_1 = "user-1";
  const USER_2 = "user-2";

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("startTyping returns true for a new typing state", async () => {
    const { startTyping } = await import("./typingTracker.js");
    const isNew = startTyping(ROOM_A, USER_1, () => {});
    expect(isNew).toBe(true);
  });

  it("startTyping returns false when refreshing an already-typing user", async () => {
    const { startTyping } = await import("./typingTracker.js");
    startTyping(ROOM_A, USER_1, () => {});
    const isNewSecondCall = startTyping(ROOM_A, USER_1, () => {});
    expect(isNewSecondCall).toBe(false);
  });

  it("isTyping reflects current state", async () => {
    const { startTyping, isTyping } = await import("./typingTracker.js");
    expect(isTyping(ROOM_A, USER_1)).toBe(false);
    startTyping(ROOM_A, USER_1, () => {});
    expect(isTyping(ROOM_A, USER_1)).toBe(true);
  });

  it("stopTyping returns true and clears state for an actively-typing user", async () => {
    const { startTyping, stopTyping, isTyping } = await import("./typingTracker.js");
    startTyping(ROOM_A, USER_1, () => {});
    const stopped = stopTyping(ROOM_A, USER_1);
    expect(stopped).toBe(true);
    expect(isTyping(ROOM_A, USER_1)).toBe(false);
  });

  it("stopTyping returns false for a user who was not typing", async () => {
    const { stopTyping } = await import("./typingTracker.js");
    expect(stopTyping(ROOM_A, USER_1)).toBe(false);
  });

  it("stopTyping cancels the pending auto-timeout so onTimeout never fires", async () => {
    const { startTyping, stopTyping } = await import("./typingTracker.js");
    const onTimeout = vi.fn();
    startTyping(ROOM_A, USER_1, onTimeout);
    stopTyping(ROOM_A, USER_1);

    vi.advanceTimersByTime(10_000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("auto-expires typing state after the timeout with no explicit stop", async () => {
    const { startTyping, isTyping } = await import("./typingTracker.js");
    const onTimeout = vi.fn();
    startTyping(ROOM_A, USER_1, onTimeout);

    vi.advanceTimersByTime(5001);

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(isTyping(ROOM_A, USER_1)).toBe(false);
  });

  it("refreshing typing state resets the timeout window", async () => {
    const { startTyping } = await import("./typingTracker.js");
    const onTimeout = vi.fn();
    startTyping(ROOM_A, USER_1, onTimeout);

    vi.advanceTimersByTime(3000);
    startTyping(ROOM_A, USER_1, onTimeout); // refresh before timeout
    vi.advanceTimersByTime(3000); // total 6000ms elapsed, but only 3000ms since refresh

    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2001); // now 5001ms since refresh
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("tracks multiple users independently", async () => {
    const { startTyping, isTyping } = await import("./typingTracker.js");
    startTyping(ROOM_A, USER_1, () => {});
    expect(isTyping(ROOM_A, USER_1)).toBe(true);
    expect(isTyping(ROOM_A, USER_2)).toBe(false);
  });

  it("clearAllTypingForUser clears state across all rooms and cancels timeouts", async () => {
    const { startTyping, clearAllTypingForUser, isTyping } = await import("./typingTracker.js");
    const onTimeoutUser1 = vi.fn();
    const onTimeoutUser2 = vi.fn();
    startTyping("room-a", USER_1, onTimeoutUser1);
    startTyping("room-b", USER_1, onTimeoutUser1);
    startTyping("room-a", USER_2, onTimeoutUser2); // different user, should be untouched

    const cleared = clearAllTypingForUser(USER_1);

    expect(cleared.map((c) => c.roomId).sort()).toEqual(["room-a", "room-b"]);
    expect(isTyping("room-a", USER_1)).toBe(false);
    expect(isTyping("room-b", USER_1)).toBe(false);
    expect(isTyping("room-a", USER_2)).toBe(true);

    vi.advanceTimersByTime(10_000);
    // USER_1's timers were cleared and must never fire; USER_2's own timer
    // was untouched and is expected to fire on its own schedule.
    expect(onTimeoutUser1).not.toHaveBeenCalled();
    expect(onTimeoutUser2).toHaveBeenCalledOnce();
  });

  it("clearAllTypingForUser is a safe no-op for a user with no typing state", async () => {
    const { clearAllTypingForUser } = await import("./typingTracker.js");
    expect(clearAllTypingForUser("nobody")).toEqual([]);
  });
});
