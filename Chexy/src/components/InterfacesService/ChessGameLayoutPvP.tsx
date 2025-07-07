import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GameControls from "./GameControls.tsx";
import PlayerInfo from "./PlayerInfo.tsx";
import ChessTimer from "./ChessTimer.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { PieceColor, GameTimers, GameState, GameResult, PlayerStats, PieceType, BoardPosition } from "@/Interfaces/types/chess.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import {UserService, userService} from "@/services/UserService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { authService } from "@/services/AuthService.ts";
import ChessBoardPvP from "@/components/InterfacesService/PvPChessBoard.tsx";

interface ChessGameLayoutPvPProps {
  className?: string;
  isRankedMatch?: boolean;
}

type ExtendedPlayerAction = {
  gameId: string;
  playerId: string;
  actionType: "move" | "capture";
  from: [number, number];
  to: [number, number];
  timestamp: number;
  sequenceNumber: number;
  pieceType: PieceType;
  resultsInCheck?: boolean;
  resultsInCheckmate?: boolean;
  resultsInStalemate?: boolean;
};

const ChessGameLayoutPvP: React.FC<ChessGameLayoutPvPProps> = ({
                                                                 className = "",
                                                                 isRankedMatch = false,
                                                               }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white");
  const [gameState, setGameState] = useState<GameState>({
    isDraw: false,
    gameSessionId: gameId || "",
    userId1: "",
    userId2: "",
    isCheck: false,
    isCheckmate: false,
    checkedPlayer: null,
    enPassantTarget: null,
    currentTurn: "white",
    moveCount: 0,
    canWhiteCastleKingSide: true,
    canWhiteCastleQueenSide: true,
    canBlackCastleKingSide: true,
    canBlackCastleQueenSide: true,
  });
  const [timers, setTimers] = useState<GameTimers | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  }>({
    white: { playerId: "", name: "White", points: 0 },
    black: { playerId: "", name: "Black", points: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [localMoveHistory, setLocalMoveHistory] = useState<ExtendedPlayerAction[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerColor, setPlayerColor] = useState<PieceColor>("white");
  const [flipped, setFlipped] = useState(false);

  const moveToAlgebraicNotation = (action: ExtendedPlayerAction): string => {
    const pieceMap: { [key: string]: string } = {
      king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", pawn: "",
    };
    const fromCol = String.fromCharCode(97 + action.from[1]);
    const toCol = String.fromCharCode(97 + action.to[1]);
    const toRow = 8 - action.to[0];
    const pieceType = action.pieceType || "pawn";
    const isCapture = action.actionType === "capture";
    let notation = pieceType === "pawn" && isCapture ? `${fromCol}x${toCol}${toRow}` : `${pieceMap[pieceType]}${isCapture ? "x" : ""}${toCol}${toRow}`;
    if (action.resultsInCheckmate) notation += "#";
    else if (action.resultsInCheck) notation += "+";
    else if (action.resultsInStalemate) notation += " (stalemate)";
    return notation;
  };

  useEffect(() => {
    const initializeGame = async () => {
      try {

        let session;
        let retries = 0;
        const maxRetries = 5;

        while (retries < maxRetries) {
          session = await gameSessionService.getGameSession(gameId);
          if (session.gameState) {
            break;
          }
          console.warn(`Game state null for gameId: ${gameId}, retrying (${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          retries++;
        }

        if (!session.gameState) {
          throw new Error("Game state not initialized after multiple attempts");
        }

        const myColor = session.whitePlayer.userId === (await userService.getCurrentUser(JwtService.getKeycloakId())).id ? "white" : "black";
        setPlayerColor(myColor);
        setFlipped(myColor === "black");
        setGameState({
          ...session.gameState,
          gameSessionId: gameId,
          userId1: session.whitePlayer.userId,
          userId2: session.blackPlayer.userId,
        });
        setCurrentPlayer(session.gameState.currentTurn);
        setPlayerStats({
          white: { playerId: session.whitePlayer.userId, name: session.whitePlayer.username || "White", points: 0 },
          black: { playerId: session.blackPlayer.userId, name: session.blackPlayer.username || "Black", points: 0 },
        });
        setTimers({
          white: { timeLeft: session.timers?.white?.timeLeft ?? 600, active: session.gameState.currentTurn === "white" },
          black: { timeLeft: session.timers?.black?.timeLeft ?? 600, active: session.gameState.currentTurn === "black" },
          defaultTime: session.timers?.defaultTime ?? 600,
        });
      } catch (error) {
        console.error("Error initializing game:", error);
        toast({ title: "Error", description: "Failed to load game.", variant: "destructive" });
        navigate("/lobby");
      } finally {
        setIsLoading(false);
      }
    };
    initializeGame();
  }, [gameId, navigate]);

  const handleGameEnd = (result: GameResult) => {
    setGameResult(result);
    setIsModalOpen(true);
    setIsGameOver(true);
    setTimers((prev) => prev && ({
      ...prev,
      white: { ...prev.white, active: false },
      black: { ...prev.black, active: false },
    }));
  };

  const resetGame = () => {
    navigate("/lobby");
  };

  const handlePlayerChange = (color: PieceColor) => {
    setCurrentPlayer(color);
    if (!isGameOver && timers) {
      setTimers({
        ...timers,
        white: { ...timers.white, active: color === "white" },
        black: { ...timers.black, active: color === "black" },
      });
    }
  };

  const handleMoveMade = (move: {
    from: BoardPosition;
    to: BoardPosition;
    actionType: "move" | "capture";
    pieceType: PieceType;
  }) => {
    const newAction: ExtendedPlayerAction = {
      gameId: gameState.gameSessionId,
      playerId: currentPlayer === "white" ? gameState.userId1 : gameState.userId2,
      actionType: move.actionType,
      from: [move.from.row, move.from.col],
      to: [move.to.row, move.to.col],
      timestamp: Date.now(),
      sequenceNumber: localMoveHistory.length + 1,
      pieceType: move.pieceType,
    };
    setLocalMoveHistory(prev => [...prev, newAction]);
  };



  if (isLoading || !timers) {
    return <div className="text-center p-4">Loading game...</div>;
  }

  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <div className="flex flex-col-reverse md:flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PlayerInfo
                name={playerStats.black.name}
                points={playerStats.black.points}
                color="black"
                isCurrentPlayer={currentPlayer === "black"}
              />
              <ChessTimer
                timers={timers}
                setTimers={setTimers}
                currentPlayer={currentPlayer}
                isGameOver={isGameOver}
                onTimeout={(color) => {
                  const winner = color === "white" ? "black" : "white";
                  handleGameEnd({
                    winner,
                    winnerName: winner === "white" ? playerStats.white.name : playerStats.black.name,
                    pointsAwarded: isRankedMatch ? 15 : 0,
                    gameEndReason: "timeout",
                    gameid: gameState.gameSessionId,
                    winnerid: winner === "white" ? gameState.userId1 : gameState.userId2,
                  });
                }}
                gameId={gameId}
                playerId={playerId}
              />
              <PlayerInfo
                name={playerStats.white.name}
                points={playerStats.white.points}
                color="white"
                isCurrentPlayer={currentPlayer === "white"}
              />
            </div>

            <ChessBoardPvP
              flipped={flipped}
              currentPlayer={currentPlayer}
              onMove={handlePlayerChange}
              onGameEnd={handleGameEnd}
              gameState={gameState}
              onGameStateChange={setGameState}
              playerColor={playerColor}
              timers={timers}
              onTimeUpdate={setTimers}
              onTimeout={(color) => {
                const winner = color === "white" ? "black" : "white";
                handleGameEnd({
                  winner,
                  winnerName: winner === "white" ? playerStats.white.name : playerStats.black.name,
                  pointsAwarded: isRankedMatch ? 15 : 0,
                  gameEndReason: "timeout",
                  gameid: gameState.gameSessionId,
                  winnerid: winner === "white" ? gameState.userId1 : gameState.userId2,
                });
              }}
              player1Name={playerStats.white.name}
              player2Name={playerStats.black.name}
              onResetGame={resetGame}
              onMoveMade={handleMoveMade}
            />

            <GameControls
              onResign={() => {
                const winner = currentPlayer === "white" ? "black" : "white";
                handleGameEnd({
                  winner,
                  winnerName: winner === "white" ? playerStats.white.name : playerStats.black.name,
                  pointsAwarded: isRankedMatch ? 10 : 0,
                  gameEndReason: "resignation",
                  gameid: gameState.gameSessionId,
                  winnerid: winner === "white" ? gameState.userId1 : gameState.userId2,
                });
              }}
              onReset={resetGame}
              gameState={gameState}
              currentPlayer={currentPlayer}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-muted p-4 rounded-lg h-full">
            <h3 className="font-bold text-xl mb-4">Game Info</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Game Type</h4>
                <p className="text-sm bg-primary/10 text-primary font-medium px-2 py-1 rounded inline-block">
                  {isRankedMatch ? "Ranked Match" : "Normal Match"}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Current Turn</h4>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${currentPlayer === "white" ? "bg-white border border-black/20" : "bg-black"}`}></div>
                  <span className="capitalize">{currentPlayer}</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">Game Status</h4>
                <div>
                  {isGameOver ? (
                    <p className="text-red-600 font-medium">Game Over</p>
                  ) : gameState.isCheck ? (
                    <p className="text-amber-600 font-medium">Check!</p>
                  ) : (
                    <p className="text-green-600 font-medium">In Progress</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">Move History</h4>
                <div className="max-h-48 overflow-y-auto">
                  {localMoveHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No moves yet</p>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {localMoveHistory.reduce((acc: JSX.Element[], action, index) => {
                        if (index % 2 === 0) {
                          acc.push(
                            <li key={action.sequenceNumber}>
                              {Math.floor(index / 2) + 1}. White: {moveToAlgebraicNotation(action)}{" "}
                              {localMoveHistory[index + 1] ? `Black: ${moveToAlgebraicNotation(localMoveHistory[index + 1])}` : ""}
                            </li>
                          );
                        }
                        return acc;
                      }, [])}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GameEndModal
        open={isModalOpen}
        gameResult={gameResult}
        onClose={() => setIsModalOpen(false)}
        onPlayAgain={resetGame}
        onReviewGame={() => setIsModalOpen(false)}
        onBackToMenu={() => navigate("/")}
        isRankedMatch={isRankedMatch}
      />
    </div>
  );
};

export default ChessGameLayoutPvP;
