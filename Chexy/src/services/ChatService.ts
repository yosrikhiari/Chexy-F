export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  message: string;
  timestamp: string | Date;
  isRead: boolean;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: ChatMessage;
  unreadCount: number;
}

class ChatService {
  private static instance: ChatService;

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  public sendMessage(
    stompClient: any,
    senderId: string,
    senderName: string,
    receiverId: string,
    message: string
  ): void {
    if (!stompClient) {
      console.error("WebSocket client not available");
      return;
    }

    // Send only the request data, not the full ChatMessage object
    const chatMessageRequest = {
      senderId,
      senderName,
      receiverId,
      message,
    };

    stompClient.publish({
      destination: "/app/chat/send",
      body: JSON.stringify(chatMessageRequest),
    });
  }

  public markAsRead(
    stompClient: any,
    messageId: string,
    userId: string
  ): void {
    if (!stompClient) {
      console.error("WebSocket client not available");
      return;
    }

    stompClient.publish({
      destination: "/app/chat/mark-read",
      body: JSON.stringify({
        messageId,
        userId,
      }),
    });
  }

  public getChatHistory(
    stompClient: any,
    userId1: string,
    userId2: string
  ): void {
    if (!stompClient) {
      console.error("WebSocket client not available");
      return;
    }

    stompClient.publish({
      destination: "/app/chat/history",
      body: JSON.stringify({
        userId1,
        userId2,
      }),
    });
  }
}

export const chatService = ChatService.getInstance();
