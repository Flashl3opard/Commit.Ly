import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isDeliveryCompleted,
  markDeliveryCompleted,
  __resetDeliveryStoreForTests,
  __deliveryStoreSizeForTests,
  DELIVERY_TTL_MS_FOR_TESTS,
  MAX_ENTRIES_FOR_TESTS,
} from "./deliveryStore";

describe("delivery idempotency store", () => {
  beforeEach(() => {
    __resetDeliveryStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a new delivery id as not completed", () => {
    expect(isDeliveryCompleted("delivery-1")).toBe(false);
  });

  it("reports a delivery as completed after markDeliveryCompleted", () => {
    markDeliveryCompleted("delivery-1");
    expect(isDeliveryCompleted("delivery-1")).toBe(true);
  });

  it("treats different delivery ids independently", () => {
    markDeliveryCompleted("delivery-a");
    expect(isDeliveryCompleted("delivery-a")).toBe(true);
    expect(isDeliveryCompleted("delivery-b")).toBe(false);
  });

  it("does not mark a delivery completed just by checking it", () => {
    isDeliveryCompleted("delivery-1");
    isDeliveryCompleted("delivery-1");
    expect(isDeliveryCompleted("delivery-1")).toBe(false);
  });

  it("allows a delivery to be processed again after it expires", () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);

    markDeliveryCompleted("delivery-expiring");
    expect(isDeliveryCompleted("delivery-expiring")).toBe(true);

    vi.setSystemTime(start + DELIVERY_TTL_MS_FOR_TESTS + 1);

    expect(isDeliveryCompleted("delivery-expiring")).toBe(false);
  });

  it("bounds memory usage: does not grow past MAX_ENTRIES", () => {
    for (let i = 0; i < MAX_ENTRIES_FOR_TESTS + 50; i++) {
      markDeliveryCompleted(`delivery-${i}`);
    }
    expect(__deliveryStoreSizeForTests()).toBeLessThanOrEqual(MAX_ENTRIES_FOR_TESTS);
  });

  it("cleans expired entries out of the store", () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);

    markDeliveryCompleted("delivery-1");
    markDeliveryCompleted("delivery-2");
    expect(__deliveryStoreSizeForTests()).toBe(2);

    vi.setSystemTime(start + DELIVERY_TTL_MS_FOR_TESTS + 1);
    isDeliveryCompleted("delivery-3"); // triggers a sweep as a side effect

    expect(__deliveryStoreSizeForTests()).toBe(0);
  });
});
