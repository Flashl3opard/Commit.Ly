import { chatRequest } from "./client";

export type DmMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type DmConversation = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
  updatedAt: string;
};

export type DmConversationSummary = DmConversation & {
  otherUserId: string;
  lastMessage: DmMessage | null;
};

export type DmMessageHistoryPage = {
  messages: DmMessage[];
  nextCursor: string | null;
};

export type ListDmMessagesParams = {
  limit?: number;
  before?: string;
};

export function listConversations(): Promise<{ conversations: DmConversationSummary[] }> {
  return chatRequest<{ conversations: DmConversationSummary[] }>("/dm/conversations");
}

export function openConversation(userId: string): Promise<{ conversation: DmConversation }> {
  return chatRequest<{ conversation: DmConversation }>("/dm/conversations", {
    method: "POST",
    body: { userId },
  });
}

export function getDmMessageHistory(
  conversationId: string,
  params?: ListDmMessagesParams,
): Promise<DmMessageHistoryPage> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.before) query.set("before", params.before);
  const queryString = query.toString();

  return chatRequest<DmMessageHistoryPage>(
    `/dm/conversations/${encodeURIComponent(conversationId)}/messages${queryString ? `?${queryString}` : ""}`,
  );
}

export function sendDmMessage(conversationId: string, content: string): Promise<{ message: DmMessage }> {
  return chatRequest<{ message: DmMessage }>(`/dm/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: { content },
  });
}

export function editDmMessage(messageId: string, content: string): Promise<{ message: DmMessage }> {
  return chatRequest<{ message: DmMessage }>(`/dm/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: { content },
  });
}

export function deleteDmMessage(messageId: string): Promise<{ message: DmMessage }> {
  return chatRequest<{ message: DmMessage }>(`/dm/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
}
