import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, Gamepad, Sword, Trophy } from "lucide-react";
import { GameInviteResponse } from "@/services/GameInviteService";

interface GameInviteNotificationProps {
  invite: GameInviteResponse;
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onClose: (inviteId: string) => void;
}

const GameInviteNotification: React.FC<GameInviteNotificationProps> = ({
  invite,
  onAccept,
  onDecline,
  onClose,
}) => {
  const getGameTypeIcon = (gameType: string) => {
    switch (gameType) {
      case "rpg":
        return <Gamepad className="h-4 w-4" />;
      case "pvp-normal":
        return <Sword className="h-4 w-4" />;
      case "pvp-ranked":
        return <Trophy className="h-4 w-4" />;
      default:
        return <Sword className="h-4 w-4" />;
    }
  };

  const getGameTypeName = (gameType: string) => {
    switch (gameType) {
      case "rpg":
        return "RPG Adventure";
      case "pvp-normal":
        return "Normal PvP";
      case "pvp-ranked":
        return "Ranked PvP";
      default:
        return "Chess Match";
    }
  };

  return (
    <Card className="w-80 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getGameTypeIcon(invite.gameType)}
            <CardTitle className="text-lg">Game Invite</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClose(invite.id)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          {invite.fromUsername} invited you to play {getGameTypeName(invite.gameType)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Game Type:</span>
          <Badge variant={invite.isRanked ? "default" : "secondary"}>
            {getGameTypeName(invite.gameType)}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Match Type:</span>
          <Badge variant={invite.isRanked ? "default" : "outline"}>
            {invite.isRanked ? "Ranked" : "Casual"}
          </Badge>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => onAccept(invite.id)}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecline(invite.id)}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GameInviteNotification;
