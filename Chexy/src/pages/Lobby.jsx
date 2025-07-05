import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { friendshipService } from "@/services/FriendshipService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { useToast } from "@/hooks/use-toast";

const Lobby = ({ user }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stompClient, setStompClient] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recentOpponents, setRecentOpponents] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [inQueue, setInQueue] = useState(false);

  useEffect(() => {
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
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Multiplayer Lobby</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Games</CardTitle>
          </CardHeader>
          <CardContent>
            {availableGames.length === 0 ? (
              <p>No games available</p>
            ) : (
              availableGames.map(game => (
                <div key={game.gameId} className="flex justify-between mb-2">
                  <span>{game.whitePlayer.username}'s Game</span>
                  <Button onClick={() => joinGame(game.gameId)}>Join</Button>
                </div>
              ))
            )}
            <Button onClick={() => createGame(false)} className="mt-4">Create Public Game</Button>
            <Button onClick={() => createGame(true)} className="mt-2">Create Private Game</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Friends</CardTitle>
          </CardHeader>
          <CardContent>
            {friends.map(friend => (
              <div key={friend.id} className="flex justify-between mb-2">
                <span>{friend.recipientId === user.id ? friend.requesterId : friend.recipientId}</span>
                <Button onClick={() => createGame(true)}>Invite</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Opponents</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOpponents.map(opponent => (
              <div key={opponent} className="flex justify-between mb-2">
                <span>{opponent}</span>
                <Button onClick={() => createGame(true)}>Invite</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        {!inQueue ? (
          <Button onClick={joinQueue}>Join Matchmaking Queue</Button>
        ) : (
          <>
            <p>Waiting for match... Players in queue: {queueStatus?.playersInQueue || 0}</p>
            <Button onClick={leaveQueue} className="mt-2">Leave Queue</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Lobby;
