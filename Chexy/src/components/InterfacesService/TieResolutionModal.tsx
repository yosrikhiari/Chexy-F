import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Flame, Skull, Crown, Eye, Swords } from "lucide-react";
import { TieResolutionOption } from "@/Interfaces/TieResolutionOption.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import {JwtService} from "@/services/JwtService.ts";
import {tieResolutionService} from "@/services/TieResolutionService.ts";
// Realtime broadcasting disabled for RPG games
import {TieResolutionModalProps} from "@/Interfaces/TieResolutionModalProps.ts";

const TieResolutionModal: React.FC<TieResolutionModalProps> = ({
                                                                 isOpen,
                                                                 onResolve,
                                                                 onClose,
                                                                 gameId,
                                                               }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [diceValue, setDiceValue] = useState(1);
  const [selectedOption, setSelectedOption] = useState<TieResolutionOption | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [tieOptions, setTieOptions] = useState<TieResolutionOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Map backend icon strings to Lucide React components
  const getIconComponent = (icon: string): React.ReactNode => {
    switch (icon) {
      case "flame":
        return <Flame className="h-6 w-6 text-orange-500" />;
      case "skull":
        return <Skull className="h-6 w-6 text-purple-500" />;
      case "swords":
        return <Swords className="h-6 w-6 text-red-500" />;
      case "eye":
        return <Eye className="h-6 w-6 text-blue-500" />;
      case "crown":
        return <Crown className="h-6 w-6 text-black" />;
      default:
        return <Flame className="h-6 w-6 text-gray-500" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case "legendary":
        return "border-yellow-400 bg-yellow-50 text-yellow-800";
      case "epic":
        return "border-purple-400 bg-purple-50 text-purple-800";
      case "rare":
        return "border-blue-400 bg-blue-50 text-blue-800";
      default:
        return "border-gray-400 bg-gray-50 text-gray-800";
    }
  };

  // Normalize rarity to the expected union type
  const normalizeRarity = (rarity: string): "common" | "rare" | "epic" | "legendary" => {
    const normalized = rarity.toLowerCase();
    switch (normalized) {
      case "common":
      case "rare":
      case "epic":
      case "legendary":
        return normalized as "common" | "rare" | "epic" | "legendary";
      default:
        console.warn(`Unexpected rarity value: ${rarity}, defaulting to 'common'`);
        return "common";
    }
  };

  // Fetch tie resolution options from backend
  const fetchOptions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check authentication
      const token = JwtService.getToken();
      if (!token || JwtService.isTokenExpired(token)) {
        throw new Error("Please log in to fetch tie resolution options.");
      }

      const options = await tieResolutionService.getAllOptions();
      // Normalize rarity
      const normalizedOptions = options.map((option) => ({
        ...option,
        rarity: normalizeRarity(option.rarity),
      }));
      setTieOptions(normalizedOptions);
    } catch (err) {
      console.error("Failed to fetch tie options:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to load tie resolution options. Using defaults.",
      });
      // Fallback to hardcoded options
      setTieOptions([
        {
          id: "gambit",
          name: "Gambit of the Phoenix",
          flavor: "The ancient Phoenix offers rebirth—at a cost.",
          description: "Sacrifice a piece to turn the tie into victory. The piece returns weaker next round.",
          weight: 4,
          range: "1-4",
          icon: "flame",
          rarity: "common",
        },
        {
          id: "puzzle",
          name: "Puzzle Gauntlet",
          flavor: "The Lich King freezes time—solve his riddle to proceed!",
          description: "Solve a chess puzzle within 15 seconds to claim victory.",
          weight: 2,
          range: "5-6",
          icon: "skull",
          rarity: "legendary",
        },
        {
          id: "showdown",
          name: "Army Showdown",
          flavor: "The armies clash—only the strongest prevail!",
          description: "Compare total piece values. Highest army strength wins.",
          weight: 6,
          range: "7-12",
          icon: "swords",
          rarity: "common",
        },
        {
          id: "oracle",
          name: "Oracle's Bargain",
          flavor: "The Oracle demands a tribute for her prophecy...",
          description: "Draft upgrades and sacrifice one to convert the tie into victory.",
          weight: 3,
          range: "13-15",
          icon: "eye",
          rarity: "rare",
        },
        {
          id: "blood",
          name: "Blood Chess",
          flavor: "The board thirsts—feed it or perish!",
          description: "Lose random pieces until one side cannot move.",
          weight: 5,
          range: "16-20",
          icon: "crown",
          rarity: "epic",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
    }
  }, [isOpen, fetchOptions]);

  // Local tie resolution logic based on dice roll
  const rollD20 = useCallback(async () => {
    setIsRolling(true);
    setShowResult(false);

    // Simulate dice rolling animation
    const rollInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 20) + 1);
    }, 100);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Roll a D20
      const finalRoll = Math.floor(Math.random() * 20) + 1;
      setDiceValue(finalRoll);

      // Find option based on range
      const selected = tieOptions.find((option) => {
        const [min, max] = option.range.split("-").map(Number);
        return finalRoll >= min && finalRoll <= max;
      });

      if (!selected) {
        throw new Error("No tie resolution option found for this roll.");
      }

      const normalizedOption = {
        ...selected,
        rarity: normalizeRarity(selected.rarity),
      };
      setSelectedOption(normalizedOption);
      setShowResult(true);

      // Broadcasting disabled
    } catch (err) {
      console.error("Failed to resolve tie:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to resolve tie. Please try again.",
      });
    } finally {
      clearInterval(rollInterval);
      setIsRolling(false);
    }
  }, [tieOptions, gameId]);

  const handleAccept = useCallback(() => {
    if (selectedOption) {
      try {
        onResolve(selectedOption);
        toast({
          title: "Success",
          description: `Tie resolved with ${selectedOption.name}!`,
        });
      } catch (err) {
        console.error("Failed to apply resolution:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to apply resolution. Please try again.",
        });
      }
    }
  }, [selectedOption, onResolve]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-primary">
            ⚔️ Stalemate Declared! ⚔️
          </DialogTitle>
          <p className="text-center text-muted-foreground">
            The gods of war will decide your fate...
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <p className="text-center text-muted-foreground animate-pulse">
              Loading options...
            </p>
          )}

          {!showResult && !isRolling && !isLoading && (
            <div className="space-y-2">
              <h4 className="font-medium text-center mb-3">Possible Outcomes:</h4>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                {tieOptions.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center gap-2 p-2 rounded border"
                  >
                    {getIconComponent(option.icon)}
                    <div className="flex-1">
                      <span className="font-medium text-sm">{option.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({option.range}) - {option.rarity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showResult && (
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-24 h-24">
                <div
                  className={`text-6xl transition-transform duration-100 ${
                    isRolling ? "animate-spin" : ""
                  }`}
                >
                  🎲
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white drop-shadow-lg">
                    {diceValue}
                  </span>
                </div>
              </div>

              <Button
                onClick={rollD20}
                disabled={isRolling || isLoading}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isRolling ? "Rolling..." : "Roll the D20 of Fate"}
              </Button>

              {isRolling && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  The dice of destiny tumbles through the void...
                </p>
              )}
            </div>
          )}

          {showResult && selectedOption && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">
                  Rolled: {diceValue} 🎲
                </h3>
                <p className="text-sm text-muted-foreground">
                  The fates have chosen...
                </p>
              </div>

              <Card className={`${getRarityColor(selectedOption.rarity)} border-2`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    {getIconComponent(selectedOption.icon)}
                    <div>
                      <CardTitle className="text-lg">{selectedOption.name}</CardTitle>
                      <p className="text-xs opacity-75">
                        Range: {selectedOption.range} | {selectedOption.rarity}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="italic text-sm mb-2">"{selectedOption.flavor}"</p>
                  <p className="text-sm">{selectedOption.description}</p>
                </CardContent>
              </Card>

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={handleAccept}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Accept Fate
                </Button>
                <Button onClick={onClose} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TieResolutionModal;
