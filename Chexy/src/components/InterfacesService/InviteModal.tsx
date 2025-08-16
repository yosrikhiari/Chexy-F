import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad, Sword, Trophy, Users } from "lucide-react";
import { GameMode } from "@/Interfaces/enums/GameMode";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  onSelectGameType: (gameType: string, mode: GameMode, isRanked: boolean) => void;
  friendName: string;
}

const InviteModal: React.FC<InviteModalProps> = ({
  open,
  onClose,
  onSelectGameType,
  friendName,
}) => {
  const gameTypes = [
    {
      id: "rpg",
      title: "RPG Adventure",
      description: "Embark on a cooperative roguelike chess journey",
      icon: <Gamepad className="h-8 w-8" />,
      mode: "MULTIPLAYER_RPG" as GameMode,
      isRanked: false,
    },
    {
      id: "pvp-normal",
      title: "Normal PvP",
      description: "Play a standard game of chess against your friend",
      icon: <Sword className="h-8 w-8" />,
      mode: "CLASSIC_MULTIPLAYER" as GameMode,
      isRanked: false,
    },
    {
      id: "pvp-ranked",
      title: "Ranked PvP",
      description: "Test your skills in a ranked match with points at stake",
      icon: <Trophy className="h-8 w-8" />,
      mode: "CLASSIC_MULTIPLAYER" as GameMode,
      isRanked: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">
            Invite {friendName} to Play
          </DialogTitle>
          <DialogDescription className="text-center">
            Choose the type of game you want to play with {friendName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gameTypes.map((gameType) => (
              <Card
                key={gameType.id}
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
                onClick={() => onSelectGameType(gameType.id, gameType.mode, gameType.isRanked)}
              >
                <CardHeader>
                  <div className="flex justify-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      {gameType.icon}
                    </div>
                  </div>
                  <CardTitle className="text-center text-lg">{gameType.title}</CardTitle>
                  <CardDescription className="text-center text-sm">
                    {gameType.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center text-sm text-primary">
                    {gameType.isRanked ? (
                      <Trophy className="mr-1 h-4 w-4" />
                    ) : (
                      <Users className="mr-1 h-4 w-4" />
                    )}
                    {gameType.isRanked ? "Ranked Match" : "Casual Match"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteModal;
