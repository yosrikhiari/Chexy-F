import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { GameControlsProps } from "@/Interfaces/GameControlsProps.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import { GameSession } from "@/Interfaces/types/GameSession.ts";
import { GameResult, PieceColor } from "@/Interfaces/types/chess.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import {JwtService} from "@/services/JwtService.ts";
import {userService} from "@/services/UserService.ts";
import {gameHistoryService} from "@/services/GameHistoryService.ts";

const GameControls: React.FC<GameControlsProps> = ({
                                                     onReset,
                                                     onFlipBoard,
                                                     onChangePlayerNames,
                                                     onResign,
                                                     gameState,
                                                     currentPlayer,
                                                   }) => {
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");
  const [open, setOpen] = useState(false);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);

  // Fetch game session and initial player names
  useEffect(() => {
    const fetchGameSession = async () => {
      if (!gameState?.gameSessionId) return;

      try {
        const session = await gameSessionService.getGameSession(
          gameState.gameSessionId
        );
        setGameSession(session);
        setPlayer1Name(session.whitePlayer.username || "Player 1");
        setPlayer2Name(session.blackPlayer.username || "Player 2");
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load game session.",
          variant: "destructive",
        });
      }
    };

    fetchGameSession();
  }, [gameState?.gameSessionId]);

  const handleSaveNames = async () => {
    if (!gameSession) {
      toast({
        title: "Error",
        description: "Game session not loaded.",
        variant: "destructive",
      });
      return;
    }

    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      // Update player usernames in backend
      const whitePlayerId = gameSession.whitePlayer.userId;
      const blackPlayerId = gameSession.blackPlayer.userId;

      if (player1Name && player1Name !== gameSession.whitePlayer.username) {
        await userService.updateUser(whitePlayerId, {
          username: player1Name,
        });
      }

      if (player2Name && player2Name !== gameSession.blackPlayer.username) {
        await userService.updateUser(blackPlayerId, {
          username: player2Name,
        });
      }

      // Update local state via prop
      if (onChangePlayerNames) {
        onChangePlayerNames({
          player1: player1Name || "Player 1",
          player2: player2Name || "Player 2",
        });
      }

      toast({
        title: "Success",
        description: "Player names updated.",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update player names.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    if (!gameState?.gameSessionId || !gameSession) {
      toast({
        title: "Error",
        description: "Game session not loaded.",
        variant: "destructive",
      });
      return;
    }

    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      // End current game session
      await gameSessionService.endGame(gameState.gameSessionId);

      // Create new game session
      const newSession = await gameSessionService.createGameSession(
        keycloakId,
        gameSession.gameMode,
        gameSession.isPrivate,
        gameSession.inviteCode
      );

      // Update local game state
      if (onReset) {
        onReset();
      }

      // Update game session
      setGameSession(newSession);
      setPlayer1Name(newSession.whitePlayer.username || "Player 1");
      setPlayer2Name(newSession.blackPlayer.username || "Player 2");

      toast({
        title: "Success",
        description: "New game started.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start new game.",
        variant: "destructive",
      });
    }
  };

  const handleResign = async () => {
    if (!gameState?.gameSessionId || !gameSession || !currentPlayer) {
      toast({
        title: "Error",
        description: "Game session or player not loaded.",
        variant: "destructive",
      });
      return;
    }

    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      // Determine winner (opponent)
      const winnerColor: PieceColor = currentPlayer === "white" ? "black" : "white";
      const winnerId =
        winnerColor === "white"
          ? gameSession.whitePlayer.userId
          : gameSession.blackPlayer.userId;

      // End game with winner
      await gameSessionService.endGame(gameState.gameSessionId, winnerId);

      // Update game history
      const gameResult: GameResult = {
        winner: winnerColor,
        winnerName: winnerColor === "white" ? player1Name : player2Name,
        pointsAwarded: gameSession.isRankedMatch ? 100 : 50, // Example points
        gameEndReason: "resignation",
        gameid: gameState.gameSessionId,
        winnerid: winnerId,
      };

      await gameHistoryService.completeGameHistory(
        gameSession.gameHistoryId,
        gameResult
      );

      // Notify parent component
      if (onResign) {
        onResign();
      }

      toast({
        title: "Game Ended",
        description: `${
          currentPlayer === "white" ? player1Name : player2Name
        } resigned. ${
          winnerColor === "white" ? player1Name : player2Name
        } wins!`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process resignation.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-3 justify-center mt-4">
      <Button
        onClick={handleReset}
        variant="outline"
        className="border-primary/50 hover:bg-primary/10"
      >
        New Game
      </Button>

      {onFlipBoard && (
        <Button
          onClick={onFlipBoard}
          variant="outline"
          className="border-primary/50 hover:bg-primary/10"
        >
          Flip Board
        </Button>
      )}

      {onChangePlayerNames && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="border-primary/50 hover:bg-primary/10"
            >
              Edit Players
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Player Names</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right col-span-1">White:</span>
                <Input
                  id="player1"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right col-span-1">Black:</span>
                <Input
                  id="player2"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveNames}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {onResign && (
        <Button
          onClick={handleResign}
          variant="destructive"
          className="hover:bg-destructive/90"
        >
          Resign
        </Button>
      )}
    </div>
  );
};

export default GameControls;
