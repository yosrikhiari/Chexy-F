import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Gamepad2, Sword, Trophy, User as UserIcon, UserPlus, Users } from "lucide-react";
import { friendshipService } from "@/services/FriendshipService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { userService } from "@/services/UserService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/WebSocket/WebSocketContext.tsx";

const Lobby = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const user = location.state?.user || JSON.parse(localStorage.getItem("user"));
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

  // Refs to prevent multiple simultaneous requests
  const isLoadingLobbyData = useRef(false);
  const isLoadingQueueStatus = useRef(false);
  const lastQueueStatusFetch = useRef(0);
  const hasInitializedData = useRef(false);
  const hasInitializedQueue = useRef(false);

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
    const refreshUserData = async () => {
      try {
        const keycloakId = JwtService.getKeycloakId();
        if (keycloakId) {
          const updatedUser = await userService.getCurrentUser(keycloakId);
          localStorage.setItem("user", JSON.stringify(updatedUser));
          console.log("[DEBUG] User data refreshed in lobby:", updatedUser.points);
        }
      } catch (error) {
        console.error("Failed to refresh user data in lobby:", error);
        // Don't show toast as this is a background operation
      }
    };

    // Only refresh if we don't have fresh data
    const lastRefresh = localStorage.getItem("lastUserRefresh");
    const now = Date.now();
    if (!lastRefresh || (now - parseInt(lastRefresh)) > 30000) { // 30 seconds
      refreshUserData();
      localStorage.setItem("lastUserRefresh", now.toString());
    }
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
          navigate(`/game/${gameData.gameId}`, {
            state: {
              playerId: user.id,
              color: gameData.color,
              opponentId: gameData.opponentId
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
          state: { playerId: user.id, color: "white", opponentId: session.blackPlayer?.userId }
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
        state: { playerId: user.id, color: "black", opponentId: session.whitePlayer?.userId }
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
          points: user.points || 0
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
            <span className="text-muted-foreground">
              Your rank points: <span className="text-primary font-bold">{user?.points || 0}</span>
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

        {/* Loading Status */}
        {isLoading && (
          <div className="mb-6">
            <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
                  <Clock className="h-5 w-5 animate-pulse" />
                  <span>Loading lobby data...</span>
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
                    {availableGames.map((game) => (
                      <div
                        key={game.gameId}
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
                  <CardDescription>Challenge your friends</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No friends added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">
                          {friend.recipientId === user.id ? friend.requesterId : friend.recipientId}
                        </span>
                      </div>
                      <Button
                        onClick={() => createGame(true)}
                        size="sm"
                        variant="outline"
                        className="border-primary/50 hover:border-primary"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Invite
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
                  {recentOpponents.map((opponent) => (
                    <div
                      key={opponent.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{opponent.username}</span>
                      </div>
                      <Button
                        onClick={() => createGame(true)}
                        size="sm"
                        variant="outline"
                        className="border-primary/50 hover:border-primary"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Invite
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
    </div>
  );
};

export default Lobby;
