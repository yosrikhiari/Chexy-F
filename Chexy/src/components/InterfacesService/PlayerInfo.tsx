import React from "react";
import { cn } from "@/lib/utils.ts";
import { PlayerInfoProps } from "@/Interfaces/PlayerInfoProps.ts";

const PlayerInfo: React.FC<PlayerInfoProps> = ({
                                                 name,
                                                 points,
                                                 color,
                                                 isCurrentPlayer,
                                                 className,
                                               }) => {
  return (
    <div
      className={cn(
        "py-2 px-4 rounded-lg text-center font-medium transition-all duration-200",
        isCurrentPlayer ? "bg-primary/20 ring-2 ring-primary scale-105" : "bg-secondary/50",
        className
      )}
    >
      <div className="text-sm text-muted-foreground mb-1">
        {color === "white" ? "White" : "Black"}
      </div>
      <div className="text-md md:text-lg truncate">{name}</div>
      <div className="text-xs text-muted-foreground">Points: {points}</div>
    </div>
  );
};

export default PlayerInfo;
