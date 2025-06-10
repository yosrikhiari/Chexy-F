import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sword, Shield, Heart, Zap, ShoppingCart, Coins, Crown, Star, Sparkles } from "lucide-react";
import { EnhancedGameState, DynamicBoardModifier } from "@/Interfaces/types/enhancedRpgChess";
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
import { AIService } from "@/services/aiService";

const RPGAdventure = () => {
  const navigate = useNavigate();
  const userInfo = JSON.parse(localStorage.getItem("user") || '{"name": "Guest", "id": "guest"}');

  const [gameState, setGameState] = useState<EnhancedGameState | null>(null);
  const [gamePhase, setGamePhase] = useState<"preparation" | "battle" | "draft" | "shop">("preparation");
  const [availableRewards, setAvailableRewards] = useState<DynamicBoardModifier[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);

  // Initialize game state with backend
  useEffect(() => {
    const initializeGame = async () => {
      try {
        const newGameId = `game_${Date.now()}`;
        const rpgGameState = await rpgGameService.createRPGGame(userInfo.id, newGameId);
        const enhancedState: EnhancedGameState = {
          ...rpgGameState,
          gameid: newGameId, // Use consistent gameId property
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
      } catch (error) {
        console.error("Failed to initialize game:", error);
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
      const items = await rpgGameService.getRPGGame(gameState.gameid).then((state) => {
        // Placeholder: Fetch shop items from backend or generate locally if service unavailable
        return generateShopItems(state.coins);
      });
      setShopItems(items);
      setGamePhase("shop");
    } catch (error) {
      console.error("Failed to open shop:", error);
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (gameState.coins < item.cost) return;

    try {
      const updatedState = await rpgGameService.purchaseShopItem(gameState.gameid, item.id, userInfo.id);
      setGameState(updatedState as EnhancedGameState);
      setShopItems((prev) => prev.filter((shopItem) => shopItem.id !== item.id));
    } catch (error) {
      console.error("Purchase failed:", error);
    }
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
      // Sync with backend (add a service call if available)
      await rpgGameService.addBoardEffect(gameState.gameid, reward, userInfo.id);
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
      const newGameId = `game_${Date.now()}`;
      const newGameState = await rpgGameService.createRPGGame(userInfo.id, newGameId);
      const enhancedState: EnhancedGameState = {
        ...newGameState,
        gameid: newGameId,
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
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
      <div className="min-h-screen bg-gradient-to-br from-amber-800 via-orange-900 to-red-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Crown className="h-8 w-8 text-yellow-400 animate-pulse" />
              <Sparkles className="h-6 w-6 text-yellow-300" />
            </div>
            <h1 className="text-4xl font-bold text-yellow-300 mb-2 font-serif">🏆 Boss Victory! 🏆</h1>
            <p className="text-amber-200 text-lg">Choose a dynamic battlefield enhancement!</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {availableRewards.map((reward) => (
              <Card
                key={reward.id}
                className="cursor-pointer hover:border-yellow-400 transition-all transform hover:scale-105 bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-300 shadow-lg hover:shadow-xl"
                onClick={() => selectReward(reward)}
              >
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Star className="h-6 w-6 text-yellow-600" />
                  </div>
                  <CardTitle className="text-xl text-amber-900 font-serif">{reward.name}</CardTitle>
                  <CardDescription className="text-amber-700">{reward.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`px-3 py-2 rounded-full text-sm font-bold shadow-md ${
                        reward.rarity === "legendary"
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900"
                          : reward.rarity === "epic"
                            ? "bg-gradient-to-r from-purple-400 to-purple-600 text-white"
                            : reward.rarity === "rare"
                              ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white"
                              : "bg-gradient-to-r from-gray-300 to-gray-500 text-gray-800"
                      }`}
                    >
                      ✨ {reward.rarity.toUpperCase()} ✨
                    </span>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-sm font-bold text-amber-800">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/game-select")}
            className="bg-purple-800/50 hover:bg-purple-700/70 text-white border border-purple-400"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Game Select
          </Button>
          <div className="text-right bg-purple-800/30 p-3 rounded-lg border border-purple-400">
            <p className="text-sm text-purple-200">
              🧙 Adventurer: <span className="font-bold text-yellow-300">{userInfo.name}</span>
            </p>
            <p className="text-xs text-purple-300">⭐ Score: {gameState.score}</p>
            <p className="text-xs text-purple-300">🎯 Difficulty: {gameState.difficulty.toFixed(1)}</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sword className="h-8 w-8 text-yellow-400" />
            <Crown className="h-8 w-8 text-yellow-300" />
            <Shield className="h-8 w-8 text-yellow-400" />
          </div>
          <h1 className="text-5xl font-bold text-yellow-300 mb-2 font-serif">⚔️ RPG Chess Adventure ⚔️</h1>
          <p className="text-purple-200 text-lg">Embark on an epic turn-based roguelike quest!</p>
        </div>

        {/* Game Status */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-red-600 to-red-800 border-red-400 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sword className="h-5 w-5 text-yellow-300" />
                <span className="font-bold text-white">Round</span>
              </div>
              <p className="text-2xl font-bold text-yellow-300">{gameState.currentRound}</p>
              {isBossRound && <p className="text-xs text-red-200 font-bold animate-pulse">👹 BOSS ROUND 👹</p>}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-600 to-yellow-800 border-yellow-400 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Coins className="h-5 w-5 text-yellow-200" />
                <span className="font-bold text-yellow-900">Gold</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{gameState.coins}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-pink-600 border-red-400 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-red-200" />
                <span className="font-bold text-white">Lives</span>
              </div>
              <p className="text-2xl font-bold text-red-200">{gameState.lives}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-blue-200" />
                <span className="font-bold text-white">Board Size</span>
              </div>
              <p className="text-2xl font-bold text-blue-200">{gameState.boardSize}x{gameState.boardSize}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-600 to-green-800 border-green-400 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-green-200" />
                <span className="font-bold text-white">Portals</span>
              </div>
              <p className="text-2xl font-bold text-green-200">{gameState.teleportPortals}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-600 to-purple-800 border-purple-400 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-purple-200" />
                <span className="font-bold text-white">Army</span>
              </div>
              <p className="text-2xl font-bold text-purple-200">
                {armyStats.total}/{gameState.armyCapacity.maxTotalPieces}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Army Capacity Status */}
        <Card className="mb-6 bg-purple-800/50 border-purple-400 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-300 font-serif">🏰 Army Capacity</CardTitle>
            <CardDescription className="text-purple-200">
              🗺️ Board Size: {gameState.boardSize}x{gameState.boardSize} |
              ⚔️ Base Capacity: {gameState.armyCapacity.maxTotalPieces - gameState.armyCapacity.bonusCapacity} |
              ✨ Bonus: +{gameState.armyCapacity.bonusCapacity}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm text-purple-200">
              <div className="bg-purple-700/50 p-2 rounded">
                <span className="font-bold">👑 Queens:</span> {armyStats.queens}/{gameState.armyCapacity.maxQueens}
              </div>
              <div className="bg-purple-700/50 p-2 rounded">
                <span className="font-bold">🏰 Rooks:</span> {armyStats.rooks}/{gameState.armyCapacity.maxRooks}
              </div>
              <div className="bg-purple-700/50 p-2 rounded">
                <span className="font-bold">⛪ Bishops:</span> {armyStats.bishops}/{gameState.armyCapacity.maxBishops}
              </div>
              <div className="bg-purple-700/50 p-2 rounded">
                <span className="font-bold">🐎 Knights:</span> {armyStats.knights}/{gameState.armyCapacity.maxKnights}
              </div>
              <div className="bg-purple-700/50 p-2 rounded">
                <span className="font-bold">⚔️ Pawns:</span> {armyStats.pawns}/{gameState.armyCapacity.maxPawns}
              </div>
              <div className="bg-purple-700/50 p-2 rounded">
                <span className="font-bold">👑 Kings:</span> {armyStats.kings}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Objective */}
        <Card className="mb-6 bg-gradient-to-r from-amber-600 to-orange-700 border-amber-400 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white font-serif">🎯 Current Quest</CardTitle>
            <CardDescription className="text-amber-100">
              📜 Round {gameState.currentRound} - {getCurrentObjective().description}
              {isBossRound && <span className="text-red-300 font-bold animate-pulse"> 👹 (BOSS ROUND) 👹</span>}
              <br />
              <span className="text-xs">🗺️ Current Board Size: {gameState.boardSize}x{gameState.boardSize}</span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Player Army */}
        <Card className="mb-6 bg-blue-800/50 border-blue-400 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-300 font-serif">⚔️ Your Mighty Army</CardTitle>
            <CardDescription className="text-blue-200">
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
          <Card className="mb-6 bg-purple-800/50 border-purple-400 shadow-lg">
            <CardHeader>
              <CardTitle className="text-yellow-300 font-serif">🔮 Active Battlefield Enchantments</CardTitle>
              <CardDescription className="text-purple-200">Mystical modifications affecting the arena</CardDescription>
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
          <Card className="mb-6 bg-green-800/50 border-green-400 shadow-lg">
            <CardHeader>
              <CardTitle className="text-yellow-300 font-serif">💪 Active Army Enhancements</CardTitle>
              <CardDescription className="text-green-200">Upgrades that expand your military might</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(gameState.activeCapacityModifiers || []).map((modifier) => (
                  <div
                    key={modifier.id}
                    className="p-3 bg-gradient-to-br from-green-200 to-green-300 rounded-lg border-2 border-green-500 shadow-md"
                  >
                    <h4 className="font-bold text-green-900">✨ {modifier.name}</h4>
                    <p className="text-sm text-green-700">{modifier.description}</p>
                    <p className="text-xs text-green-600 mt-1 font-semibold">
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
          <Card className="mb-6 bg-indigo-800/50 border-indigo-400 shadow-lg">
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
            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white border-2 border-red-400 shadow-lg transform hover:scale-105 transition-all font-bold text-lg px-8"
          >
            <Sword className="h-5 w-5 mr-2" />
            ⚔️ START ENHANCED BATTLE ⚔️
          </Button>
          <Button
            onClick={openShop}
            variant="outline"
            size="lg"
            className="bg-gradient-to-r from-yellow-600 to-yellow-800 hover:from-yellow-700 hover:to-yellow-900 text-yellow-900 border-2 border-yellow-400 shadow-lg transform hover:scale-105 transition-all font-bold text-lg px-8"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            🛒 ENHANCED SHOP ({gameState.coins} <Coins className="h-4 w-4 ml-1" />)
          </Button>
          <Button
            onClick={resetGame}
            variant="outline"
            size="lg"
            className="bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 text-white border-2 border-gray-400 shadow-lg transform hover:scale-105 transition-all font-bold"
          >
            🔄 Reset Enhanced Adventure
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RPGAdventure;

// Placeholder for generateShopItems (should be defined in utils or fetched from backend)
const generateShopItems = (coins: number): ShopItem[] => {
  // Mock implementation; replace with actual backend call or logic
  return [];
};
