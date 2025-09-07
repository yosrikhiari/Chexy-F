import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { gameSessionService } from '@/services/GameSessionService';
import { userService } from '@/services/UserService';
import { User } from '@/Interfaces/user/User';
import {toast} from "react-toastify";
import loading = toast.loading;

interface SpectatorListProps {
  gameId: string;
  className?: string;
}

const SpectatorsList :  React.FC<SpectatorListProps> = ({gameId, className = ""}) => {
  const [Spectators, setSpectators] = useState<User[]>([]);
  const [Loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpectators = async () => {
      try {
        setLoading(true);
        const spectatorIds = await gameSessionService.getSpectators(gameId);

        const spectatorPromises = spectatorIds.map(async (spectatorId) => {
          try {
            return await userService.getByUserId(spectatorId);
          } catch (error) {
            console.error(`Failed to fetch spectator ${spectatorId}:`, error);
            return null;
          }
        });
        const spectateUsers = (await Promise.all(spectatorPromises)).filter(Boolean) as User[];
        setSpectators(spectateUsers);
      }
      catch (error) {
      console.error(`Failed to fetch spectators ${error}`);
      setSpectators([]);
      }
      finally{
        setLoading(false);
      }
    };
    fetchSpectators();

    const interval = setInterval(() => {fetchSpectators()}, 10000);
    return () => {clearInterval(interval);};
  },[gameId]);
  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>👁️</span>
          Spectators
          <Badge variant="secondary" className="text-xs">
            {Spectators.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Loading spectators...
          </p>
        ) : Spectators.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No spectators yet
          </p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {Spectators.map((spectator) => (
              <div
                key={spectator.id}
                className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs">👤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{spectator.username}</p>
                  <p className="text-xs text-muted-foreground">{spectator.points} pts</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpectatorsList;
