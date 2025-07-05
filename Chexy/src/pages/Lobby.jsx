import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Gamepad2, UserPlus, Clock, Sword, Trophy, User as UserIcon } from "lucide-react";
import { friendshipService } from "@/services/FriendshipService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { useToast } from "@/hooks/use-toast";

const Lobby = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user;
  const { toast } = useToast();

  const [stompClient, setStompClient] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recentOpponents, setRecentOpponents] = useState([]);
  const [queueStatus, setQueueStatus] = useState({ playersInQueue: 0 });
  const [inQueue, setInQueue] = useState(false);
  const [matchFoundData, setMatchFoundData] = useState(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [acceptanceTimeLeft, setAcceptanceTimeLeft] = useState(30);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const socket = new SockJS(`http://localhost:8081/ws?userId=${user.id}`);
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {},
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        console.log("Connected to WebSocket");
        setStompClient(client);

        // Subscribe to matchmaking status updates
        client.subscribe("/topic/matchmaking/status", (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("Queue status updated:", data);
            setQueueStatus(data);
          } catch (error) {
            console.error("Error parsing queue status:", error);
          }
        });

        // Subscribe to match found notifications
        client.subscribe(`/queue/matchmaking/matchFound/${user.id}`, (message) => {
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

        // Subscribe to game ready notifications
        client.subscribe(`/queue/matchmaking/gameReady/${user.id}`, (message) => {
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

        // Subscribe to match cancelled notifications
        client.subscribe(`/queue/matchmaking/matchCancelled/${user.id}`, (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("Match cancelled:", data);
            setShowAcceptDialog(false);
            setInQueue(false);
            toast({
              title: "Match Cancelled",
              description: data.message,
              variant: "destructive"
            });
          } catch (error) {
            console.error("Error parsing match cancelled data:", error);
          }
        });

        // Subscribe to error notifications
        client.subscribe(`/queue/matchmaking/error/${user.id}`, (message) => {
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
      },

      onStompError: (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to game server",
          variant: "destructive"
        });
      },

      onDisconnect: () => {
        console.log("Disconnected from WebSocket");
        setStompClient(null);
      }
    });

    client.activate();

    fetchLobbyData();

    return () => {
      if (client && client.connected) {
        if (inQueue) {
          client.publish({
            destination: "/app/matchmaking/leave",
            body: JSON.stringify({ userId: user.id }),
          });
        }
        client.deactivate();
      }
    };
  }, [user, navigate, toast]);

  const fetchLobbyData = async () => {
    try {
      const [games, friendsList, histories] = await Promise.all([
        gameSessionService.getAvailableGames(),
        friendshipService.getFriends(user.id),
        gameHistoryService.getGameHistoriesByUser(user.id),
      ]);

      setAvailableGames(games.filter(g =>
          g.gameMode === "CLASSIC_MULTIPLAYER" &&
          g.status === "WAITING_FOR_PLAYERS"
      ));
      setFriends(friendsList);

      const opponents = histories
          .flatMap(h => h.userIds.filter(id => id !== user.id))
          .slice(0, 5);
      setRecentOpponents([...new Set(opponents)]);
    } catch (error) {
      console.error("Error loading lobby data:", error);
      toast({
        title: "Error",
        description: "Failed to load lobby data",
        variant: "destructive"
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
            color: "white"
          }
        });
      }
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: "Error",
        description: "Failed to create game",
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
          color: "black"
        }
      });
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Error",
        description: "Failed to join game",
        variant: "destructive"
      });
    }
  };

  const joinQueue = () => {
    if (!stompClient?.connected) {
      toast({
        title: "Error",
        description: "Not connected to game server",
        variant: "destructive"
      });
      return;
    }

    console.log("Joining queue for user:", user.id);
    stompClient.publish({
      destination: "/app/matchmaking/join",
      body: JSON.stringify({
        userId: user.id,
        points: user.points || 0
      }),
    });
    setInQueue(true);
  };

  const leaveQueue = () => {
    if (!stompClient?.connected) {
      return;
    }

    console.log("Leaving queue for user:", user.id);
    stompClient.publish({
      destination: "/app/matchmaking/leave",
      body: JSON.stringify({ userId: user.id }),
    });
    setInQueue(false);
  };

  const acceptMatch = () => {
    if (!stompClient?.connected || !matchFoundData) {
      return;
    }

    console.log("Accepting match:", matchFoundData.matchId);
    stompClient.publish({
      destination: "/app/matchmaking/accept",
      body: JSON.stringify({
        matchId: matchFoundData.matchId,
        userId: user.id
      }),
    });
    setShowAcceptDialog(false);
  };

  const declineMatch = () => {
    if (!stompClient?.connected || !matchFoundData) {
      return;
    }

    console.log("Declining match:", matchFoundData.matchId);
    stompClient.publish({
      destination: "/app/matchmaking/decline",
      body: JSON.stringify({
        matchId: matchFoundData.matchId,
        userId: user.id
      }),
    });
    setShowAcceptDialog(false);
    setInQueue(false);
  };

  if (!user) {
    return null;
  }

  return (
      <div className="min-h-screen bg-mystical-gradient p-4 pt-8 md:pt-12">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
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

          {/* Match Found Dialog */}
          {showAcceptDialog && matchFoundData && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Card className="bg-white p-6 max-w-md w-full mx-4">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl text-green-600">Match Found!</CardTitle>
                    <CardDescription className="text-lg">
                      Opponent: {matchFoundData.opponentId}
                      <br />
                      Points: {matchFoundData.opponentPoints || 'Unknown'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 mb-2">
                        {acceptanceTimeLeft}s
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Time remaining to accept
                      </div>
                    </div>
                    <div className="flex justify-center space-x-4">
                      <Button
                          onClick={acceptMatch}
                          className="bg-green-500 hover:bg-green-600 text-white px-8"
                      >
                        Accept
                      </Button>
                      <Button
                          onClick={declineMatch}
                          variant="destructive"
                          className="px-8"
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
                        disabled={!stompClient?.connected}
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

                {!stompClient?.connected && (
                    <div className="mt-4 text-sm text-orange-600">
                      Connecting to game server...
                    </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
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
                                <span className="font-medium">{game.whitePlayer.username}'s Game</span>
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
                              key={opponent}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">{opponent}</span>
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

          {/* Back Button */}
          <div className="mt-8 text-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="hover:bg-primary/10">
              ← Back to Game Selection
            </Button>
          </div>
        </div>
      </div>
  );
};

export default Lobby;
