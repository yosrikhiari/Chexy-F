import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Gamepad2, Gamepad, Sword, Trophy, User as UserIcon, UserPlus, Users, RefreshCw, MessageSquare } from "lucide-react";
import { friendshipService } from "@/services/FriendshipService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { userService } from "@/services/UserService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/WebSocket/WebSocketContext.tsx";
import InviteModal from "@/components/InterfacesService/InviteModal.tsx";
import { gameInviteService } from "@/services/GameInviteService.ts";

const Lobby = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // FIX: Initialize user from localStorage but always refresh from server
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : location.state?.user;
  });

  // FIX: Add user points state that updates independently
  const [userPoints, setUserPoints] = useState(user?.points || 0);

  if (!user) {
    navigate("/login");
    return;
  }

  const { toast } = useToast();
  const { client, isConnected } = useWebSocket();

  const [availableGames, setAvailableGames] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recentOpponents, setRecentOpponents] = useState([]);
  const [queueStatus, setQueueStatus] = useState({ playersInQueue: 0 });
  const [inQueue, setInQueue] = useState(false);
  const [matchFoundData, setMatchFoundData] = useState(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [acceptanceTimeLeft, setAcceptanceTimeLeft] = useState(30);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [waitingForInviteResponse, setWaitingForInviteResponse] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);

  // Refs to prevent multiple simultaneous requests
  const isLoadingLobbyData = useRef(false);
  const isLoadingQueueStatus = useRef(false);
  const lastQueueStatusFetch = useRef(0);
  const hasInitializedData = useRef(false);
  const hasInitializedQueue = useRef(false);
  const isRefreshingUser = useRef(false); // FIX: Add ref to prevent multiple user refreshes

  // FIX: Add dedicated function to refresh user data and points
  const refreshUserData = useCallback(async () => {
    if (isRefreshingUser.current) {
      console.log("User data refresh already in progress, skipping...");
      return;
    }

    isRefreshingUser.current = true;

    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) {
        console.error("No keycloak ID available for user refresh");
        return;
      }

      console.log("[DEBUG] Refreshing user data in lobby...");
      const updatedUser = await userService.getCurrentUser(keycloakId);

      // Update both state and localStorage
      setUser(updatedUser);
      setUserPoints(updatedUser.points || 0);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      console.log("[DEBUG] User data refreshed in lobby:", {
        username: updatedUser.username,
        points: updatedUser.points,
        id: updatedUser.id
      });
    } catch (error) {
      console.error("Failed to refresh user data in lobby:", error);
      // Don't show toast for user data refresh failures in lobby
    } finally {
      isRefreshingUser.current = false;
    }
  }, []);

  // FIX: Always refresh user data when component mounts
  useEffect(() => {
    // Always refresh user data when entering lobby
    refreshUserData();
  }, []); // Run once on mount

  // FIX: Also refresh when explicitly requested
  useEffect(() => {
    if (location.state?.forceRefresh) {
      refreshUserData();
      // Clear the state to prevent future refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.forceRefresh, refreshUserData]);

  // Optimized queue status fetching with throttling - removed dependencies that cause re-renders
  const fetchQueueStatus = useCallback(async () => {
    const now = Date.now();

    // Throttle requests to maximum once every 5 seconds
    if (isLoadingQueueStatus.current || (now - lastQueueStatusFetch.current) < 5000) {
      return;
    }

    isLoadingQueueStatus.current = true;
    lastQueueStatusFetch.current = now;

    try {
      const baseUrl = import.meta.env.DEV ? 'http://localhost:8081' : '';

      const response = await fetch(`${baseUrl}/game-session/api/matchmaking/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${JwtService.getToken()}`,
          'Content-Type': 'application/json'
        },
        // Add request timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} error:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      console.log('Queue status data:', data);
      setQueueStatus(data);
    } catch (error) {
      console.error("Failed to fetch queue status:", error);

      // Only show toast for critical connection errors
      if (error.name === 'AbortError') {
        console.warn("Queue status request timed out");
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        // Only show toast if it's not already shown
        if (!document.querySelector('[data-sonner-toast]')) {
          toast({
            title: "Connection Error",
            description: "Failed to connect to matchmaking service. Please check your connection.",
            variant: "destructive"
          });
        }
      }

      setQueueStatus({ playersInQueue: 0 });
    } finally {
      isLoadingQueueStatus.current = false;
    }
  }, []); // Remove all dependencies to prevent re-creation

  // Optimized lobby data fetching - removed dependencies that cause re-renders
  const fetchLobbyData = useCallback(async () => {
    if (isLoadingLobbyData.current) {
      console.log("Lobby data fetch already in progress, skipping...");
      return;
    }

    isLoadingLobbyData.current = true;
    setIsLoading(true);
    setLoadingError(null);

    try {
      console.log("Starting lobby data fetch...");

      // Execute requests with error handling for each
      const results = await Promise.allSettled([
        gameSessionService.getAvailableGames(),
        friendshipService.getFriends(user.id),
        gameHistoryService.getGameHistoriesByUser(user.id),
      ]);

      // Handle available games
      if (results[0].status === 'fulfilled') {
        const games = results[0].value;
        setAvailableGames(games.filter(g =>
          g.gameMode === "CLASSIC_MULTIPLAYER" &&
          g.status === "WAITING_FOR_PLAYERS"
        ));
      } else {
        console.error("Failed to fetch available games:", results[0].reason);
        setAvailableGames([]);
      }

      // Handle friends
      if (results[1].status === 'fulfilled') {
        setFriends(results[1].value);
      } else {
        console.error("Failed to fetch friends:", results[1].reason);
        setFriends([]);
      }

      // Handle game histories and recent opponents
      if (results[2].status === 'fulfilled') {
        const histories = results[2].value;

        const opponentIds = histories
          .flatMap(h => h.userIds.filter(id => id !== user.id))
          .slice(0, 5);

        const uniqueOpponentIds = [...new Set(opponentIds)]
          .filter(id => id !== "BOT" && id !== "bot" && !id.toLowerCase().includes("bot"));

        // Fetch opponent details with individual error handling
        const opponentPromises = uniqueOpponentIds.map(async (opponentId) => {
          try {
            return await userService.getByUserId(opponentId);
          } catch (error) {
            console.error(`Error fetching user data for ID ${opponentId}:`, error);
            return { id: opponentId, username: `User ${opponentId}` };
          }
        });

        const opponents = await Promise.all(opponentPromises);
        setRecentOpponents(opponents);
      } else {
        console.error("Failed to fetch game histories:", results[2].reason);
        setRecentOpponents([]);
      }

      console.log("Lobby data fetch completed successfully");
    } catch (error) {
      console.error("Error loading lobby data:", error);
      setLoadingError(error.message);

      // Only show toast if it's not already shown
      if (!document.querySelector('[data-sonner-toast]')) {
        toast({
          title: "Error",
          description: "Failed to load some lobby data. Please try refreshing the page.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
      isLoadingLobbyData.current = false;
    }
  }, []); // Remove all dependencies to prevent re-creation

  useEffect(() => {
    // Override beforeunload to prevent reload warning in lobby
    const handleBeforeUnload = (e) => {
      // Don't show warning in lobby
      e.preventDefault();
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // WebSocket subscription setup - stabilized dependencies
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Wait for WebSocket connection before setting up subscriptions
    if (!client || !isConnected) {
      console.log("WebSocket not connected yet, waiting...");
      return;
    }

    console.log("Setting up WebSocket subscriptions...");
    const newSubscriptions = [];

    try {
      // Queue status subscription
      const queueStatusSub = client.subscribe("/topic/matchmaking/status", (message) => {
        try {
          const data = JSON.parse(message.body);
          console.log("Queue status updated:", data);
          setQueueStatus(data);
        } catch (error) {
          console.error("Error parsing queue status:", error);
        }
      });
      newSubscriptions.push(queueStatusSub);

      // Match found subscription
      const matchFoundSub = client.subscribe(`/queue/matchmaking/matchFound/${user.id}`, (message) => {
        try {
          const matchData = JSON.parse(message.body);
          console.log("Match found:", matchData);
          setMatchFoundData(matchData);
          setShowAcceptDialog(true);
          setAcceptanceTimeLeft(30);

          const timer = setInterval(() => {
            setAcceptanceTimeLeft((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                setShowAcceptDialog(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } catch (error) {
          console.error("Error parsing match found data:", error);
        }
      });
      newSubscriptions.push(matchFoundSub);

      // Game ready subscription
      const gameReadySub = client.subscribe(`/queue/matchmaking/gameReady/${user.id}`, (message) => {
        try {
          const gameData = JSON.parse(message.body);
          console.log("Game ready:", gameData);
          setInQueue(false);
          setShowAcceptDialog(false);

          // FIX: Add isRankedMatch: true for matchmaking games
          navigate(`/game/${gameData.gameId}`, {
            state: {
              playerId: user.id,
              color: gameData.color,
              opponentId: gameData.opponentId,
              isRankedMatch: true  // <-- ADD THIS LINE
            }
          });
        } catch (error) {
          console.error("Error parsing game ready data:", error);
        }
      });

      newSubscriptions.push(gameReadySub);

      // Match cancelled subscription
      const matchCancelledSub = client.subscribe(`/queue/matchmaking/matchCancelled/${user.id}`, (message) => {
        try {
          const data = JSON.parse(message.body);
          console.log("Match cancelled:", data);
          setShowAcceptDialog(false);

          if (data.leftQueue === true) {
            setInQueue(false);
            toast({
              title: "Match Cancelled",
              description: data.message,
              variant: "destructive"
            });
          } else if (data.leftQueue === false) {
            setInQueue(true);
            toast({
              title: "Match Cancelled",
              description: data.message,
              variant: "destructive"
            });
          } else {
            setInQueue(false);
            toast({
              title: "Match Cancelled",
              description: data.message,
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Error parsing match cancelled data:", error);
        }
      });
      newSubscriptions.push(matchCancelledSub);

      // Error subscription
      const errorSub = client.subscribe(`/queue/matchmaking/error/${user.id}`, (message) => {
        try {
          const data = JSON.parse(message.body);
          console.log("Matchmaking error:", data);
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive"
          });
        } catch (error) {
          console.error("Error parsing error data:", error);
        }
      });
      newSubscriptions.push(errorSub);

      // Game invite response subscription
      const gameInviteResponseSub = client.subscribe(`/queue/game-invite-response/${user.id}`, (message) => {
        try {
          const response = JSON.parse(message.body);
          console.log("Game invite response:", response);
          
          // Check if this is the response for our pending invite
          if (pendingInvite && response.id === pendingInvite.inviteId) {
            setWaitingForInviteResponse(false);
            setPendingInvite(null);
            
            if (response.status === "accepted") {
              toast({
                title: "Invite Accepted!",
                description: `${response.fromUsername} accepted your game invite!`,
              });
              
              // Create game session and navigate to game
              createGameSessionForInvite(response);
            } else if (response.status === "declined") {
              toast({
                title: "Invite Declined",
                description: `${response.fromUsername} declined your game invite.`,
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error("Error parsing game invite response:", error);
        }
      });
      newSubscriptions.push(gameInviteResponseSub);

      // Game invites subscription (for receiving invites)
      const gameInvitesSub = client.subscribe(`/queue/game-invites/${user.id}`, (message) => {
        try {
          const invite = JSON.parse(message.body);
          console.log("Game invite received:", invite);
          
          toast({
            title: "Game Invite",
            description: `${invite.fromUsername} invited you to play!`,
            duration: 10000,
          });
          
          // Show invite notification or handle it as needed
          // For now, just show a toast
        } catch (error) {
          console.error("Error parsing game invite:", error);
        }
      });
      newSubscriptions.push(gameInvitesSub);

      // Game ready subscription for invited players
      const gameReadyInviteSub = client.subscribe(`/queue/game-ready/${user.id}`, (message) => {
        try {
          const gameData = JSON.parse(message.body);
          console.log("Game ready for invite:", gameData);
          
          // Navigate to the game
          navigate(`/game/${gameData.gameId}`, {
            state: {
              playerId: user.id,
              color: "black",
              opponentId: gameData.inviterId,
              isRankedMatch: gameData.isRanked || false,
            },
          });
        } catch (error) {
          console.error("Error parsing game ready data:", error);
        }
      });
      newSubscriptions.push(gameReadyInviteSub);

      setSubscriptions(newSubscriptions);
      console.log("WebSocket subscriptions set up successfully");
    } catch (error) {
      console.error("Error setting up WebSocket subscriptions:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to matchmaking service",
        variant: "destructive"
      });
    }

    return () => {
      // Cleanup function
      if (inQueue && client && isConnected) {
        try {
          client.publish({
            destination: "/app/matchmaking/leave",
            body: JSON.stringify({ userId: user.id }),
          });
        } catch (error) {
          console.error("Error leaving queue on cleanup:", error);
        }
      }

      // Unsubscribe from all subscriptions
      newSubscriptions.forEach(sub => {
        try {
          if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe();
          }
        } catch (error) {
          console.error("Error unsubscribing:", error);
        }
      });
    };
  }, [client, isConnected, user.id, navigate]); // Keep only essential dependencies

  // Initial queue status fetch - use ref to prevent multiple calls
  useEffect(() => {
    if (hasInitializedQueue.current) return;

    const timer = setTimeout(() => {
      hasInitializedQueue.current = true;
      fetchQueueStatus();
    }, 2000);

    return () => clearTimeout(timer);
  }, []); // No dependencies

  // Initial lobby data fetch - use ref to prevent multiple calls
  useEffect(() => {
    if (hasInitializedData.current) return;

    const timer = setTimeout(() => {
      hasInitializedData.current = true;
      fetchLobbyData();
    }, 1000);

    return () => clearTimeout(timer);
  }, []); // No dependencies

  const openInviteModal = (friend) => {
    setSelectedFriend(friend);
    setInviteModalOpen(true);
  };

  const closeInviteModal = () => {
    setInviteModalOpen(false);
    setSelectedFriend(null);
  };

  const handleGameTypeSelection = async (gameType, mode, isRanked) => {
    if (!selectedFriend || !user?.id) return;

    setInviteModalOpen(false);
    
    try {
      // Generate invite ID that will be used by the service
      const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Send game invite via WebSocket
      gameInviteService.sendGameInvite(
        client,
        user.id,
        user.username,
        selectedFriend.id,
        mode,
        isRanked,
        gameType,
        inviteId
      );
      
      // Set waiting state
      setWaitingForInviteResponse(true);
      setPendingInvite({
        inviteId,
        friend: selectedFriend,
        gameType,
        mode,
        isRanked
      });
      
      toast({
        title: "Invite Sent",
        description: `Game invite sent to ${selectedFriend.username}!`,
      });
    } catch (error) {
      console.error("Failed to send game invite:", error);
      toast({
        title: "Error",
        description: "Failed to send game invite. Please try again.",
        variant: "destructive",
      });
    }
  };

  const createGameSessionForInvite = async (response) => {
    try {
      // Create game session based on the invite response
      const session = await gameSessionService.createGameSession(
        user.id,
        response.gameMode || "CLASSIC_MULTIPLAYER",
        response.isRanked || false
      );

      // Notify the invited player that the game is ready
      if (client && response.fromUserId) {
        client.publish({
          destination: "/app/game-ready/notify",
          body: JSON.stringify({
            gameId: session.gameId,
            inviterId: user.id,
            invitedId: response.fromUserId,
            gameMode: response.gameMode || "CLASSIC_MULTIPLAYER",
            isRanked: response.isRanked || false,
            gameType: response.gameType || "pvp-normal",
          }),
        });
      }

      // Navigate to the game
      navigate(`/game/${session.gameId}`, {
        state: {
          playerId: user.id,
          color: "white",
          opponentId: response.fromUserId,
          isRankedMatch: response.isRanked || false,
        },
      });
    } catch (error) {
      console.error("Failed to create game session for invite:", error);
      toast({
        title: "Error",
        description: "Failed to create game session",
        variant: "destructive",
      });
    }
  };

  const createGame = async (isPrivate) => {
    try {
      const session = await gameSessionService.createGameSession(
        user.id,
        "CLASSIC_MULTIPLAYER",
        isPrivate
      );

      if (isPrivate) {
        toast({
          title: "Private Game Created",
          description: `Share this code: ${session.inviteCode}`,
          duration: 10000
        });
      } else {
        navigate(`/game/${session.gameId}`, {
          state: {
            playerId: user.id,
            color: "white",
            opponentId: session.blackPlayer?.userId,
            isRankedMatch: !isPrivate  // <-- ADD THIS: public games are ranked
          }
        });
      }
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const joinGame = async (gameId) => {
    try {
      const session = await gameSessionService.joinGame(gameId, user.id);
      navigate(`/game/${session.gameId}`, {
        state: {
          playerId: user.id,
          color: "black",
          opponentId: session.whitePlayer?.userId,
          isRankedMatch: !session.isPrivate  // <-- ADD THIS: determine based on session
        }
      });
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Error",
        description: "Failed to join game. It may have already started.",
        variant: "destructive"
      });
    }
  };

  const joinQueue = () => {
    if (!client || !isConnected) {
      toast({
        title: "Connection Error",
        description: "Not connected to server. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    if (inQueue) {
      toast({
        title: "Already in Queue",
        description: "You are already in the matchmaking queue",
        variant: "destructive"
      });
      return;
    }

    if (matchFoundData) {
      toast({
        title: "Match in Progress",
        description: "You have a pending match request",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Joining queue for user:", user.id);
      client.publish({
        destination: "/app/matchmaking/join",
        body: JSON.stringify({
          userId: user.id,
          points: userPoints || 0 // FIX: Use userPoints state instead of user.points
        }),
      });
      setInQueue(true);
      toast({
        title: "Joined Queue",
        description: "Looking for opponents...",
      });
    } catch (error) {
      console.error("Error joining queue:", error);
      toast({
        title: "Error",
        description: "Failed to join queue. Please try again.",
        variant: "destructive"
      });
    }
  };

  const leaveQueue = () => {
    if (!client || !isConnected) {
      toast({
        title: "Connection Error",
        description: "Not connected to server",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Leaving queue for user:", user.id);
      client.publish({
        destination: "/app/matchmaking/leave",
        body: JSON.stringify({ userId: user.id }),
      });
      setInQueue(false);
      toast({
        title: "Left Queue",
        description: "You have left the matchmaking queue",
      });
    } catch (error) {
      console.error("Error leaving queue:", error);
      toast({
        title: "Error",
        description: "Failed to leave queue",
        variant: "destructive"
      });
    }
  };

  const acceptMatch = () => {
    if (!client || !isConnected || !matchFoundData) {
      toast({
        title: "Connection Error",
        description: "Cannot accept match at this time",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Accepting match:", matchFoundData.matchId);
      client.publish({
        destination: "/app/matchmaking/accept",
        body: JSON.stringify({
          matchId: matchFoundData.matchId,
          userId: user.id
        }),
      });
      setShowAcceptDialog(false);
      toast({
        title: "Match Accepted",
        description: "Waiting for opponent...",
      });
    } catch (error) {
      console.error("Error accepting match:", error);
      toast({
        title: "Error",
        description: "Failed to accept match",
        variant: "destructive"
      });
    }
  };

  const declineMatch = () => {
    if (!client || !isConnected || !matchFoundData) {
      return;
    }

    try {
      console.log("Declining match:", matchFoundData.matchId);
      client.publish({
        destination: "/app/matchmaking/decline",
        body: JSON.stringify({
          matchId: matchFoundData.matchId,
          userId: user.id
        }),
      });
      setShowAcceptDialog(false);
      setInQueue(false);
      setMatchFoundData(null);
      toast({
        title: "Match Declined",
        description: "You have declined the match",
      });
    } catch (error) {
      console.error("Error declining match:", error);
      toast({
        title: "Error",
        description: "Failed to decline match",
        variant: "destructive"
      });
    }
  };

  const handleBackToGameSelection = () => {
    // Navigate to a proper game selection screen instead of going back in history
    navigate("/game-select"); // or navigate("/game-modes") or whatever your main menu route is
  };

  // Manual refresh function for retry button
  const handleRetry = () => {
    hasInitializedData.current = false;
    fetchLobbyData();
    // FIX: Also refresh user data when retrying
    refreshUserData();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-mystical-gradient p-4 pt-8 md:pt-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl text-primary mb-2 animate-float">
            Multiplayer Arena
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome, {user?.username || "Guest"}! Find your perfect match
          </p>
          <div className="mt-4">
            <span className="text-muted-foreground flex justify-center items-center">
              Your rank points:&nbsp;<span className="text-primary font-bold flex items-center">
                {userPoints}<Trophy className="h-5 w-5 ml-1 text-primary" />
              </span>
            </span>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="mb-6">
            <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-900/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-2 text-orange-600 dark:text-orange-400">
                  <Clock className="h-5 w-5 animate-pulse" />
                  <span>Connecting to game server...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}



        {/* Error Status */}
        {loadingError && (
          <div className="mb-6">
            <Card className="border-red-500/50 bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-2 text-red-600 dark:text-red-400">
                  <span>Failed to load some data. Please try refreshing the page.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isLoading}
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Match Found Dialog */}
        {showAcceptDialog && matchFoundData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 shadow-lg max-w-md w-full mx-4 animate-float">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sword className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <CardTitle className="text-2xl text-primary">
                  Match Found!
                </CardTitle>
                <CardDescription>
                  Opponent: {matchFoundData.opponentPoints} points
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <div className="text-3xl font-bold text-primary">
                      {acceptanceTimeLeft}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    Time remaining to accept
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={acceptMatch}
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Trophy className="mr-2 h-5 w-5" />
                    Accept Challenge
                  </Button>
                  <Button
                    onClick={declineMatch}
                    size="lg"
                    variant="outline"
                    className="border-primary/50 hover:border-primary text-primary-foreground"
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Matchmaking Section */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Ranked Matchmaking</CardTitle>
              <CardDescription>Find opponents at your skill level</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {!inQueue ? (
                <Button
                  onClick={joinQueue}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!isConnected}
                >
                  <Sword className="mr-2 h-5 w-5" />
                  Join Matchmaking Queue
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="h-5 w-5 text-primary animate-pulse" />
                    <span className="text-lg">Searching for match...</span>
                  </div>
                  <p className="text-muted-foreground">
                    Players in queue: <span className="text-primary font-bold">{queueStatus.playersInQueue}</span>
                  </p>
                  <Button
                    onClick={leaveQueue}
                    variant="outline"
                    className="border-primary/50 hover:border-primary"
                  >
                    Leave Queue
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Waiting for Invite Response */}
        {waitingForInviteResponse && pendingInvite && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 border-blue-500/20">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="h-8 w-8 text-blue-500 animate-pulse" />
                </div>
                <CardTitle className="text-2xl text-blue-600">Waiting for Response</CardTitle>
                <CardDescription>
                  Waiting for {pendingInvite.friend.username} to respond to your game invite
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
                    <span className="text-lg text-blue-600">Waiting...</span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Game Type:</strong> {pendingInvite.gameType === 'rpg' ? 'RPG Adventure' : 
                        pendingInvite.gameType === 'pvp-ranked' ? 'Ranked PvP' : 'Normal PvP'}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Mode:</strong> {pendingInvite.isRanked ? 'Ranked' : 'Casual'}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      // TODO: Send cancel invite message via WebSocket
                      setWaitingForInviteResponse(false);
                      setPendingInvite(null);
                      toast({
                        title: "Invite Cancelled",
                        description: "Game invite has been cancelled",
                      });
                    }}
                    variant="outline"
                    className="border-blue-500/50 hover:border-blue-500 text-blue-600"
                  >
                    Cancel Invite
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Game Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Games */}
          <Card className="hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gamepad2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Available Games</CardTitle>
                  <CardDescription>Join ongoing matches</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableGames.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">No games available</p>
                  <div className="space-y-2">
                    <Button
                      onClick={() => createGame(false)}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      Create Public Game
                    </Button>
                    <Button
                      onClick={() => createGame(true)}
                      variant="outline"
                      className="w-full border-primary/50 hover:border-primary"
                    >
                      Create Private Game
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {availableGames.map((game, idx) => (
                      <div
                        key={game.gameId || `game-${idx}`}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{game.whitePlayer?.username || "Unknown"}'s Game</span>
                        </div>
                        <Button
                          onClick={() => joinGame(game.gameId)}
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                        >
                          Join
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Button
                      onClick={() => createGame(false)}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      Create Public Game
                    </Button>
                    <Button
                      onClick={() => createGame(true)}
                      variant="outline"
                      className="w-full border-primary/50 hover:border-primary"
                    >
                      Create Private Game
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Friends */}
          <Card className="hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Friends</CardTitle>
                  <CardDescription>Challenge your friends to a game</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">No friends added yet</p>
                  <Button
                    onClick={() => navigate("/game-select")}
                    variant="outline"
                    className="border-primary/50 hover:border-primary"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add Friends
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend, idx) => (
                    <div
                      key={(friend.requesterId === user.id ? friend.recipientId : friend.requesterId) || `${friend.requesterId || 'req'}-${friend.recipientId || 'rec'}-${idx}`}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium text-sm">
                            {friend.recipientId === user.id ? friend.requesterId : friend.recipientId}
                          </span>
                          <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => openInviteModal(friend)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Gamepad className="h-4 w-4 mr-1" />
                        Invite to Game
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Opponents */}
          <Card className="hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Recent Opponents</CardTitle>
                  <CardDescription>Rematch previous players</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentOpponents.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No recent matches</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOpponents.map((opponent, idx) => (
                    <div
                      key={opponent.id || `${opponent.username || 'user'}-${opponent.userId || 'id'}-${idx}`}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium text-sm">{opponent.username}</span>
                          <p className="text-xs text-muted-foreground">Previous opponent</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => openInviteModal(opponent)}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Sword className="h-4 w-4 mr-1" />
                        Rematch
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            onClick={handleBackToGameSelection}
            className="hover:bg-primary/10"
          >
            ← Back to Main Menu
          </Button>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal
        open={inviteModalOpen}
        onClose={closeInviteModal}
        onSelectGameType={handleGameTypeSelection}
        friendName={selectedFriend?.username || ""}
      />
    </div>
  );
};

export default Lobby;
