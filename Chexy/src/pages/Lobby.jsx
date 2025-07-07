import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Gamepad2, Sword, Trophy, User as UserIcon, UserPlus, Users } from "lucide-react";
import { friendshipService } from "@/services/FriendshipService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { userService } from "@/services/UserService.ts";
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
    const subscriptions = [];

    try {
      subscriptions.push(
        client.subscribe("/topic/matchmaking/status", (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("Queue status updated:", data);
            setQueueStatus(data);
          } catch (error) {
            console.error("Error parsing queue status:", error);
          }
        })
      );

      subscriptions.push(
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
        })
      );

      subscriptions.push(
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
        })
      );

      subscriptions.push(
        client.subscribe(`/queue/matchmaking/matchCancelled/${user.id}`, (message) => {
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
        })
      );

      subscriptions.push(
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
        })
      );

      console.log("WebSocket subscriptions set up successfully");
    } catch (error) {
      console.error("Error setting up WebSocket subscriptions:", error);
    }

    return () => {
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
      subscriptions.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing:", error);
        }
      });
    };
  }, [user, navigate, toast, client, isConnected, inQueue]);

  // Fetch lobby data independently of WebSocket connection
  useEffect(() => {
    fetchLobbyData();
  }, [user]);

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

      const opponentIds = histories
        .flatMap(h => h.userIds.filter(id => id !== user.id))
        .slice(0, 5);

      const uniqueOpponentIds = [...new Set(opponentIds)]
        .filter(id => id !== "BOT" && id !== "bot" && !id.toLowerCase().includes("bot"));

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
    if (!client || !isConnected || inQueue || matchFoundData) {
      toast({
        title: "Error",
        description: inQueue ? "Already in queue" : !isConnected ? "Not connected to server" : "Match in progress",
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
    } catch (error) {
      console.error("Error joining queue:", error);
      toast({
        title: "Error",
        description: "Failed to join queue",
        variant: "destructive"
      });
    }
  };

  const leaveQueue = () => {
    if (!client || !isConnected) {
      return;
    }

    try {
      console.log("Leaving queue for user:", user.id);
      client.publish({
        destination: "/app/matchmaking/leave",
        body: JSON.stringify({ userId: user.id }),
      });
      setInQueue(false);
    } catch (error) {
      console.error("Error leaving queue:", error);
    }
  };

  const acceptMatch = () => {
    if (!client || !isConnected || !matchFoundData) {
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
    } catch (error) {
      console.error("Error accepting match:", error);
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
    } catch (error) {
      console.error("Error declining match:", error);
    }
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

              {!isConnected && (
                <div className="mt-4 text-sm text-orange-600">
                  Connecting to game server...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
          <Button variant="ghost" onClick={() => navigate(-1)} className="hover:bg-primary/10">
            ← Back to Game Selection
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
