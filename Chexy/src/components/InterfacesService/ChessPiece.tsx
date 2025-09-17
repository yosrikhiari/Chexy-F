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
        // Defer combat to board logic; here we only signal selection
        if (onClick) onClick(piece as any, { row: -1, col: -1 } as any);
        return;
      }
    } catch (err) {
      setError('Action failed');
      console.error('Action failed:', err);
    }
  };

  const renderClassicPiece = (p: Piece) => {
    const { type, color } = p;
    const colorCapitalized = color.charAt(0).toUpperCase() + color.slice(1);
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
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
    const isEnhanced = isEnhancedRPGPiece(p);
    const currentHp = isEnhanced ? p.pluscurrentHp : p.hp;
    const maxHpValue = isEnhanced ? p.plusmaxHp : p.maxHp;
    const level = isEnhanced ? p.pluslevel : undefined;

    // Reuse existing piece icons by type/color
    const type = (p.type || 'pawn').toString().toLowerCase();
    const color = (p.color || 'white').toString().toLowerCase();
    const colorCapitalized = color.charAt(0).toUpperCase() + color.slice(1);
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    const imagePath = `/chessassets/${colorCapitalized}-${typeCapitalized}.png`;

    return (
      <div className={cn('relative w-full h-full', isSelected && 'ring-2 ring-blue-500')} title={`${p.name}: ${p.specialAbility || 'none'}\nHP: ${currentHp}/${maxHpValue}${level ? `\nLevel: ${level}` : ''}`}>
        <img
          src={imagePath}
          alt={`${color} ${type}`}
          className={cn('chess-piece w-full h-full object-contain')}
          onClick={gameId && playerId ? handleClick : undefined}
          onError={() => console.error(`Failed to load image: ${imagePath}`)}
        />
        <div className="absolute top-0 right-0 text-[10px] sm:text-xs bg-black/70 text-white px-1 rounded">
          {currentHp}/{maxHpValue}
        </div>
        {level !== undefined && (
          <div className="absolute bottom-0 right-0 text-[10px] sm:text-xs bg-green-600/80 text-white px-1 rounded">
            Lvl {level}
          </div>
        )}
        {error && (
          <div className="absolute top-0 left-0 text-[10px] sm:text-xs bg-red-600/80 text-white px-1 rounded">
            {error}
          </div>
        )}
      </div>
    );
  };

  if (!piece) return null;

  if (isClassicPiece(piece) && (gameMode === 'CLASSIC_MULTIPLAYER' || gameMode === 'CLASSIC_SINGLE_PLAYER')) {
    return renderClassicPiece(piece);
  } else if (isRPGPiece(piece) || isEnhancedRPGPiece(piece)) {
    return renderRPGPiece(piece);
  } else {
    console.warn('Invalid piece type for rendering:', piece);
    return null;
  }
};

export default ChessPiece;
