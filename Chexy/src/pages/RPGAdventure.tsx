import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sword, Shield, Heart, Zap, ShoppingCart, Coins, Crown, Star, Sparkles } from "lucide-react";
import { EnhancedGameState, DynamicBoardModifier } from "@/Interfaces/types/enhancedRpgChess";
import { RPGPiece, RPGModifier, RPGBoardModifier, CapacityModifier } from "@/Interfaces/types/rpgChess";
import { ShopItem } from "@/Interfaces/shopItems";
import { STARTER_PIECES, ROUND_OBJECTIVES } from "@/utils/rpgChessConstants";
import RPGPieceCard from "@/components/InterfacesService/RPGPieceCard";
import RPGModifierCard from "@/components/InterfacesService/RPGModifierCard";
import RPGBoardModifierCard from "@/components/InterfacesService/RPGBoardModifierCard";
import EnhancedRPGChessBoard from "@/components/InterfacesService/EnhancedRPGChessBoard";
import RPGShop from "@/components/InterfacesService/RPGShop";
import { calculateArmyCapacity, canAddPieceToArmy, getArmyStats } from "@/utils/armyCapacityUtils";
import { generateDynamicBoardModifiers, calculateProgressiveBoardSize } from "@/utils/dynamicBoardEffects";
import { rpgGameService } from "@/services/RPGGameService";
import { gameSessionService } from "@/services/GameSessionService";
import { GameMode } from "@/Interfaces/enums/GameMode";
import { AIService } from "@/services/aiService";

const RPGAdventure = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const userInfo = JSON.parse(localStorage.getItem("user") || '{"name": "Guest", "id": "guest"}');

  const [gameState, setGameState] = useState<EnhancedGameState | null>(null);
  const [gamePhase, setGamePhase] = useState<"preparation" | "battle" | "draft" | "shop">("preparation");
  const [availableRewards, setAvailableRewards] = useState<DynamicBoardModifier[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [session, setSession] = useState<any>(null);

  const getPieceKey = (p: any) => `${(p.name||'').toLowerCase()}|${(p.type||'').toLowerCase()}`;

  const levelUpPieceStats = (p: any, newLevel: number) => {
    const name = (p.name||'').toLowerCase();
    const type = (p.type||'').toLowerCase();
    const nature: 'tank' | 'assassin' | 'caster' = name.includes('guard') || type === 'rook' ? 'tank' : (name.includes('rider') || type === 'knight') ? 'assassin' : 'caster';
    const baseHp = p.plusmaxHp ?? p.maxHp ?? 10;
    const baseAtk = p.plusattack ?? p.attack ?? 5;
    const baseDef = p.plusdefense ?? p.defense ?? 5;
    let hp = baseHp;
    let atk = baseAtk;
    let def = baseDef;
    // Incremental growth per level gained (relative to level 1)
    const gains = Math.max(0, newLevel - (p.pluslevel ?? 1));
    for (let i = 0; i < gains; i++) {
      if (nature === 'tank') { hp += 2; def += 1; }
      else if (nature === 'assassin') { atk += 2; }
      else { atk += 1; def += 1; }
    }
    return { plusmaxHp: hp, plusattack: atk, plusdefense: def, pluscurrentHp: Math.min(p.pluscurrentHp ?? hp, hp) };
  };

  const applyLeveling = () => {
    setGameState((prev) => {
      if (!prev) return prev as any;
      const pieces = [...prev.playerArmy];
      const buckets: Record<string, number[]> = {};
      // map piece key to indices
      pieces.forEach((p, idx) => {
        const key = getPieceKey(p);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(idx);
      });
      const toRemove = new Set<number>();
      // consume duplicates to level up: need currentLevel pieces to reach next
      Object.values(buckets).forEach((indices) => {
        // work on a queue of indices sorted by current level (lowest first)
        indices.sort((a,b) => (pieces[a].pluslevel ?? 1) - (pieces[b].pluslevel ?? 1));
        while (indices.length > 0) {
          const firstIdx = indices.shift()!;
          const piece = pieces[firstIdx];
          const currentLevel = piece.pluslevel ?? 1;
          const need = currentLevel; // need N copies at this level to upgrade to level+1
          const group = [firstIdx];
          // find (need-1) more pieces with the same level
          for (let i = indices.length - 1; i >= 0 && group.length < need; i--) {
            const idx = indices[i];
            if ((pieces[idx].pluslevel ?? 1) === currentLevel) {
              group.push(idx);
              indices.splice(i,1);
            }
          }
          if (group.length === need) {
            // perform upgrade
            const newLevel = currentLevel + 1;
            const updatedStats = levelUpPieceStats(piece as any, newLevel);
            pieces[firstIdx] = {
              ...piece,
              pluslevel: newLevel,
              plusexperience: 0,
              ...updatedStats,
              // unlock ultimate at level 5
              specialAbility: newLevel >= 5 ? (piece.specialAbility || 'Ultimate Unleashed') : piece.specialAbility,
            } as any;
            // mark others for removal
            group.slice(1).forEach(i => toRemove.add(i));
            // reinsert upgraded piece index at correct position for potential further upgrades
            indices.unshift(firstIdx);
          }
        }
      });
      const newArmy = pieces.filter((_, idx) => !toRemove.has(idx));
      return { ...prev, playerArmy: newArmy } as any;
    });
  };

  // Initialize game state with backend
  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log("Initializing RPG game...");
        // Always create a new session for now to avoid 404 issues
        const sessionObj = await gameSessionService.createGameSession(
          userInfo.id,
          'SINGLE_PLAYER_RPG',
          true
        );
        console.log("Created session:", sessionObj);
        setSession(sessionObj);
        
        const rpgGameState = await rpgGameService.createRPGGame(userInfo.id, sessionObj.gameId, false);
        console.log("Created RPG game state:", rpgGameState);
        
        const enhancedState: EnhancedGameState = {
          ...rpgGameState,
          gameid: rpgGameState.gameId, // Use the exact gameId from RPG state
          gameSessionId: sessionObj.gameId,
          difficulty: 1,
          enemyArmy: [],
          aiStrategy: "defensive",
          teleportPortals: 1,
          dragOffset: { x: 0, y: 0 },
          viewportSize: { width: 800, height: 600 },
          roundProgression: {
            baseBoardSize: 8,
            sizeIncreasePerBoss: 1,
            difficultyMultiplier: 1.2,
          },
        };
        console.log("Setting enhanced state:", enhancedState);
        setGameState(enhancedState);
      } catch (error) {
        console.error("Failed to initialize game:", error);
        // Show error to user
        alert("Failed to initialize game: " + error.message);
      }
    };
    initializeGame();
  }, []);

  // Loading state
  if (!gameState) {
    return <div className="text-white text-center">Loading...</div>;
  }

  const openShop = async () => {
    try {
      // Assume a backend method exists to fetch shop items; mock for now
      const items = generateShopItems(gameState.coins);
      setShopItems(items);
      setGamePhase("shop");
    } catch (error) {
      console.error("Failed to open shop:", error);
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (gameState.coins < item.cost) return;

    // Temporarily disable backend purchase to avoid 400 spam; apply locally
    setGameState((prev) => {
      if (!prev) return prev as any;
      const next: EnhancedGameState = { ...prev } as any;
      next.coins = Math.max(0, (prev.coins || 0) - item.cost);
      if (item.type === "piece") {
        const base = item.item as any;
        // Normalize purchased piece to EnhancedRPG fields so UI shows correct stats
        const normalized = {
          ...base,
          pluscurrentHp: base.pluscurrentHp ?? base.hp,
          plusmaxHp: base.plusmaxHp ?? base.maxHp,
          plusattack: base.plusattack ?? base.attack,
          plusdefense: base.plusdefense ?? base.defense,
          pluslevel: base.pluslevel ?? 1,
          plusexperience: base.plusexperience ?? 0,
        } as any;
        next.playerArmy = [...prev.playerArmy, normalized];
      } else if (item.type === "modifier") {
        next.activeModifiers = [...(prev.activeModifiers || []), { ...(item.item as any), isActive: true }];
        // Apply known modifier effects immediately
        const modName = ((item.item as any).name || '').toLowerCase();
        if (modName.includes('tome of power')) {
          // +2 attack to all allies
          next.playerArmy = prev.playerArmy.map((p: any) => ({
            ...p,
            plusattack: ((p.plusattack ?? p.attack ?? 0) + 2)
          }));
        }
      } else if (item.type === "board_modifier") {
        next.activeBoardModifiers = [...(prev.activeBoardModifiers || []), { ...(item.item as any), isActive: true }];
        const bmodName = ((item.item as any).name || '').toLowerCase();
        if (bmodName.includes('ward stone')) {
          // Simple effect: increase portal pairs availability indicator
          next.teleportPortals = (prev.teleportPortals || 0) + 1;
        }
      } else if (item.type === "capacity_modifier") {
        next.activeCapacityModifiers = [...(prev.activeCapacityModifiers || []), item.item as any];
        // Recompute capacity when bonuses change
        next.armyCapacity = calculateArmyCapacity(prev.boardSize, next.activeCapacityModifiers || []);
      }
      return next;
    });
    setShopItems((prev) => prev.filter((shopItem) => shopItem.id !== item.id));
    // auto-apply leveling after purchases
    applyLeveling();
  };

  const startBattle = async () => {
    try {
      const newBoardSize = await calculateProgressiveBoardSize(
        gameState.gameid,
        userInfo.id,
        gameState.roundProgression.baseBoardSize,
        gameState.currentRound
      );
      const enemyArmy = await AIService.generateEnemyArmy(
        gameState.currentRound,
        newBoardSize,
        gameState.activeModifiers || [],
        gameState.activeCapacityModifiers || []
      );
      const updatedState = {
        ...gameState,
        boardSize: newBoardSize,
        enemyArmy,
        difficulty: Math.min(10, gameState.difficulty + 0.3),
        teleportPortals: Math.floor((newBoardSize - 6) / 2),
      };
      setGameState(updatedState);
      setGamePhase("battle");
    } catch (error) {
      console.error("Failed to start battle:", error);
    }
  };

  const completeBattle = async (victory: boolean) => {
    try {
      if (victory) {
        const updatedState = await rpgGameService.progressToNextRound(gameState.gameid);
        const isBossRound = updatedState.currentRound % 5 === 0;
        if (isBossRound) {
          const rewards = await generateDynamicBoardModifiers(updatedState.gameid, userInfo.id, updatedState.boardSize, updatedState.currentRound);
          const shuffledRewards = rewards.sort(() => Math.random() - 0.5).slice(0, 3);
          setAvailableRewards(shuffledRewards);
          setGamePhase("draft");
        } else {
          setGamePhase("preparation");
        }
        setGameState(updatedState as EnhancedGameState);
      } else {
        const updatedState = await rpgGameService.endRPGGame(gameState.gameid, false);
        setGameState(updatedState as EnhancedGameState);
        setGamePhase("preparation");
      }
    } catch (error) {
      console.error("Failed to complete battle:", error);
    }
  };

  const selectReward = async (reward: DynamicBoardModifier) => {
    try {
      // Assume a backend method to apply reward; mock for now
      const newBoardSize = Math.max(6, Math.min(16, gameState.boardSize + reward.sizeModifier));
      const newCapacity = calculateArmyCapacity(newBoardSize, gameState.activeCapacityModifiers || []);
      const updatedState = {
        ...gameState,
        activeBoardModifiers: [...(gameState.activeBoardModifiers || []), { ...reward, isActive: true }],
        boardSize: newBoardSize,
        armyCapacity: newCapacity,
        teleportPortals: Math.floor((newBoardSize - 6) / 2),
      };
      setGameState(updatedState);
      setGamePhase("preparation");
      setAvailableRewards([]);
      // Skip backend sync to avoid 400s; can re-enable when API supports it
    } catch (error) {
      console.error("Failed to select reward:", error);
    }
  };

  const removePiece = async (pieceId: string) => {
    try {
      // Assume a backend method to remove piece; mock for now
      const updatedState = await rpgGameService.addPieceToArmy(
        gameState.gameid,
        gameState.playerArmy.find((p) => p.id === pieceId),
        userInfo.id
      ); // Note: This should be a remove method, adjust when available
      setGameState({
        ...gameState,
        playerArmy: gameState.playerArmy.filter((piece) => piece.id !== pieceId),
      });
    } catch (error) {
      console.error("Failed to remove piece:", error);
    }
  };

  const resetGame = async () => {
    try {
      const session = await gameSessionService.createGameSession(
        userInfo.id,
        'SINGLE_PLAYER_RPG',
        true
      );
      const newGameState = await rpgGameService.createRPGGame(userInfo.id, session.gameId, false);
      const enhancedState: EnhancedGameState = {
        ...newGameState,
        gameid: newGameState.gameId || session.gameId,
        gameSessionId: session.gameId,
        difficulty: 1,
        enemyArmy: [],
        aiStrategy: "defensive",
        teleportPortals: 1,
        dragOffset: { x: 0, y: 0 },
        viewportSize: { width: 800, height: 600 },
        roundProgression: {
          baseBoardSize: 8,
          sizeIncreasePerBoss: 1,
          difficultyMultiplier: 1.2,
        },
      };
      setGameState(enhancedState);
      setGamePhase("preparation");
    } catch (error) {
      console.error("Failed to reset game:", error);
    }
  };

  const getCurrentObjective = () => {
    const objectiveTypes = ROUND_OBJECTIVES;
    const index = (gameState.currentRound - 1) % objectiveTypes.length;
    return objectiveTypes[index];
  };

  // Game Over Screen
  if (gameState.isGameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-red-900">
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-5xl font-bold text-red-500 mb-4">Game Over</h1>
          <p className="text-xl text-red-300 mb-8">
            You have been defeated after {gameState.completedRounds?.length || 0} rounds.
          </p>
          <Button onClick={resetGame} className="bg-red-600 hover:bg-red-700">
            Start New Adventure
          </Button>
        </div>
      </div>
    );
  }

  if (gamePhase === "battle") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="container mx-auto px-4 py-8">
          <EnhancedRPGChessBoard
            gameState={gameState}
            onBattleComplete={completeBattle}
            onBackToPreparation={() => setGamePhase("preparation")}
          />
        </div>
      </div>
    );
  }

  if (gamePhase === "shop") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="container mx-auto px-4 py-8">
          <RPGShop
            shopItems={shopItems}
            coins={gameState.coins}
            onPurchase={handlePurchase}
            onClose={() => setGamePhase("preparation")}
            gameId={gameState.gameid}
            playerId={userInfo.id}
          />
        </div>
      </div>
    );
  }

  if (gamePhase === "draft") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Crown className="h-8 w-8 text-yellow-400 animate-pulse" />
              <Sparkles className="h-6 w-6 text-indigo-300" />
            </div>
            <h1 className="text-4xl font-bold text-yellow-300 mb-2 font-serif">🏆 Boss Victory! 🏆</h1>
            <p className="text-indigo-200 text-lg">Choose a dynamic battlefield enhancement!</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {availableRewards.map((reward) => (
              <Card
                key={reward.id}
                className="cursor-pointer hover:border-indigo-400 transition-all transform hover:scale-105 bg-white/5 backdrop-blur border border-white/10 shadow-lg hover:shadow-xl"
                onClick={() => selectReward(reward)}
              >
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Star className="h-6 w-6 text-yellow-400" />
                  </div>
                  <CardTitle className="text-xl text-white font-serif">{reward.name}</CardTitle>
                  <CardDescription className="text-indigo-200">{reward.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`px-3 py-2 rounded-full text-xs font-bold shadow-md ${
                        reward.rarity === "legendary"
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
                          : reward.rarity === "epic"
                            ? "bg-purple-500/20 text-purple-200 border border-purple-400/30"
                            : reward.rarity === "rare"
                              ? "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                              : "bg-slate-500/20 text-slate-200 border border-slate-400/30"
                      }`}
                    >
                      ✨ {reward.rarity.toUpperCase()} ✨
                    </span>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-sm font-bold text-indigo-200">
                      Size Change: {reward.sizeModifier > 0 ? "+" : ""}{reward.sizeModifier}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const armyStats = getArmyStats(gameState.playerArmy);
  const isBossRound = gameState.currentRound % 5 === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 sticky top-0 z-10 backdrop-blur bg-black/20 rounded-lg border border-white/10 px-3 py-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/game-select")}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Game Select
          </Button>
          <div className="text-right p-3 rounded-lg">
            <p className="text-sm text-indigo-200">
              🧙 Adventurer: <span className="font-bold text-yellow-300">{userInfo.name}</span>
            </p>
            <p className="text-xs text-indigo-300">⭐ Score: {gameState.score}</p>
            <p className="text-xs text-indigo-300">🎯 Difficulty: {Number(gameState.difficulty ?? 1).toFixed(1)}</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sword className="h-8 w-8 text-yellow-400" />
            <Crown className="h-8 w-8 text-yellow-300" />
            <Shield className="h-8 w-8 text-yellow-400" />
          </div>
          <h1 className="text-5xl font-bold text-yellow-300 mb-2 font-serif">⚔️ RPG Chess Adventure ⚔️</h1>
          <p className="text-indigo-200 text-lg">Embark on an epic turn-based roguelike quest!</p>
        </div>

        {/* Inline Lobby (invite and members) */}
        {session && (
          <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardHeader>
              <CardTitle className="text-yellow-300 font-serif">Lobby</CardTitle>
              <CardDescription className="text-indigo-200">
                Invite code: <span className="font-mono text-yellow-200">{session.inviteCode}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-indigo-200 font-semibold mb-2">Players</div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[session.whitePlayer, ...(session.blackPlayer || [])].filter(Boolean).map((p: any) => (
                  <li key={p.userId} className="bg-white/5 rounded px-3 py-2 border border-white/10">
                    {p.displayName || p.username}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Game Status */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <Card className="bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sword className="h-5 w-5 text-yellow-300" />
                <span className="font-bold text-indigo-100">Round</span>
              </div>
              <p className="text-2xl font-bold text-yellow-300">{gameState.currentRound}</p>
              {isBossRound && <p className="text-xs text-indigo-200 font-bold animate-pulse">👹 BOSS ROUND 👹</p>}
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Coins className="h-5 w-5 text-yellow-200" />
                <span className="font-bold text-indigo-100">Gold</span>
              </div>
              <p className="text-2xl font-bold text-yellow-300">{gameState.coins}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-red-200" />
                <span className="font-bold text-indigo-100">Lives</span>
              </div>
              <p className="text-2xl font-bold text-red-300">{gameState.lives}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-blue-200" />
                <span className="font-bold text-indigo-100">Board Size</span>
              </div>
              <p className="text-2xl font-bold text-blue-200">{gameState.boardSize}x{gameState.boardSize}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-green-200" />
                <span className="font-bold text-indigo-100">Portals</span>
              </div>
              <p className="text-2xl font-bold text-green-200">{gameState.teleportPortals}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-purple-200" />
                <span className="font-bold text-indigo-100">Army</span>
              </div>
              <p className="text-2xl font-bold text-purple-200">
                {armyStats.total}/{gameState.armyCapacity.maxTotalPieces}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Army Capacity Status */}
        <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-300 font-serif">🏰 Army Capacity</CardTitle>
            <CardDescription className="text-indigo-200">
              🗺️ Board Size: {gameState.boardSize}x{gameState.boardSize} |
              ⚔️ Base Capacity: {gameState.armyCapacity.maxTotalPieces - gameState.armyCapacity.bonusCapacity} |
              ✨ Bonus: +{gameState.armyCapacity.bonusCapacity}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm text-indigo-200">
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <span className="font-bold">👑 Queens:</span> {armyStats.queens}/{gameState.armyCapacity.maxQueens}
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <span className="font-bold">🏰 Rooks:</span> {armyStats.rooks}/{gameState.armyCapacity.maxRooks}
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <span className="font-bold">⛪ Bishops:</span> {armyStats.bishops}/{gameState.armyCapacity.maxBishops}
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <span className="font-bold">🐎 Knights:</span> {armyStats.knights}/{gameState.armyCapacity.maxKnights}
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <span className="font-bold">⚔️ Pawns:</span> {armyStats.pawns}/{gameState.armyCapacity.maxPawns}
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <span className="font-bold">👑 Kings:</span> {armyStats.kings}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Objective */}
        <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-300 font-serif">🎯 Current Quest</CardTitle>
            <CardDescription className="text-indigo-200">
              📜 Round {gameState.currentRound} - {getCurrentObjective().description}
              {isBossRound && <span className="text-indigo-300 font-bold animate-pulse"> 👹 (BOSS ROUND) 👹</span>}
              <br />
              <span className="text-xs">🗺️ Current Board Size: {gameState.boardSize}x{gameState.boardSize}</span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Player Army */}
        <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-300 font-serif">⚔️ Your Mighty Army</CardTitle>
            <CardDescription className="text-indigo-200">
              Manage your legendary chess warriors and their mystical abilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gameState.playerArmy.map((piece) => (
                <div key={piece.id} className="relative">
                  <RPGPieceCard piece={piece} gameId={gameState.gameid} playerId={userInfo.id} />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-0 right-0"
                    onClick={() => removePiece(piece.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Board Modifiers */}
        {(gameState.activeBoardModifiers?.length || 0) > 0 && (
          <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardHeader>
              <CardTitle className="text-yellow-300 font-serif">🔮 Active Battlefield Enchantments</CardTitle>
              <CardDescription className="text-indigo-200">Mystical modifications affecting the arena</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(gameState.activeBoardModifiers || []).map((modifier) => (
                  <RPGBoardModifierCard
                    key={modifier.id}
                    modifier={modifier}
                    gameId={gameState.gameid}
                    playerId={userInfo.id}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Capacity Modifiers */}
        {(gameState.activeCapacityModifiers?.length || 0) > 0 && (
          <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardHeader>
              <CardTitle className="text-yellow-300 font-serif">💪 Active Army Enhancements</CardTitle>
              <CardDescription className="text-indigo-200">Upgrades that expand your military might</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(gameState.activeCapacityModifiers || []).map((modifier) => (
                  <div
                    key={modifier.id}
                    className="p-3 bg-white/5 rounded-lg border border-white/10 shadow-md"
                  >
                    <h4 className="font-bold text-indigo-100">✨ {modifier.name}</h4>
                    <p className="text-sm text-indigo-200">{modifier.description}</p>
                    <p className="text-xs text-indigo-300 mt-1 font-semibold">
                      +{modifier.capacityBonus}{" "}
                      {modifier.type === "piece_type_limit" ? modifier.pieceType : "total capacity"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Modifiers */}
        {(gameState.activeModifiers?.length || 0) > 0 && (
          <Card className="mb-6 bg-white/5 backdrop-blur border border-white/10 shadow-lg">
            <CardHeader>
              <CardTitle className="text-yellow-300 font-serif">🌟 Active Magical Artifacts</CardTitle>
              <CardDescription className="text-indigo-200">
                Permanent enchantments empowering your army
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(gameState.activeModifiers || []).map((modifier) => (
                  <RPGModifierCard key={modifier.id} modifier={modifier} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            onClick={startBattle}
            size="lg"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg transform hover:scale-105 transition-all font-bold text-lg px-8"
          >
            <Sword className="h-5 w-5 mr-2" />
            ⚔️ START ENHANCED BATTLE ⚔️
          </Button>
          <Button
            onClick={openShop}
            variant="outline"
            size="lg"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg transform hover:scale-105 transition-all font-bold text-lg px-8"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            🛒 ENHANCED SHOP ({gameState.coins} <Coins className="h-4 w-4 ml-1" />)
          </Button>
          <Button
            onClick={resetGame}
            variant="outline"
            size="lg"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg transform hover:scale-105 transition-all font-bold"
          >
            🔄 Reset Enhanced Adventure
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RPGAdventure;

// Client-side shop generator MVP
const generateShopItems = (coins: number): ShopItem[] => {
  const items: ShopItem[] = [];

  // Pieces
  const shadowSeer: RPGPiece = {
    id: `shop-piece-seer-${Date.now()}`,
    type: "bishop" as any,
    color: "white" as any,
    name: "Shadow Seer",
    description: "A seer with board-wide vision. Reduced damage but high mobility.",
    specialAbility: "Blink",
    hp: 10,
    maxHp: 10,
    attack: 4,
    defense: 4,
    rarity: "epic" as any,
    position: undefined,
    hasMoved: false,
    isJoker: false,
  } as any;

  const obsidianGuard: RPGPiece = {
    id: `shop-piece-guard-${Date.now()}`,
    type: "rook" as any,
    color: "white" as any,
    name: "Obsidian Guard",
    description: "Immovable sentinel. Strong defense and rook-like control.",
    specialAbility: "Guard",
    hp: 14,
    maxHp: 14,
    attack: 5,
    defense: 7,
    rarity: "rare" as any,
    position: undefined,
    hasMoved: false,
    isJoker: false,
  } as any;

  const darkRider: RPGPiece = {
    id: `shop-piece-rider-${Date.now()}`,
    type: "knight" as any,
    color: "white" as any,
    name: "Dark Rider",
    description: "Swift striker. Knight jumps and agile attacks.",
    specialAbility: "Lunge",
    hp: 11,
    maxHp: 11,
    attack: 6,
    defense: 4,
    rarity: "rare" as any,
    position: undefined,
    hasMoved: false,
    isJoker: false,
  } as any;

  // Modifiers
  const powerTome: RPGModifier = {
    id: `shop-mod-power-${Date.now()}`,
    name: "Tome of Power",
    description: "+2 attack to all allies",
    effect: "+2 ATTACK",
    isPermanent: true,
    rarity: "epic" as any,
  } as any;

  const wardStone: RPGBoardModifier = {
    id: `shop-bmod-ward-${Date.now()}`,
    name: "Ward Stone",
    description: "Create protective wards on the board",
    effect: "+2 defensive tiles",
    boardSizeModifier: 0,
    rarity: "rare" as any,
  } as any;

  const commandBanner: CapacityModifier = {
    id: `shop-cap-banner-${Date.now()}`,
    name: "Command Banner",
    description: "+1 total army capacity",
    type: "total_capacity" as any,
    capacityBonus: 1,
    rarity: "common" as any,
  } as any;

  const catalog: ShopItem[] = [
    {
      id: shadowSeer.id,
      name: shadowSeer.name,
      description: shadowSeer.description,
      cost: 35,
      type: "piece",
      rarity: "epic",
      item: shadowSeer,
    },
    {
      id: obsidianGuard.id,
      name: obsidianGuard.name,
      description: obsidianGuard.description,
      cost: 28,
      type: "piece",
      rarity: "rare",
      item: obsidianGuard,
    },
    {
      id: darkRider.id,
      name: darkRider.name,
      description: darkRider.description,
      cost: 25,
      type: "piece",
      rarity: "rare",
      item: darkRider,
    },
    {
      id: powerTome.id,
      name: powerTome.name,
      description: powerTome.description,
      cost: 30,
      type: "modifier",
      rarity: "epic",
      item: powerTome,
    },
    {
      id: wardStone.id,
      name: wardStone.name,
      description: wardStone.description,
      cost: 18,
      type: "board_modifier",
      rarity: "rare",
      item: wardStone,
    },
    {
      id: commandBanner.id,
      name: commandBanner.name,
      description: commandBanner.description,
      cost: 12,
      type: "capacity_modifier",
      rarity: "common",
      item: commandBanner,
    },
  ];

  // Show up to 6 items, filter based on affordability to ensure at least 3 options
  const affordable = catalog.filter((i) => i.cost <= coins);
  if (affordable.length >= 3) return affordable.slice(0, 6);
  return catalog.slice(0, 6);
};
