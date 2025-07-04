import React, { useState } from 'react';
import { cn } from '@/lib/utils.ts';
import ChessPiece from './ChessPiece.tsx';
import { ChessSquareProps } from '@/Interfaces/ChessSquareProps.ts';
import { BoardEffect } from '@/Interfaces/types/rpgChess.ts';
import { enhancedRPGService } from '@/services/EnhancedRPGService.ts';
import { rpgGameService } from '@/services/RPGGameService.ts';
import { Piece } from "@/Interfaces/types/chess.ts";

const ChessSquare: React.FC<ChessSquareProps> = ({
                                                   row,
                                                   col,
                                                   piece,
                                                   isLight,
                                                   isSelected,
                                                   isValidMove,
                                                   isCheck = false,
                                                   actualRowIndex,
                                                   actualColIndex,
                                                   onClick,
                                                   specialEffect,
                                                   gameId,
                                                   playerId,
                                                   gameMode,
                                                   onError,
                                                   onPieceClick,
                                                 }) => {
  const [localError, setLocalError] = useState<string | null>(null);

  // Map special effect to styles and icons based on BoardEffect
  const getSpecialEffectConfig = (effectType?: string) => {
    const configs: Record<string, { className: string; icon: string }> = {
      teleport: {
        className: 'bg-gradient-to-br from-purple-300 to-purple-500 animate-pulse',
        icon: '🌀',
      },
      boost: {
        className: 'bg-gradient-to-br from-green-300 to-green-500',
        icon: '⚡',
      },
      trap: {
        className: 'bg-gradient-to-br from-red-300 to-red-500',
        icon: '💥',
      },
      portal: {
        className: 'bg-gradient-to-br from-blue-300 to-blue-500 animate-pulse',
        icon: '🌐',
      },
      pit: {
        className: 'bg-gradient-to-br from-black to-gray-800 border-4 border-red-600',
        icon: '🕳️',
      },
      slippery: {
        className: 'bg-gradient-to-br from-cyan-200 to-cyan-400 animate-pulse',
        icon: '❄️',
      },
    };
    return effectType ? configs[effectType] || { className: '', icon: '' } : { className: '', icon: '' };
  };

  const handleClick = async () => {
    try {
      setLocalError(null);
      if (specialEffect && (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG' || gameMode === 'ENHANCED_RPG')) {
      }
      onClick(row, col);
    } catch (err) {
      const errorMsg = `Failed to process ${specialEffect || 'click'}: ${(err as Error).message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }

    try {
      setLocalError(null);

      // Handle special effect triggers in RPG modes
      if (specialEffect && (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG' || gameMode === 'ENHANCED_RPG')) {
        const effect: BoardEffect = {
          id: `effect-${row}-${col}`,
          name: specialEffect,
          description: `Triggered ${specialEffect} at (${row}, ${col})`,
          type: specialEffect as BoardEffect['type'],
          positions: [[row, col]],
          effect: {}, // Placeholder; parent or backend defines actual effect
          isActive: true,
        };

        if (gameMode === 'ENHANCED_RPG') {
          await enhancedRPGService.applyBoardEffect(gameId!, effect, playerId!);
          console.log(`Applied ${specialEffect} effect at (${row}, ${col})`);
        } else {
          await rpgGameService.addBoardEffect(gameId!, effect, playerId!);
          console.log(`Added ${specialEffect} effect at (${row}, ${col})`);
        }
      }

      // Call parent onClick handler
      onClick(row, col);
    } catch (err) {
      const errorMsg = `Failed to process ${specialEffect || 'click'}: ${(err as Error).message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }
  };

  const { className: effectClass, icon: effectIcon } = getSpecialEffectConfig(specialEffect);

  return (
    <div
      className={cn(
        'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center relative cursor-pointer',
        specialEffect ? effectClass : isLight ? 'bg-chess-light' : 'bg-chess-dark',
        isSelected && 'ring-2 ring-blue-500',
        isValidMove && !specialEffect && 'bg-chess-valid-move',
        isCheck && 'bg-red-200',
        localError && 'border-2 border-red-500'
      )}
      onClick={handleClick}
    >
      {piece && (
        <ChessPiece
          piece={piece}
          gameMode={gameMode}
          gameId={gameId}
          playerId={playerId}
          isSelected={isSelected}
          onClick={(p) => onPieceClick?.(p as Piece, { row: actualRowIndex, col: actualColIndex })}
        />
      )}

      {/* Display coordinates in corner for larger boards */}
      {row === 7 && actualColIndex < 8 && (
        <span className="absolute bottom-0 right-1 text-xs opacity-50">
          {String.fromCharCode(97 + actualColIndex)}
        </span>
      )}
      {col === 0 && actualRowIndex < 8 && (
        <span className="absolute top-0 left-1 text-xs opacity-50">
          {8 - actualRowIndex}
        </span>
      )}

      {/* Special effect indicator */}
      {specialEffect && (
        <div className="absolute top-1 right-1">
          <span className="text-xs">{effectIcon}</span>
        </div>
      )}

      {/* Highlight if this is a valid capture */}
      {isValidMove && piece && (
        <div className="absolute inset-0 border-2 border-red-500 rounded-sm"></div>
      )}

      {/* Show check indicator */}
      {isCheck && (
        <div className="absolute inset-0 border-4 border-red-600 animate-pulse rounded-sm"></div>
      )}

      {/* Error indicator */}
      {localError && (
        <div className="absolute top-0 left-0 text-xs bg-red-500 text-white px-1 rounded">
          Error
        </div>
      )}
    </div>
  );
};

export default ChessSquare;
