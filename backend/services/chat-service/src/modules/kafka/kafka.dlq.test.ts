import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.KAFKA_BROKERS ??= "localhost:9092";

const mockSend = vi.fn().mockResolvedValue(undefined);
const mockConnectDlqProducer = vi.fn().mockResolvedValue({ send: mockSend });

vi.mock("./kafka.client", () => ({
  connectDlqProducer: () => mockConnectDlqProducer(),
}));

import { publishToDlq, type DlqRecord } from "./kafka.dlq";
import { kafkaConfig } from "./kafka.config";

function record(overrides: Partial<DlqRecord> = {}): DlqRecord {
  return {
    eventId: "event-uuid-1",
    eventType: "github.push",
    originalTopic: "github.events",
    errorClassification: "processing_failure",
    errorMessage: "Room Service unavailable",
    failedAt: "2026-09-11T10:00:00.000Z",
    originalPayload: '{"eventId":"event-uuid-1"}',
    ...overrides,
  };
}

describe("publishToDlq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(undefined);
    mockConnectDlqProducer.mockResolvedValue({ send: mockSend });
  });

  it("publishes to the configured DLQ topic", async () => {
    await publishToDlq(record());

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.topic).toBe(kafkaConfig.githubEventsDlqTopic);
    expect(call.topic).toBe("github.events.dlq");
  });

  it("retains enough metadata to diagnose the failure (eventId, eventType, originalTopic, classification, timestamp, payload)", async () => {
    await publishToDlq(record());

    const call = mockSend.mock.calls[0][0];
    const dlqRecord = JSON.parse(call.messages[0].value);
    expect(dlqRecord).toEqual({
      eventId: "event-uuid-1",
      eventType: "github.push",
      originalTopic: "github.events",
      errorClassification: "processing_failure",
      errorMessage: "Room Service unavailable",
      failedAt: "2026-09-11T10:00:00.000Z",
      originalPayload: '{"eventId":"event-uuid-1"}',
    });
  });

  it("retains the original payload even when eventId/eventType are unknown (malformed message case)", async () => {
    await publishToDlq(record({ eventId: null, eventType: null, errorClassification: "invalid_event", originalPayload: "not json at all" }));

    const call = mockSend.mock.calls[0][0];
    const dlqRecord = JSON.parse(call.messages[0].value);
    expect(dlqRecord.originalPayload).toBe("not json at all");
    expect(dlqRecord.eventId).toBeNull();
  });

  it("never throws even when the DLQ publish itself fails", async () => {
    mockSend.mockRejectedValue(new Error("DLQ broker unreachable"));

    await expect(publishToDlq(record())).resolves.toBeUndefined();
  });

  it("never throws when the DLQ producer cannot even connect", async () => {
    mockConnectDlqProducer.mockRejectedValue(new Error("Kafka is not configured"));

    await expect(publishToDlq(record())).resolves.toBeUndefined();
  });
});
