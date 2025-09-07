import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { User } from "@/Interfaces/user/User";
import { JwtService } from "@/services/JwtService.ts";
import { UserService, userService } from "@/services/UserService.ts";
import { authService } from "@/services/AuthService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { GameMode } from "@/Interfaces/enums/GameMode.ts";
import { GameType } from "@/Interfaces/GameType.ts";
import { Friendship } from "@/Interfaces/types/Friendship.ts";
import { FriendshipService } from "@/services/FriendshipService.ts";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWebSocket } from "@/WebSocket/WebSocketContext";
import { chatService, ChatMessage } from "@/services/ChatService";
import {GameSession} from "@/Interfaces/types/GameSession.ts";
import {unknown} from "zod";

interface FriendsSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const FriendsSidebar: React.FC<FriendsSidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Friend list states
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Friendship[]>([]);
  const [loadingFriends, setLoadingFriends] = useState<boolean>(false);
  const [newFriendUsername, setNewFriendUsername] = useState<string>("");
  const [searchingUser, setSearchingUser] = useState<boolean>(false);
  const [showFriendList, setShowFriendList] = useState<boolean>(true);
  const [requestUsers, setRequestUsers] = useState<Map<string, User>>(new Map());
  const [friendSearchTerm, setFriendSearchTerm] = useState<string>("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [openChats, setOpenChats] = useState<Map<string, {
    id: string;
    username: string;
    messages: ChatMessage[];
    newMessage: string;
  }>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [friendGameStatuses, setFriendGameStatuses] = useState<Map<string, GameSession | null>>(new Map());
  const [loadingGameStatuses, setLoadingGameStatuses] = useState<boolean>(false);


  // Use refs to track current chat state for WebSocket handlers
  const currentChatState = useRef<{
    openChatIds: Set<string>;
  }>({
    openChatIds: new Set(),
  });

  const { client: stompClient, isConnected } = useWebSocket();

  console.log("FriendsSidebar render:", { isCollapsed, user, loading, isConnected });
  console.log("Open chats:", Array.from(openChats.entries()).map(([id, chat]) => ({ id, username: chat.username, messageCount: chat.messages.length })));

  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
      try {
        const token = JwtService.getToken();
        if (!token || JwtService.isTokenExpired(token)) {
          setLoading(false);
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (keycloakId) {
          const userData: User = await userService.getCurrentUser(keycloakId);
          setUser(userData);
          console.log("FriendsSidebar: User data fetched:", userData);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchFriendData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!stompClient || !isConnected || !user?.id) return;

    // Subscribe to friendship updates
    const friendshipSubscription = stompClient.subscribe(`/user/${user.id}/friendship`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log("Friendship update received:", data);

        // Refresh friend data when updates are received
        fetchFriendData();
      } catch (error) {
        console.error("Error parsing friendship message:", error);
      }
    });

    // Subscribe to chat messages
    console.log("Subscribing to chat messages at: /queue/chat." + user.id);
    const chatSubscription = stompClient.subscribe(`/queue/chat.${user.id}`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log("Chat message received:", data);
        console.log("Message body:", message.body);
        console.log("Parsed data:", data);

                  // Handle different message types
          if (data.type === 'CHAT_MESSAGE' || data.message || (data.senderId && data.receiverId)) {
            const chatMessage: ChatMessage = data;

            // Determine the friend's ID (the other person in the conversation)
            console.log("User object:", user);
            console.log("ChatMessage:", chatMessage);
            console.log("chatMessage.senderId:", chatMessage.senderId);
            console.log("chatMessage.receiverId:", chatMessage.receiverId);
            console.log("user.id:", user?.id);

            const friendId = chatMessage.senderId === user?.id ? chatMessage.receiverId : chatMessage.senderId;
            console.log("Processing message for friendId:", friendId);
            console.log("Open chat IDs:", Array.from(currentChatState.current.openChatIds));
            console.log("Is chat open?", currentChatState.current.openChatIds.has(friendId));

            // Only process if we have a valid friendId and user
            if (!friendId || !user?.id) {
              console.error("Invalid friendId or user:", { friendId, userId: user?.id });
              return;
            }

            // Add to chat messages if chat is open with this friend
            if (currentChatState.current.openChatIds.has(friendId)) {
              // Reload chat history from database to get the latest messages
              if (stompClient && user) {
                chatService.getChatHistory(stompClient, user.id, friendId);
              }
            } else {
              console.log("No messages found in chat history data");
            }

            // Update unread count for received messages (only if we're the receiver)
            if (chatMessage.receiverId === user.id) {
              setUnreadCounts(prev => {
                const newCounts = new Map(prev);
                const currentCount = newCounts.get(chatMessage.senderId) || 0;
                newCounts.set(chatMessage.senderId, currentCount + 1);
                return newCounts;
              });
            }
          }
      } catch (error) {
        console.error("Error parsing chat message:", error);
      }
    });

          // Subscribe to chat history responses
      console.log("Subscribing to chat history at: /queue/chat.history." + user.id);
      const chatHistorySubscription = stompClient.subscribe(`/queue/chat.history.${user.id}`, (message) => {
        try {
          const data = JSON.parse(message.body);
          console.log("Chat history received:", data);
          console.log("Data type:", typeof data);
          console.log("Is array:", Array.isArray(data));
          console.log("Has messages property:", data && typeof data === 'object' && 'messages' in data);

          // Handle both cases: data.messages array or data is directly an array
          let messages: ChatMessage[] = [];
          if (data.messages && Array.isArray(data.messages)) {
            messages = data.messages;
          } else if (Array.isArray(data)) {
            messages = data;
          }

          if (messages.length > 0) {
            console.log("Processing chat history:", messages.length, "messages");
            console.log("First message:", messages[0]);
            console.log("Current user ID:", user.id);

            const friendId = data.friendId || (messages.length > 0 ?
              (messages[0].senderId === user.id ? messages[0].receiverId : messages[0].senderId) : null);

            console.log("Calculated friendId:", friendId);
            console.log("Open chat IDs:", Array.from(currentChatState.current.openChatIds));
            console.log("Is friendId in open chats?", currentChatState.current.openChatIds.has(friendId));

            if (friendId && currentChatState.current.openChatIds.has(friendId)) {
                              setOpenChats(prev => {
                  const newChats = new Map(prev);
                  const existingChat = newChats.get(friendId);
                  console.log("Existing chat found:", !!existingChat);
                  if (existingChat) {
                    // Replace messages with fresh data from database
                    newChats.set(friendId, {
                      ...existingChat,
                      messages: messages
                    });
                    console.log("Updated chat with", messages.length, "messages");
                  } else {
                    console.log("No existing chat found for friendId:", friendId);
                  }
                  return newChats;
                });
            }
          }
        } catch (error) {
          console.error("Error parsing chat history:", error);
        }
      });

      return () => {
        try {
          if (stompClient?.connected) {
            friendshipSubscription?.unsubscribe();
            chatSubscription?.unsubscribe();
            chatHistorySubscription?.unsubscribe();
          }
        } catch (error) {
          console.error("Error unsubscribing from WebSocket:", error);
        }
      };
  }, [stompClient, isConnected, user?.id]);
  const checkFriendGameStatuses = async () => {
    if (friends.length === 0 ) return ;

    setLoadingGameStatuses(true);

    try{
      const gameStatusPromises = friends.map(async (friend) => {
        try {
          const activeGames = await gameSessionService.getActiveGamesForPlayer(friend.id);
          const activeGame = activeGames.length > 0 ? activeGames[0] : null ;
          return {friendId: friend.id, game: activeGame};

        } catch (error) {
          console.error(`Failed to get game status for friend ${friend.id}:`, error);
          return { friendId: friend.id, game: null };
        }
      });
      const results = await Promise.all(gameStatusPromises);
      const newStatuses = new Map<string,GameSession | null >()
      results.forEach(({ friendId, game }) => {
        newStatuses.set(friendId, game);
      });
      setFriendGameStatuses(newStatuses);
    }
    catch(error){
      console.error("Error parsing friend game status:", error);
    }
    finally {
      setLoadingGameStatuses(false);
    }
  }
  useEffect(() => {
    if (friends.length > 0)
    {
      checkFriendGameStatuses();

      const interval = setInterval(checkFriendGameStatuses, 3000);
      return () => clearInterval(interval);
    }
  }, [friends]);

  const handleSpectate = async (friendId : string) => {
    const game = friendGameStatuses.get(friendId);
    if (!game) {return null}
    try{
      gameSessionService.joinSpectate(game.gameId, user?.id || '');

      navigate(`/spectate/${game.gameId}`);

      const fren = await userService.getByUserId(friendId);
      toast({
        title: "Successfully joined the spectate",
        description: `Now You're Spectating ${fren.username}'s game `,
      })
    }
    catch(error){
      console.error("Error parsing friend game status:", error);
      toast({
        title: "Failed to Spectate",
        description: "Could not join spectate mode. The game might not allow spectators.",
        variant: "destructive",
      })
    }
  }

  const fetchFriendData = async (): Promise<void> => {
    if (!user?.id) return;

    setLoadingFriends(true);
    setFriendError(null);
    try {
      const friendshipService = new FriendshipService();

      // Fetch all friend-related data in parallel
      const [friendsData, pendingData, sentData, blockedData] = await Promise.all([
        friendshipService.getFriends(user.id),
        friendshipService.getPendingRequests(user.id),
        friendshipService.getSentRequests(user.id),
        friendshipService.getBlockedUsers(user.id)
      ]);

      // Process friends data (extract the other user from each friendship pair)
      const processedFriends: User[] = [];
      for (const friendPair of friendsData) {
        const otherFriend = friendPair.find(u => u.id !== user.id);
        if (otherFriend) {
          processedFriends.push(otherFriend);
        }
      }

      setFriends(processedFriends);
      setPendingRequests(pendingData);
      setSentRequests(sentData);
      setBlockedUsers(blockedData);

      // Fetch user details for pending and sent requests
      await fetchRequestUsers(pendingData, sentData);

      // Update last updated timestamp
      setLastUpdated(new Date());
    } catch (error) {
      const errorMessage = "Failed to fetch friend data. Please try again.";
      setFriendError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      console.error("Friend data fetch failed:", error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchRequestUsers = async (pending: Friendship[], sent: Friendship[]): Promise<void> => {
    const allUserIds = new Set<string>();
    pending.forEach(req => allUserIds.add(req.requesterId));
    sent.forEach(req => allUserIds.add(req.recipientId));

    const newRequestUsers = new Map<string, User>();

    for (const userId of allUserIds) {
      try {
        const userData = await userService.getByUserId(userId);
        newRequestUsers.set(userId, userData);
      } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
      }
    }

    setRequestUsers(newRequestUsers);
  };

  const sendFriendRequest = async (): Promise<void> => {
    if (!newFriendUsername.trim() || !user?.id) return;

    setSearchingUser(true);
    try {
      const friendshipService = new FriendshipService();
      const recipient = await userService.getUserByUsername(newFriendUsername.trim());

      if (recipient.id === user.id) {
        toast({ title: "Error", description: "You cannot send a friend request to yourself.", variant: "destructive" });
        return;
      }

      await friendshipService.sendFriendRequest(user.id, recipient.id);
      toast({ title: "Success", description: `Friend request sent to ${recipient.username}!` });
      setNewFriendUsername("");
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send friend request. Please try again.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      console.error("Friend request failed:", error);
    } finally {
      setSearchingUser(false);
    }
  };

  const acceptFriendRequest = async (friendshipId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.acceptFriendRequest(friendshipId);
      toast({ title: "Success", description: "Friend request accepted!" });
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to accept friend request.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const declineFriendRequest = async (friendshipId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.declineFriendRequest(friendshipId);
      toast({ title: "Success", description: "Friend request declined." });
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to decline friend request.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const cancelSentRequest = async (friendshipId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.declineFriendRequest(friendshipId);
      toast({ title: "Success", description: "Friend request cancelled." });
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to cancel friend request.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const removeFriend = async (friendId: string): Promise<void> => {
    if (!user?.id) return;

    try {
      const friendshipService = new FriendshipService();
      await friendshipService.removeFriend(user.id, friendId);
      toast({ title: "Success", description: "Friend removed." });
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to remove friend.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const blockUser = async (userId: string, userToBlockId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.blockUser(userId, userToBlockId);
      toast({ title: "Success", description: "User blocked." });
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to block user.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const unblockUser = async (userId: string, userToUnblockId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.unblockUser(userId, userToUnblockId);
      toast({ title: "Success", description: "User unblocked." });
      fetchFriendData();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to unblock user.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const openChat = (friendId: string, friendUsername: string): void => {
    console.log("Opening chat with:", friendId, friendUsername);

    // Add chat to open chats (always create new entry - messages will be loaded from database)
    setOpenChats(prev => {
      const newChats = new Map(prev);
      newChats.set(friendId, {
        id: friendId,
        username: friendUsername,
        messages: [], // Start with empty messages - will be loaded from database
        newMessage: ""
      });
      return newChats;
    });

    // Update the ref immediately for WebSocket handlers
    currentChatState.current.openChatIds.add(friendId);
    console.log("Current open chat IDs:", Array.from(currentChatState.current.openChatIds));

    // Clear unread count for this friend
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.set(friendId, 0);
      return newCounts;
    });

    // Always load fresh chat history from database
    if (stompClient && user) {
      console.log("Loading chat history from database for:", user.id, friendId);
      chatService.getChatHistory(stompClient, user.id, friendId);
    } else {
      console.log("Cannot load chat history - WebSocket not connected or user not available");
    }
  };

  const closeChat = (friendId: string): void => {
    // Remove chat from openChats since we're not storing messages locally anymore
    setOpenChats(prev => {
      const newChats = new Map(prev);
      newChats.delete(friendId);
      return newChats;
    });

    // Mark chat as closed
    currentChatState.current.openChatIds.delete(friendId);
    console.log("Chat closed:", friendId);
  };

  const sendMessage = (friendId: string): void => {
    const chat = openChats.get(friendId);
    if (!chat?.newMessage.trim() || !user || !stompClient) return;

    const messageText = chat.newMessage.trim();

    // Clear the message input immediately
    setOpenChats(prev => {
      const newChats = new Map(prev);
      const existingChat = newChats.get(friendId);
      if (existingChat) {
        newChats.set(friendId, {
          ...existingChat,
          newMessage: ""
        });
      }
      return newChats;
    });

    // Send message via WebSocket (database will be updated)
    chatService.sendMessage(
      stompClient,
      user.id,
      user.username,
      friendId,
      messageText
    );

    // Reload chat history to get the updated messages from database
    setTimeout(() => {
      if (stompClient && user) {
        chatService.getChatHistory(stompClient, user.id, friendId);
      }
    }, 100); // Small delay to ensure message is saved to database
  };

  const updateChatMessage = (friendId: string, message: string): void => {
    setOpenChats(prev => {
      const newChats = new Map(prev);
      const existingChat = newChats.get(friendId);
      if (existingChat) {
        newChats.set(friendId, {
          ...existingChat,
          newMessage: message
        });
      }
      return newChats;
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, friendId: string): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(friendId);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
  );

  // Don't render if user is not authenticated
  if (!user || loading) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-0 h-full w-12 bg-card/80 backdrop-blur-sm border-l border-border flex flex-col items-center py-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="mb-4 text-foreground hover:text-primary"
        >
          <span className="font-medieval text-lg">◀</span>
        </Button>

        {/* Friends count badge */}
        <div className="relative">
          <span className="font-medieval text-lg text-muted-foreground">👥</span>
          {friends.length > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center bg-primary text-primary-foreground"
            >
              {friends.length}
            </Badge>
          )}
        </div>

        {/* Pending requests indicator */}
        {pendingRequests.length > 0 && (
          <div className="relative mt-4">
            <span className="font-medieval text-lg text-orange-500">⏰</span>
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {pendingRequests.length}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="fixed right-0 top-0 h-full w-80 bg-card/80 backdrop-blur-sm border-l border-border z-50 flex flex-col">
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-lg font-medieval text-foreground flex items-center gap-2">
              <span className="text-xl">👥</span>
              Fellowship
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="text-foreground hover:text-primary"
            >
              <span className="font-medieval text-lg">▶</span>
            </Button>
          </div>

          {/* Friends Summary */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              {friends.length} companions
            </Badge>
            {pendingRequests.length > 0 && (
              <Badge variant="destructive">
                {pendingRequests.length} awaiting
              </Badge>
            )}
            {lastUpdated && (
              <span className="text-xs text-muted-foreground ml-auto font-elegant">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Add New Friend */}
          <div className="space-y-3 mb-4 flex-shrink-0">
            <h3 className="text-sm font-medieval text-foreground flex items-center gap-2">
              <span className="text-lg">➕</span>
              Summon Ally
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="Battle name"
                value={newFriendUsername}
                onChange={(e) => setNewFriendUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendFriendRequest()}
                className="text-sm h-8 bg-background/50 border-border focus:border-primary"
              />
              <Button
                onClick={sendFriendRequest}
                disabled={searchingUser || !newFriendUsername.trim()}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/80"
              >
                {searchingUser ? "..." : "Send"}
              </Button>
            </div>
          </div>

          <Separator className="my-4 bg-border flex-shrink-0" />

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3 mb-4 flex-shrink-0">
                <h3 className="text-sm font-medieval text-foreground flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  Awaiting Response ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((request) => {
                    const requester = requestUsers.get(request.requesterId) ||
                                    { username: "Unknown", id: request.requesterId, points: 0 } as User;
                    return (
                      <Card key={request.id} className="p-2 text-xs bg-secondary/50 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-xs">👤</span>
                            </div>
                            <span className="font-elegant truncate">{requester.username}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => acceptFriendRequest(request.id)}
                              className="h-6 px-2 bg-green-600 hover:bg-green-700"
                            >
                              <span className="text-xs">✓</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => declineFriendRequest(request.id)}
                              className="h-6 px-2 border-border"
                            >
                              <span className="text-xs">✕</span>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Friends */}
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-medieval text-foreground flex items-center gap-2">
                  <span className="text-lg">👥</span>
                  Fellowship ({friends.length})
                </h3>
                {friends.length > 0 && (
                  <Input
                    placeholder="Search..."
                    value={friendSearchTerm}
                    onChange={(e) => setFriendSearchTerm(e.target.value)}
                    className="w-24 text-xs h-7 bg-background/50 border-border"
                  />
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {loadingFriends ? (
                  <div className="text-center py-4 text-sm text-muted-foreground font-elegant">Summoning...</div>
                ) : friendError ? (
                  <div className="text-center py-4">
                    <div className="text-red-500 mb-2 text-xs font-elegant">{friendError}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchFriendData}
                      className="h-6 text-xs border-border"
                    >
                      Retry
                    </Button>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground font-elegant">
                    No companions yet
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto h-full pr-2">
                    {filteredFriends.map((friend) => {
                      const friendGame = friendGameStatuses.get(friend.id);
                      const isPlaying = friendGame && (friendGame.status === 'ACTIVE' || friendGame.status === 'WAITING_FOR_PLAYERS');
                      return (
                      <Card key={friend.id} className="p-2 text-xs bg-secondary/50 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-xs">👤</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-elegant truncate">{friend.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {
                                  isPlaying ? (
                                    <span className="text-green-500"> Playing </span>
                                  ) : (
                                    `${friend.points} PTS`
                                  )
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {isPlaying && (
                              <Button
                                size="sm"
                                onClick={() => handleSpectate(friend.id)}
                                className="h-6 px-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={loadingGameStatuses}
                              >
                                <span className="text-xs">👁️</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => openChat(friend.id, friend.username)}
                              className="h-6 px-2 bg-primary text-primary-foreground hover:bg-primary/80 relative"
                            >
                              <span className="text-xs">💬</span>
                              {unreadCounts.get(friend.id) > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                  {unreadCounts.get(friend.id)}
                                </span>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate("/profile", { state: { userId: friend.id } })}
                              className="h-6 px-2 border-border"
                            >
                              <span className="text-xs">👤</span>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )})}
                  </div>
                )}
              </div>
            </div>

            {/* Refresh Button */}
            <div className="mt-4 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchFriendData}
                disabled={loadingFriends}
                className="w-full h-8 text-xs border-border font-elegant"
              >
                <span className="text-xs mr-1">🔄</span>
                {loadingFriends ? "Summoning..." : "Refresh"}
              </Button>
            </div>
          </div>
        </div>
      </div>

                    {/* Chat Modals */}
       {Array.from(openChats.entries())
         .filter(([friendId]) => currentChatState.current.openChatIds.has(friendId))
         .map(([friendId, chat], index) => (
         <div
           key={friendId}
           className="fixed bottom-4 w-80 h-96 bg-card border border-border rounded-lg shadow-lg z-[60] flex flex-col"
           style={{
             bottom: '4px',
             right: `${320 + (index * 320)}px`
           }}
         >
           {/* Chat Header */}
           <div className="bg-primary text-primary-foreground p-3 rounded-t-lg flex items-center justify-between">
             <div className="flex items-center gap-2">
               <span className="text-lg">👤</span>
               <span className="font-medieval">{chat.username}</span>
             </div>
             <Button
               size="sm"
               variant="ghost"
               onClick={() => closeChat(friendId)}
               className="text-primary-foreground hover:bg-primary/80"
             >
               <span className="text-lg">✕</span>
             </Button>
           </div>

           {/* Chat Messages */}
           <div className="flex-1 p-3 overflow-y-auto space-y-2">
             {chat.messages.length === 0 ? (
               <div className="text-center text-muted-foreground mt-8">
                 <span className="text-3xl mb-2 block">💬</span>
                 <p className="font-elegant">No messages yet</p>
                 <p className="text-sm font-elegant">Begin your conversation!</p>
               </div>
             ) : (
               chat.messages.map((msg) => (
                 <div
                   key={msg.id}
                   className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                 >
                   <div
                     className={`max-w-xs px-3 py-2 rounded-lg ${
                       msg.senderId === user?.id
                         ? 'bg-primary text-primary-foreground'
                         : 'bg-muted text-muted-foreground'
                     }`}
                   >
                     <p className="text-sm font-elegant">{msg.message}</p>
                     <p className="text-xs opacity-70 mt-1 font-elegant">
                       {new Date(msg.timestamp).toLocaleTimeString()}
                     </p>
                   </div>
                 </div>
               ))
             )}
           </div>

           {/* Chat Input */}
           <div className="p-3 border-t border-border">
             <div className="flex gap-2">
               <Input
                 value={chat.newMessage}
                 onChange={(e) => updateChatMessage(friendId, e.target.value)}
                 onKeyPress={(e) => handleKeyPress(e, friendId)}
                 placeholder="Type your message..."
                 className="flex-1 bg-background/50 border-border focus:border-primary"
               />
               <Button
                 size="sm"
                 onClick={() => sendMessage(friendId)}
                 disabled={!chat.newMessage.trim()}
                 className="bg-primary text-primary-foreground hover:bg-primary/80"
               >
                 Send
               </Button>
             </div>
           </div>
         </div>
       ))}
    </>
  );
};

export default FriendsSidebar;
