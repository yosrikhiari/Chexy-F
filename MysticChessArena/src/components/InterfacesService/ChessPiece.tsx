import React, { useState } from 'react';
import { cn } from '@/lib/utils.ts';
import { ChessPieceProps } from '@/Interfaces/ChessPieceProps.ts';
import { Piece, PieceColor, PieceType } from '@/Interfaces/types/chess.ts';
import { RPGPiece } from '@/Interfaces/types/rpgChess.ts';
import { EnhancedRPGPiece } from '@/Interfaces/types/enhancedRpgChess.ts';
import {chessGameService} from "@/services/ChessGameService.ts";
import {gameService} from "@/services/GameService.ts";
import {rpgGameService} from "@/services/RPGGameService.ts";
import {enhancedRPGService} from "@/services/EnhancedRPGService.ts";


const ChessPiece: React.FC<ChessPieceProps> = ({
                                                 piece,
                                                 gameMode = 'CLASSIC_MULTIPLAYER',
                                                 onClick,
                                                 isSelected,
                                                 gameId,
                                                 playerId,
                                               }) => {
  // State for error handling
  const [error, setError] = useState<string | null>(null);

  // Determine piece type
  const isClassicPiece = (p: Piece | RPGPiece | EnhancedRPGPiece): p is Piece =>
    'type' in p && 'color' in p && !('hp' in p);
  const isRPGPiece = (p: Piece | RPGPiece | EnhancedRPGPiece): p is RPGPiece =>
    'hp' in p && !('pluscurrentHp' in p);
  const isEnhancedRPGPiece = (p: Piece | RPGPiece | EnhancedRPGPiece): p is EnhancedRPGPiece =>
    'pluscurrentHp' in p;

  // Unicode symbols for classic chess pieces
  const classicPieces = {
    white: {
      king: '♔',
      queen: '♕',
      rook: '♖',
      bishop: '♗',
      knight: '♘',
      pawn: '♙',
    },
    black: {
      king: '♚',
      queen: '♛',
      rook: '♜',
      bishop: '♝',
      knight: '♞',
      pawn: '♟',
    },
  };

  // Dynamic RPG piece icons (replace with backend-fetched assets or local map)
  const rpgPieceIcons: Record<string, string> = {
    common: '🛡️',
    rare: '⚔️',
    epic: '🔥',
    legendary: '✨',
  };

  // Handle click event with backend validation
  const handleClick = async () => {
    if (!gameId || !playerId) {
      setError('Game ID or Player ID missing');
      console.error('Game ID or Player ID missing');
      return;
    }

    try {
      setError(null);

      if (isClassicPiece(piece) && gameMode === 'CLASSIC_MULTIPLAYER') {
        // Example move validation (assumes target position is handled by parent)
        if (piece.Position) {
          const move = {
            from: { row: piece.Position.row, col: piece.Position.col },
            to: { row: piece.Position.row, col: piece.Position.col }, // Placeholder target
          };
          const isValid = await chessGameService.validateMove(gameId, move);
          if (isValid) {
            const updatedState = await gameService.executeMove(gameId, move);
            console.log('Move executed:', updatedState);
          } else {
            setError('Invalid move');
            console.error('Invalid move');
          }
        }
      } else if (isRPGPiece(piece) && (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG')) {
        // Example: Add piece to army or trigger ability
        await rpgGameService.addPieceToArmy(gameId, piece, playerId);
        console.log('Piece added to army');
      } else if (isEnhancedRPGPiece(piece) && gameMode === 'ENHANCED_RPG') {
        // Example: Resolve combat (assumes target piece is handled by parent)
        const targetPiece: EnhancedRPGPiece = piece; // Placeholder target
        const combatResult = await enhancedRPGService.resolveCombat(piece, targetPiece, gameId, playerId);
        console.log('Combat resolved:', combatResult);
      }

      // Trigger onClick callback if provided
      if (onClick) {
        onClick(piece);
      }
    } catch (err) {
      setError('Action failed');
      console.error('Action failed:', err);
    }
  };

  // Render classic chess piece
  const renderClassicPiece = (p: Piece) => {
    const { type, color } = p;
    return (
      <div
        className={cn(
          'chess-piece text-3xl sm:text-4xl cursor-pointer',
          color === 'white'
            ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]'
            : 'text-[#222222] drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]',
          isSelected && 'ring-2 ring-blue-500'
        )}
        onClick={handleClick}
      >
        {classicPieces[color][type]}
      </div>
    );
  };

  // Render RPG piece
  const renderRPGPiece = (p: RPGPiece | EnhancedRPGPiece) => {
    const { name, rarity, hp, maxHp, specialAbility } = p;
    const isEnhanced = isEnhancedRPGPiece(p);
    const currentHp = isEnhanced ? p.pluscurrentHp : hp;
    const maxHpValue = isEnhanced ? p.plusmaxHp : maxHp;
    const icon = rpgPieceIcons[rarity] || '♟';

    return (
      <div
        className={cn(
          'chess-piece relative text-2xl sm:text-3xl cursor-pointer p-2 rounded',
          isSelected && 'ring-2 ring-blue-500',
          rarity === 'legendary' && 'bg-yellow-200',
          rarity === 'epic' && 'bg-purple-200',
          rarity === 'rare' && 'bg-blue-200',
          rarity === 'common' && 'bg-gray-200'
        )}
        onClick={handleClick}
        title={`${name}: ${specialAbility}\nHP: ${currentHp}/${maxHpValue}`}
      >
        <span className="text-center">{icon}</span>
        <div className="absolute top-0 right-0 text-xs bg-black text-white px-1 rounded">
          {currentHp}/{maxHpValue}
        </div>
        {isEnhanced && (
          <div className="absolute bottom-0 right-0 text-xs bg-green-500 text-white px-1 rounded">
            Lvl {p.pluslevel}
          </div>
        )}
        {error && (
          <div className="absolute top-0 left-0 text-xs bg-red-500 text-white px-1 rounded">
            {error}
          </div>
        )}
      </div>
    );
  };

  // Render based on piece type and game mode
  if (isClassicPiece(piece) && gameMode === 'CLASSIC_MULTIPLAYER') {
    return renderClassicPiece(piece);
  } else if (isRPGPiece(piece) || isEnhancedRPGPiece(piece)) {
    return renderRPGPiece(piece);
  } else {
    return null; // Handle invalid piece type
  }
};

export default ChessPiece;
