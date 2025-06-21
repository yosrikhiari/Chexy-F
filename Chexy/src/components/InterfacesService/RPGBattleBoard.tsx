import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Sword, Shield, Target, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { RPGGameState, RPGPiece } from "@/Interfaces/types/rpgChess.ts";
import { RPGBattleBoardProps } from "@/Interfaces/RPGBattleBoardProps.ts";
import { EnhancedRPGPiece } from "@/Interfaces/types/enhancedRpgChess.ts";
import { authService } from "@/services/AuthService.ts";
import { rpgGameService } from "@/services/RPGGameService.ts";
import { enhancedRPGService } from "@/services/EnhancedRPGService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { realtimeService } from "@/services/RealtimeService.ts";

const RPGBattleBoard: React.FC<RPGBattleBoardProps> = ({
                                                         gameState,
                                                         objective,
                                                         onBattleComplete,
                                                       }) => {
  const [battlePhase, setBattlePhase] = useState<"setup" | "fighting" | "complete">("setup");
  const [battleProgress, setBattleProgress] = useState(0);
  const [turnsRemaining, setTurnsRemaining] = useState(gameState.turnsRemaining);
  const [currentGameState, setCurrentGameState] = useState<RPGGameState>(gameState);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [selectedDefenderId, setSelectedDefenderId] = useState<string | null>(null);

  // Fetch updated game state on mount or gameId change
  useEffect(() => {
    const fetchGameState = async () => {
      if (!authService.isLoggedIn()) {
        toast.error("Please log in to continue");
        return;
      }

      try {
        const updatedState = await rpgGameService.getRPGGame(currentGameState.gameid);
        setCurrentGameState(updatedState);
        setTurnsRemaining(updatedState.turnsRemaining);
        if (updatedState.isGameOver) {
          setBattlePhase("complete");
          onBattleComplete(updatedState.score > 0); // Positive score = victory
          toast.info(`Game over! Final score: ${updatedState.score}`);
        }
      } catch (err) {
        toast.error(`Failed to load game state: ${(err as Error).message}`);
      }
    };

    fetchGameState();
  }, [currentGameState.gameid, onBattleComplete]);

  // Validate objective alignment
  useEffect(() => {
    if (objective.type !== currentGameState.currentObjective) {
      toast.warn("Objective mismatch detected. Please verify game state.");
    }
  }, [objective.type, currentGameState.currentObjective]);

  const startFight = async () => {
    if (!authService.isLoggedIn()) {
      toast.error("Please log in to start the battle");
      return;
    }

    if (!selectedAttackerId || !selectedDefenderId) {
      toast.error("Please select an attacker and defender");
      return;
    }

    setBattlePhase("fighting");

    try {
      // Get attacker from playerArmy
      const attacker = currentGameState.playerArmy.find(
        (p) => p.id === selectedAttackerId
      ) as EnhancedRPGPiece | undefined;

      // Get defender from enemyArmy
      let defender = currentGameState.enemyArmy?.find(
        (p) => p.id === selectedDefenderId
      ) as EnhancedRPGPiece | undefined;

      if (!attacker || !defender) {
        if (!attacker) {
          toast.error("Invalid attacker selected");
          return;
        }
        // Fallback mock defender
        defender = {
          id: "enemy-fallback",
          type: "knight",
          color: "black",
          name: "Enemy Knight",
          description: "A fierce opponent",
          specialAbility: "Charge",
          hp: 50,
          maxHp: 50,
          attack: 20,
          defense: 15,
          rarity: "common",
          isJoker: false,
          position: { row: 0, col: 0 },
          hasMoved: true,
          pluscurrentHp: 50,
          plusmaxHp: 50,
          plusattack: 20,
          plusdefense: 15,
          pluslevel: 1,
          plusexperience: 0,
        };
      }

      const playerId = JwtService.getKeycloakId();
      if (!playerId) {
        throw new Error("Player ID not found");
      }

      // Resolve combat
      const combatResult = await enhancedRPGService.resolveCombat(
        attacker,
        defender,
        currentGameState.gameid,
        playerId
      );
      setBattleProgress(50);

      // Update game state
      const updatedState = await rpgGameService.getRPGGame(currentGameState.gameid);
      setCurrentGameState(updatedState);
      setTurnsRemaining(updatedState.turnsRemaining);

      // Broadcast state change
      await realtimeService.broadcastGameState(currentGameState.gameid);

      // Handle combat outcome
      const victory = combatResult.defenderDefeated;
      setBattleProgress(100);
      setBattlePhase("complete");
      toast.success(victory ? "Enemy defeated!" : "Battle ended!");

      // End game if victory or out of turns
      const finalState = await rpgGameService.endRPGGame(currentGameState.gameid, victory);
      setCurrentGameState(finalState);
      setTimeout(() => onBattleComplete(victory), 1000);
    } catch (err) {
      toast.error(`Failed to resolve battle: ${(err as Error).message}`);
      setBattlePhase("setup");
    }
  };

  const progressToNextRound = async () => {
    if (!authService.isLoggedIn()) {
      toast.error("Please log in to continue");
      return;
    }

    try {
      const updatedState = await rpgGameService.progressToNextRound(currentGameState.gameid);
      setCurrentGameState(updatedState);
      setTurnsRemaining(updatedState.turnsRemaining);
      setBattlePhase("setup");
      setBattleProgress(0);
      toast.success(`Progressed to Round ${updatedState.currentRound}`);
      await realtimeService.broadcastGameState(currentGameState.gameid);
    } catch (err) {
      toast.error(`Failed to progress to next round: ${(err as Error).message}`);
    }
  };

  const handlePieceSelection = (piece: RPGPiece, isAttacker: boolean) => {
    if (isAttacker) {
      setSelectedAttackerId(piece.id);
      toast.info(`Selected ${piece.name} as attacker`);
    } else {
      setSelectedDefenderId(piece.id);
      toast.info(`Selected ${piece.name} as defender`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Battle Objective */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Battle Objective</CardTitle>
          </div>
          <CardDescription>{objective.description}</CardDescription>
        </CardHeader>
      </Card>

      {/* Battle Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sword className="h-5 w-5 text-red-500" />
              <span className="font-medium">Army Strength</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{currentGameState.playerArmy.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Turns Left</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{turnsRemaining}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-green-500" />
              <span className="font-medium">Round</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{currentGameState.currentRound}</p>
          </CardContent>
        </Card>
      </div>

      {/* Piece Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Your Army</CardTitle>
            <CardDescription>Select an attacker</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {currentGameState.playerArmy.map((piece: RPGPiece) => (
                <li
                  key={piece.id}
                  className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded ${
                    selectedAttackerId === piece.id ? "bg-blue-100" : ""
                  }`}
                  onClick={() => handlePieceSelection(piece, true)}
                >
                  <span>{piece.name} (HP: {piece.hp}, ATK: {piece.attack})</span>
                  {selectedAttackerId === piece.id && (
                    <span className="bg-blue-500 text-white px-2 py-1 rounded">Selected</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enemy Army</CardTitle>
            <CardDescription>Select a defender</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(currentGameState.enemyArmy || []).map((piece: RPGPiece) => (
                <li
                  key={piece.id}
                  className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded ${
                    selectedDefenderId === piece.id ? "bg-red-100" : ""
                  }`}
                  onClick={() => handlePieceSelection(piece, false)}
                >
                  <span>{piece.name} (HP: {piece.hp}, DEF: {piece.defense})</span>
                  {selectedDefenderId === piece.id && (
                    <span className="bg-red-500 text-white px-2 py-1 rounded">Selected</span>
                  )}
                </li>
              ))}
              {(!currentGameState.enemyArmy || currentGameState.enemyArmy.length === 0) && (
                <li className="text-gray-500">No enemies available</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Battle Area */}
      <Card>
        <CardHeader>
          <CardTitle>Battle Arena</CardTitle>
          <CardDescription>
            {battlePhase === "setup" && "Prepare for battle!"}
            {battlePhase === "fighting" && "Battle in progress..."}
            {battlePhase === "complete" && "Battle completed!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64 bg-gradient-to-b from-green-100 to-brown-100 rounded-lg border-2 border-accent/20 flex items-center justify-center">
            <div className="text-center">
              {battlePhase === "setup" && (
                <div>
                  <Sword className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium">Ready for Battle</p>
                  <p className="text-sm text-muted-foreground">Your army stands ready</p>
                </div>
              )}
              {battlePhase === "fighting" && (
                <div>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <Sword className="h-8 w-8 text-blue-500 animate-pulse" />
                    <span className="text-2xl">⚔️</span>
                    <Shield className="h-8 w-8 text-red-500 animate-pulse" />
                  </div>
                  <p className="text-lg font-medium">Battle in Progress</p>
                  <Progress value={battleProgress} className="w-64 mx-auto mt-2" />
                </div>
              )}
              {battlePhase === "complete" && (
                <div>
                  <div className="text-4xl mb-4">🏆</div>
                  <p className="text-lg font-medium">Battle Complete!</p>
                  <p className="text-sm text-muted-foreground">Returning to adventure...</p>
                </div>
              )}
            </div>
          </div>

          {/* Battle Controls */}
          <div className="flex justify-center gap-4">
            {battlePhase === "setup" && (
              <Button
                onClick={startFight}
                size="lg"
                className="bg-primary hover:bg-primary/90"
                disabled={!selectedAttackerId || !selectedDefenderId}
              >
                <Sword className="h-5 w-5 mr-2" />
                Begin Battle
              </Button>
            )}
            {battlePhase === "complete" && (
              <Button
                onClick={progressToNextRound}
                size="lg"
                className="bg-primary hover:bg-primary/90"
              >
                <Target className="h-5 w-5 mr-2" />
                Next Round
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RPGBattleBoard;
