import { chatRequest } from "./client";

export type SystemEventMetadata = {
  githubRepositoryId?: string;
  githubUsername?: string;
  branch?: string;
  baseBranch?: string;
  commitCount?: number;
  afterSha?: string;
  number?: number;
  title?: string;
  url?: string;
};

export type Message = {
  id: string;
  roomId: string;
  userId: string | null;
  senderType: "user" | "system";
  systemEventType: string | null;
  metadata: SystemEventMetadata | null;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type MessageHistoryPage = {
  messages: Message[];
  nextCursor: string | null;
};

export type ListMessagesParams = {
  limit?: number;
  before?: string;
};

export function getMessageHistory(roomId: string, params?: ListMessagesParams): Promise<MessageHistoryPage> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.before) query.set("before", params.before);
  const queryString = query.toString();

  return chatRequest<MessageHistoryPage>(
    `/rooms/${encodeURIComponent(roomId)}/messages${queryString ? `?${queryString}` : ""}`,
  );
}

export function sendMessage(roomId: string, content: string): Promise<{ message: Message }> {
  return chatRequest<{ message: Message }>(`/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST",
    body: { content },
  });
}

export function editMessage(messageId: string, content: string): Promise<{ message: Message }> {
  return chatRequest<{ message: Message }>(`/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: { content },
  });
}

export function deleteMessage(messageId: string): Promise<{ message: Message }> {
  return chatRequest<{ message: Message }>(`/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
}

export function searchMessages(roomId: string, query: string): Promise<{ messages: Message[] }> {
  return chatRequest<{ messages: Message[] }>(
    `/rooms/${encodeURIComponent(roomId)}/messages/search?q=${encodeURIComponent(query)}`,
  );
}
