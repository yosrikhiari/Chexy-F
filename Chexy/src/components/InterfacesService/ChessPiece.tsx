import React, { useState } from 'react';
import { cn } from '@/lib/utils.ts';
import { ChessPieceProps } from '@/Interfaces/ChessPieceProps.ts';
import { Piece } from '@/Interfaces/types/chess.ts';
import { RPGPiece } from '@/Interfaces/types/rpgChess.ts';
import { EnhancedRPGPiece } from '@/Interfaces/types/enhancedRpgChess.ts';
import { rpgGameService } from "@/services/RPGGameService.ts";
import { enhancedRPGService } from "@/services/EnhancedRPGService.ts";

const ChessPiece: React.FC<ChessPieceProps> = ({
                                                 piece,
                                                 gameMode = 'CLASSIC_MULTIPLAYER',
                                                 onClick,
                                                 isSelected,
                                                 gameId,
                                                 playerId,
                                               }) => {
  const [error, setError] = useState<string | null>(null);

  const isClassicPiece = (p: Piece | RPGPiece | EnhancedRPGPiece | null): p is Piece =>
    !!p && 'type' in p && 'color' in p && !('hp' in p) &&
    typeof p.type === 'string' && typeof p.color === 'string' &&
    ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(p.type.toLowerCase()) &&
    ['white', 'black'].includes(p.color.toLowerCase());

  const isRPGPiece = (p: Piece | RPGPiece | EnhancedRPGPiece | null): p is RPGPiece =>
    !!p && 'hp' in p && !('pluscurrentHp' in p);

  const isEnhancedRPGPiece = (p: Piece | RPGPiece | EnhancedRPGPiece | null): p is EnhancedRPGPiece =>
    !!p && 'pluscurrentHp' in p;

  const rpgPieceIcons: Record<string, string> = {
    common: '🛡️', rare: '⚔️', epic: '🔥', legendary: '✨',
  };

  const handleClick = (e: React.MouseEvent) => {
    // For classic pieces in classic modes, do nothing and let the event bubble up
    if (isClassicPiece(piece) && (gameMode === 'CLASSIC_MULTIPLAYER' || gameMode === 'CLASSIC_SINGLE_PLAYER')) {
      return; // No e.stopPropagation() and no action, preserving selection via square
    }

    // For RPG modes, stop propagation and handle specific logic
    e.stopPropagation();
    if (!gameId || !playerId) {
      console.warn('Click ignored: Missing gameId or playerId', { gameId, playerId });
      return;
    }
    if (!piece) {
      console.warn('Click ignored: No piece provided');
      return;
    }

    try {
      setError(null);
      if (isRPGPiece(piece) && (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG')) {
        rpgGameService.addPieceToArmy(gameId, piece, playerId)
          .then(() => console.log('Piece added to army'))
          .catch(err => {
            setError('Failed to add piece to army');
            console.error('Failed to add piece:', err);
          });
      } else if (isEnhancedRPGPiece(piece) && gameMode === 'ENHANCED_RPG') {
        enhancedRPGService.resolveCombat(piece, piece, gameId, playerId)
          .then(combatResult => console.log('Combat resolved:', combatResult))
          .catch(err => {
            setError('Combat failed');
            console.error('Combat failed:', err);
          });
      }
    } catch (err) {
      setError('Action failed');
      console.error('Action failed:', err);
    }
  };

  const renderClassicPiece = (p: Piece) => {
    const { type, color } = p;
    const colorCapitalized = color.charAt(0).toUpperCase() + color.slice(1);
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    const imagePath = `/chessassets/${colorCapitalized}-${typeCapitalized}.png`;

    return (
      <img
        src={imagePath}
        alt={`${color} ${type}`}
        className={cn(
          'chess-piece w-full h-full object-contain',
          isSelected && 'ring-2 ring-blue-500'
        )}
        onClick={gameId && playerId ? handleClick : undefined}
        onError={() => console.error(`Failed to load image: ${imagePath}`)}
      />
    );
  };

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
        onClick={gameId && playerId ? handleClick : undefined}
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

  if (!piece) {
    console.warn('Received null piece prop');
    return null;
  }

  if (isClassicPiece(piece) && (gameMode === 'CLASSIC_MULTIPLAYER' || gameMode === 'CLASSIC_SINGLE_PLAYER')) {
    return renderClassicPiece(piece);
  } else if (isRPGPiece(piece) || isEnhancedRPGPiece(piece)) {
    console.log('ChessPiece props:', { gameId, playerId });
    return renderRPGPiece(piece);
  } else {
    console.warn('Invalid piece type for rendering:', piece);
    return null;
  }
};

export default ChessPiece;
