import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {Gamepad, Sword, Trophy, Check, User as UserIcon, Users, List, UserPlus, UserMinus, MessageSquare, X, CheckCircle, Clock, AlertCircle} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { User } from "@/Interfaces/user/User";
import { JwtService } from "@/services/JwtService.ts";
import {UserService, userService} from "@/services/UserService.ts";
import { authService } from "@/services/AuthService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { GameMode } from "@/Interfaces/enums/GameMode.ts";
import { GameType } from "@/Interfaces/GameType.ts";
import {Friendship} from "@/Interfaces/types/Friendship.ts";
import {FriendshipService} from "@/services/FriendshipService.ts";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWebSocket } from "@/WebSocket/WebSocketContext";
import { chatService, ChatMessage } from "@/services/ChatService";


const GameSelect: React.FC = () => {
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
  const [showFriendList, setShowFriendList] = useState<boolean>(false);
  const [requestUsers, setRequestUsers] = useState<Map<string, User>>(new Map());
  const [friendSearchTerm, setFriendSearchTerm] = useState<string>("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [selectedChatFriend, setSelectedChatFriend] = useState<{ id: string; username: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  
  // Use refs to track current chat state for WebSocket handlers
  const currentChatState = useRef<{
    isOpen: boolean;
    selectedFriendId: string | null;
  }>({
    isOpen: false,
    selectedFriendId: null,
  });
  
  const { client: stompClient, isConnected } = useWebSocket();

  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
      try {
        const token = JwtService.getToken();
        if (!token || JwtService.isTokenExpired(token)) {
          navigate("/login");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (keycloakId) {
          const userData: User = await userService.getCurrentUser(keycloakId);
          setUser(userData);
        } else {
          setUser({
            username: "Guest",
            points: 0,
            id: "",
            keycloakId: "",
            emailAddress: "",
            role: "USER",
            isActive: true,
          } as User);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        setUser({
          username: "Guest",
          points: 0,
          id: "",
          keycloakId: "",
          emailAddress: "",
          role: "USER",
          isActive: true,
        } as User);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [navigate]);

  // Fetch friend data when user is loaded
  useEffect(() => {
    if (user && user.id) {
      fetchFriendData();
    }
  }, [user]);

  // Keep the ref in sync with chat state
  useEffect(() => {
    currentChatState.current = {
      isOpen: chatOpen,
      selectedFriendId: selectedChatFriend?.id || null,
    };
  }, [chatOpen, selectedChatFriend]);

  // Filter friends based on search term
  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
  );

  // Subscribe to friendship updates and game invites via WebSocket
  useEffect(() => {
    if (!stompClient || !isConnected || !user?.id) return;

    const subscriptions: any[] = [];

    // Friendship updates subscription
    const friendshipDestination = `/queue/friendship/update/${user.id}`;
    const friendshipSubscription = stompClient.subscribe(friendshipDestination, async (msg) => {
      try {
        const payload = JSON.parse(msg.body);
        // For any friendship event, refresh friend-related data
        await fetchFriendData();
      } catch (e) {
        console.error("[Friendship WS] Failed to parse message:", e);
      }
    });
    subscriptions.push(friendshipSubscription);

    // Chat messages subscription
    const chatDestination = `/queue/chat/${user.id}`;
    const chatSubscription = stompClient.subscribe(chatDestination, (msg) => {
      try {
        const chatMessage: ChatMessage = JSON.parse(msg.body);
        console.log("[Chat WS] Received message:", chatMessage);
        
        // Add message to chat if it's between the current user and the selected friend
        if (currentChatState.current.isOpen && currentChatState.current.selectedFriendId && 
            ((chatMessage.senderId === user.id && chatMessage.receiverId === currentChatState.current.selectedFriendId) ||
             (chatMessage.senderId === currentChatState.current.selectedFriendId && chatMessage.receiverId === user.id))) {
          setChatMessages(prev => [...prev, chatMessage]);
        }
        
        // Update unread count for received messages
        if (chatMessage.receiverId === user.id) {
          const senderId = chatMessage.senderId;
          setUnreadCounts(prev => {
            const newCounts = new Map(prev);
            newCounts.set(senderId, (newCounts.get(senderId) || 0) + 1);
            return newCounts;
          });
        }
        
        // Show notification if chat is not open
        if (!currentChatState.current.isOpen || !currentChatState.current.selectedFriendId || 
            (chatMessage.senderId !== currentChatState.current.selectedFriendId && chatMessage.receiverId !== currentChatState.current.selectedFriendId)) {
          toast({
            title: `Message from ${chatMessage.senderName}`,
            description: chatMessage.message,
            duration: 5000,
          });
        }
      } catch (e) {
        console.error("[Chat WS] Failed to parse message:", e);
      }
    });
    subscriptions.push(chatSubscription);

    // Chat history subscription
    const chatHistoryDestination = `/queue/chat/history/${user.id}`;
    const chatHistorySubscription = stompClient.subscribe(chatHistoryDestination, (msg) => {
      try {
        const history: ChatMessage[] = JSON.parse(msg.body);
        console.log("[Chat History WS] Received history:", history);
        
        // Set chat history when opening a chat
        if (currentChatState.current.isOpen && currentChatState.current.selectedFriendId) {
          setChatMessages(history);
        }
      } catch (e) {
        console.error("[Chat History WS] Failed to parse message:", e);
      }
    });
    subscriptions.push(chatHistorySubscription);



    return () => {
      subscriptions.forEach(subscription => {
        try {
          subscription?.unsubscribe();
        } catch (e) {
          console.warn("[WebSocket] Unsubscribe error:", e);
        }
      });
    };
  }, [stompClient, isConnected, user?.id, toast]);

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
    const userIds = new Set<string>();

    // Collect all user IDs from pending and sent requests
    pending.forEach(req => userIds.add(req.requesterId));
    sent.forEach(req => userIds.add(req.recipientId));

    const usersMap = new Map<string, User>();

    // Fetch user details for each ID
    for (const userId of userIds) {
      try {
        const userData = await userService.getByUserId(userId);
        usersMap.set(userId, userData);
      } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
        // Create a placeholder user
        usersMap.set(userId, {
          id: userId,
          username: "Unknown User",
          points: 0,
          keycloakId: "",
          emailAddress: "",
          role: "USER",
          isActive: true,
        } as User);
      }
    }

    setRequestUsers(usersMap);
  };

  const sendFriendRequest = async (): Promise<void> => {
    if (!newFriendUsername.trim() || !user?.id) return;

    setSearchingUser(true);
    try {
      // First, find the user by username
      const targetUser = await userService.getUserByUsername(newFriendUsername.trim());
      if (!targetUser) {
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        return;
      }

      if (targetUser.id === user.id) {
        toast({ title: "Error", description: "Cannot send friend request to yourself.", variant: "destructive" });
        return;
      }

      // Check if already friends or request exists
      const friendshipService = new FriendshipService();
      const areAlreadyFriends = await friendshipService.areFriends(user.id, targetUser.id);
      if (areAlreadyFriends) {
        toast({ title: "Error", description: "You are already friends with this user.", variant: "destructive" });
        return;
      }

      // Send friend request
      await friendshipService.sendFriendRequest(user.id, targetUser.id);
      toast({ title: "Success", description: `Friend request sent to ${targetUser.username}!` });
      setNewFriendUsername("");

      // Refresh friend data
      await fetchFriendData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to send friend request.", variant: "destructive" });
      console.error("Send friend request failed:", error);
    } finally {
      setSearchingUser(false);
    }
  };

  const acceptFriendRequest = async (friendshipId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.acceptFriendRequest(friendshipId);
      toast({ title: "Success", description: "Friend request accepted!" });
      await fetchFriendData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to accept friend request.", variant: "destructive" });
      console.error("Accept friend request failed:", error);
    }
  };

  const declineFriendRequest = async (friendshipId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.declineFriendRequest(friendshipId);
      toast({ title: "Success", description: "Friend request declined." });
      await fetchFriendData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to decline friend request.", variant: "destructive" });
      console.error("Decline friend request failed:", error);
    }
  };

  const removeFriend = async (friendId: string): Promise<void> => {
    if (!user?.id) return;

    try {
      const friendshipService = new FriendshipService();
      await friendshipService.removeFriend(user.id, friendId);
      toast({ title: "Success", description: "Friend removed." });
      await fetchFriendData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove friend.", variant: "destructive" });
      console.error("Remove friend failed:", error);
    }
  };

  const cancelSentRequest = async (friendshipId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.declineFriendRequest(friendshipId);
      toast({ title: "Success", description: "Friend request cancelled." });
      await fetchFriendData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel friend request.", variant: "destructive" });
      console.error("Cancel friend request failed:", error);
    }
  };

  const unblockUser = async (userId: string, userToUnblockId: string): Promise<void> => {
    try {
      const friendshipService = new FriendshipService();
      await friendshipService.unblockUser(userId, userToUnblockId);
      toast({ title: "Success", description: "User unblocked successfully." });
      await fetchFriendData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to unblock user.", variant: "destructive" });
      console.error("Unblock user failed:", error);
    }
  };


  // Chat functions
  const openChat = (friendId: string, friendUsername: string): void => {
    // Set the selected friend first
    const selectedFriend = { id: friendId, username: friendUsername };
    setSelectedChatFriend(selectedFriend);
    setChatOpen(true);
    
    // Update the ref immediately for WebSocket handlers
    currentChatState.current = {
      isOpen: true,
      selectedFriendId: friendId,
    };
    
    // Clear previous messages when opening new chat
    setChatMessages([]);
    
    // Clear unread count for this friend
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.set(friendId, 0);
      return newCounts;
    });
    
    // Load chat history if WebSocket is connected
    if (stompClient && user) {
      chatService.getChatHistory(stompClient, user.id, friendId);
    }
  };

  const closeChat = (): void => {
    setChatOpen(false);
    setSelectedChatFriend(null);
    setChatMessages([]);
    
    // Update the ref
    currentChatState.current = {
      isOpen: false,
      selectedFriendId: null,
    };
  };

  const sendMessage = (): void => {
    if (!newMessage.trim() || !selectedChatFriend || !user || !stompClient) return;

    // Send message via WebSocket
    chatService.sendMessage(
      stompClient,
      user.id,
      user.username,
      selectedChatFriend.id,
      newMessage.trim()
    );

    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }





  const gameTypes: GameType[] = [
    {
      title: "RPG Adventure",
      description: "Embark on a cooperative roguelike chess journey",
      icon: <Gamepad className="h-8 w-8" />,
      comingSoon: false,
      path: "/rpg",
      isRanked: false,
      mode: "SINGLE_PLAYER_RPG" as GameMode,
    },
    {
      title: "Normal Match",
      description: "Play a standard game of chess against a bot",
      icon: <Sword className="h-8 w-8" />,
      comingSoon: false,
      path: "/bot-select",
      isRanked: false,
      mode: "CLASSIC_SINGLE_PLAYER" as GameMode,
    },
    {
      title: "Ranked Match",
      description: "Test your skills and climb the leaderboard",
      icon: <Trophy className="h-8 w-8" />,
      comingSoon: false,
      path: "/lobby",
      isRanked: true,
      mode: "CLASSIC_MULTIPLAYER" as GameMode,
    },
  ];

  const handleSelectGame = async (
    path: string,
    comingSoon: boolean,
    isRanked: boolean,
    mode: GameMode
  ): Promise<void> => {
    if (comingSoon) return;

    if (!user || !authService.isLoggedIn()) {
      toast({ title: "Error", description: "Please log in to start a game.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (path === "/bot-select") {
      navigate(path, { state: { user, isRanked, mode } });
    } else if (path === "/lobby") {
      navigate(path, { state: { user, isRanked, mode } });
    } else {
      try {
        const session = await gameSessionService.createGameSession(user.id, mode, isRanked);
        navigate(path, { state: { isRankedMatch: isRanked, gameId: session.gameId, playerId: user.id } });
      } catch (error) {
        toast({ title: "Error", description: "Failed to create game session.", variant: "destructive" });
        console.error("Game session creation failed:", error);
      }
    }
  };

  const handleLogout = (): void => {
    authService.logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-mystical-gradient p-4 pt-8 md:pt-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl text-primary mb-2 animate-float">
            Mystic Chess Arena
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome, {user?.username || "Guest"}! Select your adventure
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {gameTypes.map((game, index) => (
            <Card
              key={index}
              className={`cursor-pointer hover:border-primary/50 transition-all ${game.comingSoon ? "opacity-70" : ""}`}
              onClick={() => handleSelectGame(game.path, game.comingSoon, game.isRanked, game.mode)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    {game.icon}
                  </div>
                  {game.comingSoon && (
                    <span className="bg-secondary text-secondary-foreground text-xs py-1 px-2 rounded-md">
                      Coming Soon
                    </span>
                  )}
                </div>
                <CardTitle className="mt-4">{game.title}</CardTitle>
                <CardDescription>{game.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {!game.comingSoon && (
                  <div className="flex items-center text-sm text-primary">
                    <Check className="mr-1 h-4 w-4" /> Available now
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Friend List Section */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle>Friends</CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {friends.length} friends
                  </Badge>
                  {lastUpdated && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Last updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchFriendData}
                    disabled={loadingFriends}
                  >
                    <List className="h-4 w-4 mr-1" />
                    {loadingFriends ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFriendList(!showFriendList)}
                  >
                    {showFriendList ? "Hide" : "Show"} Friend List
                  </Button>
                </div>
              </div>
            </CardHeader>

            {showFriendList && (
              <CardContent className="space-y-6">
                {/* Add New Friend */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add New Friend
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter username"
                      value={newFriendUsername}
                      onChange={(e) => setNewFriendUsername(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendFriendRequest()}
                    />
                    <Button
                      onClick={sendFriendRequest}
                      disabled={searchingUser || !newFriendUsername.trim()}
                    >
                      {searchingUser ? "Sending..." : "Send Request"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Pending Friend Requests */}
                {pendingRequests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Pending Requests ({pendingRequests.length})
                    </h3>
                    <div className="grid gap-3">
                      {pendingRequests.map((request) => {
                        const requester = requestUsers.get(request.requesterId) ||
                                        { username: "Unknown User", id: request.requesterId, points: 0 } as User;
                        return (
                          <Card key={request.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserIcon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium">{requester.username}</p>
                                  <p className="text-sm text-muted-foreground">{requester.points} points</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => acceptFriendRequest(request.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => declineFriendRequest(request.id)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Decline
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sent Friend Requests */}
                {sentRequests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Sent Requests ({sentRequests.length})
                    </h3>
                    <div className="grid gap-3">
                      {sentRequests.map((request) => {
                        const recipient = requestUsers.get(request.recipientId) ||
                                        { username: "Unknown User", id: request.recipientId, points: 0 } as User;
                        return (
                          <Card key={request.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserIcon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium">{recipient.username}</p>
                                  <p className="text-sm text-muted-foreground">{recipient.points} points</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelSentRequest(request.id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Current Friends */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Current Friends ({friends.length})
                    </h3>
                    {friends.length > 0 && (
                      <Input
                        placeholder="Search friends..."
                        value={friendSearchTerm}
                        onChange={(e) => setFriendSearchTerm(e.target.value)}
                        className="w-48"
                      />
                    )}
                  </div>
                  {loadingFriends ? (
                    <div className="text-center py-4">Loading friends...</div>
                  ) : friendError ? (
                    <div className="text-center py-4">
                      <div className="text-red-500 mb-2">{friendError}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchFriendData}
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No friends yet. Send some friend requests to get started!
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredFriends.map((friend) => (
                        <Card key={friend.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p 
                                  className="font-medium cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => openChat(friend.id, friend.username)}
                                >
                                  {friend.username}
                                </p>
                                <p className="text-sm text-muted-foreground">{friend.points} points</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => openChat(friend.id, friend.username)}
                                className="bg-green-600 hover:bg-green-700 text-white relative"
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Chat
                                {unreadCounts.get(friend.id) > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {unreadCounts.get(friend.id)}
                                  </span>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate("/profile", { state: { userId: friend.id } })}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                <UserIcon className="h-4 w-4 mr-1" />
                                Profile
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFriend(friend.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {filteredFriends.length === 0 && friendSearchTerm && (
                        <div className="text-center py-4 text-muted-foreground">
                          No friends found matching "{friendSearchTerm}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Blocked Users */}
                {blockedUsers.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Blocked Users ({blockedUsers.length})
                    </h3>
                    <div className="grid gap-3">
                      {blockedUsers.map((block) => {
                        const blockedUser = requestUsers.get(block.recipientId) ||
                                          { username: "Unknown User", id: block.recipientId, points: 0 } as User;
                        return (
                          <Card key={block.id} className="p-3 bg-red-50 border-red-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                  <UserIcon className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{blockedUser.username}</p>
                                  <p className="text-sm text-muted-foreground">Blocked</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unblockUser(user.id, block.recipientId)}
                              >
                                Unblock
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        <div className="mt-10 flex flex-col items-center">
          <p className="text-muted-foreground">
            Your rank points: <span className="text-primary font-bold">{user?.points || 0}</span>
          </p>
          <div className="flex gap-4 mt-4I-4 mt-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
              <UserIcon className="h-4 w-4" /> Profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/leaderboard")}>
              <Users className="h-4 w-4" /> Leaderboard
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {chatOpen && selectedChatFriend && (
        <div className="fixed bottom-4 right-4 w-80 h-96 bg-white border border-gray-300 rounded-lg shadow-lg z-50 flex flex-col">
          {/* Chat Header */}
          <div className="bg-blue-600 text-white p-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span className="font-medium">{selectedChatFriend.username}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={closeChat}
              className="text-white hover:bg-blue-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                <p>No messages yet</p>
                <p className="text-sm">Start a conversation!</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${
                      msg.senderId === user?.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Chat Input */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameSelect;
