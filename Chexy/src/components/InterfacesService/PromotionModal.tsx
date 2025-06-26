import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {PieceType, PieceColor, BoardPosition} from "@/Interfaces/types/chess.ts";
import { Crown, Castle, Church, Shield } from "lucide-react";
import {chessGameService} from "@/services/ChessGameService.ts";
import {gameService} from "@/services/GameService.ts";
import {ExtendedPromotionModalProps} from "@/Interfaces/ExtendedPromotionModalProps.ts";


// Define promotion options
const PROMOTION_OPTIONS: { type: PieceType; name: string; icon: React.ReactNode }[] = [
  { type: "queen", name: "Queen", icon: <Crown className="h-8 w-8" /> },
  { type: "rook", name: "Rook", icon: <Castle className="h-8 w-8" /> },
  { type: "bishop", name: "Bishop", icon: <Church className="h-8 w-8" /> },
  { type: "knight", name: "Knight", icon: <Shield className="h-8 w-8" /> },
];

// Extend props to include gameId and move details


const PromotionModal: React.FC<ExtendedPromotionModalProps> = ({
                                                                 isOpen,
                                                                 color,
                                                                 onPromote,
                                                                 gameId,
                                                                 from,
                                                                 to,
                                                               }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePromotion = async (pieceType: PieceType) => {
    setIsLoading(true);
    setError(null);
    try {
      // Validate the move
      const isValid = await chessGameService.validateMove(gameId, { col:from.col,row:from.row,torow:to.row,tocol:to.col });
      if (!isValid) {
        throw new Error("Invalid move for promotion");
      }

      // Execute the move with promotion
      const move = { from, to, promotion: pieceType }; // Include promotion in the move object
      const updatedGameState = await gameService.executeMove(gameId, move);

      // Notify parent component of the selected piece type
      onPromote(pieceType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process promotion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">
            🏆 Pawn Promotion! 🏆
          </CardTitle>
          <p className="text-muted-foreground">
            Choose what your pawn becomes:
          </p>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {PROMOTION_OPTIONS.map((option) => (
              <Button
                key={option.type}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-primary/10"
                onClick={() => handlePromotion(option.type)}
                disabled={isLoading}
              >
                <div className={color === "white" ? "text-gray-800" : "text-gray-900"}>
                  {option.icon}
                </div>
                <span className="text-sm font-medium">{option.name}</span>
              </Button>
            ))}
          </div>
          {isLoading && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Processing promotion...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PromotionModal;
