import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // Add useLocation
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Gamepad2, UserPlus, Clock, Sword, Trophy, User as UserIcon } from "lucide-react";
import { friendshipService } from "@/services/FriendshipService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { useToast } from "@/hooks/use-toast";

const Lobby = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get location to access state
  const user = location.state?.user; // Access user from state
  const { toast } = useToast();
  const [stompClient, setStompClient] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recentOpponents, setRecentOpponents] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [inQueue, setInQueue] = useState(false);

  // Redirect to login if user is not available
  useEffect(() => {
    if (!user) {
      toast({ title: "Error", description: "Please log in to access the lobby.", variant: "destructive" });
      navigate("/login");
    }
  }, [user, navigate, toast]);

  useEffect(() => {
    if (!user) return; // Prevent running if user is undefined

    const socket = new SockJS('http://localhost:8081/ws');
    const client = Stomp.over(socket);
    client.connect({}, () => {
      setStompClient(client);
      client.subscribe('/user/queue/matchmaking/match', (message) => {
        const match = JSON.parse(message.body);
        navigate(`/game/${match.gameId}`, { state: { playerId: user.id, color: match.color } });
      });
      client.subscribe('/topic/matchmaking/status', (message) => {
        setQueueStatus({ playersInQueue: parseInt(message.body) });
      });
    });

    fetchLobbyData();

    return () => {
      if (client) client.disconnect();
    };
  }, [user]); // Depend on user

  const fetchLobbyData = async () => {
    try {
      const [games, friendsList, histories] = await Promise.all([
        gameSessionService.getAvailableGames(),
        friendshipService.getFriends(user.id),
        gameHistoryService.getGameHistoriesByUser(user.id)
      ]);
      setAvailableGames(games.filter(g => g.gameMode === "CLASSIC_MULTIPLAYER" && g.status === "WAITING_FOR_PLAYERS"));
      setFriends(friendsList);
      const opponents = histories.flatMap(h => h.userIds.filter(id => id !== user.id)).slice(0, 5);
      setRecentOpponents([...new Set(opponents)]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load lobby data", variant: "destructive" });
    }
  };

  const createGame = async (isPrivate) => {
    try {
      const session = await gameSessionService.createGameSession(user.id, "CLASSIC_MULTIPLAYER", isPrivate);
      if (isPrivate) {
        toast({ title: "Invite Code", description: `Share this code: ${session.inviteCode}` });
      } else {
        navigate(`/game/${session.gameId}`, { state: { playerId: user.id, color: "white" } });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create game", variant: "destructive" });
    }
  };

  const joinGame = async (gameId) => {
    try {
      const session = await gameSessionService.joinGame(gameId, user.id);
      navigate(`/game/${session.gameId}`, { state: { playerId: user.id, color: "black" } });
    } catch (error) {
      toast({ title: "Error", description: "Failed to join game", variant: "destructive" });
    }
  };

  const joinQueue = () => {
    if (!user) {
      toast({ title: "Error", description: "User not logged in", variant: "destructive" });
      navigate("/login");
      return;
    }
    if (stompClient) {
      stompClient.send('/app/matchmaking/join', {}, JSON.stringify({ userId: user.id, points: user.points }));
      setInQueue(true);
    }
  };

  const leaveQueue = () => {
    if (stompClient) {
      stompClient.send('/app/matchmaking/leave', {}, JSON.stringify({ userId: user.id }));
      setInQueue(false);
    }
  };

  if (!user) {
    return null; // Render nothing while redirecting
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
                    Players in queue: <span className="text-primary font-bold">{queueStatus?.playersInQueue || 0}</span>
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
                    {availableGames.map(game => (
                      <div key={game.gameId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                  {recentOpponents.map(opponent => (
                    <div key={opponent} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="hover:bg-primary/10"
          >
            ← Back to Game Selection
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
