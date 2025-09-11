// ChexyFront/Chexy/src/components/InterfacesService/SpectatorList.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { gameSessionService } from '@/services/GameSessionService';
import { userService } from '@/services/UserService';
import { User } from '@/Interfaces/user/User';
import { useWebSocket } from '@/WebSocket/WebSocketContext';

interface SpectatorListProps {
  gameId: string;
  className?: string;
}

const SpectatorsList: React.FC<SpectatorListProps> = ({ gameId, className = "" }) => {
  const [spectators, setSpectators] = useState<User[]>([]);
  const [Loading, setLoading] = useState(true);
  const { client: stompClient } = useWebSocket();

  const resolveUsers = async (ids: string[]) => {
    const promises = ids.map(async (id) => {
      try { return await userService.getByUserId(id); } catch { return null; }
    });
    return (await Promise.all(promises)).filter(Boolean) as User[];
  };

  useEffect(() => {
    const fetchSpectators = async () => {
      try {
        setLoading(true);
        const ids = await gameSessionService.getSpectators(gameId);
        setSpectators(await resolveUsers(ids));
      } catch (e) {
        console.error('Failed to fetch spectators', e);
        setSpectators([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSpectators();

    // Fallback polling
    const interval = setInterval(fetchSpectators, 10000);

    // Live updates
    let sub: any | null = null;
    if (stompClient) {
      sub = stompClient.subscribe(`/topic/spectator-list/${gameId}`, async (message: any) => {
        try {
          const payload = JSON.parse(message.body);
          const ids: string[] = payload.spectators || [];
          setSpectators(await resolveUsers(ids));
        } catch {}
      });
    }

    return () => {
      clearInterval(interval);
      if (sub) sub.unsubscribe();
    };
  }, [gameId, stompClient]);

  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>👁️</span>
          Spectators
          <Badge variant="secondary" className="text-xs">
            {spectators.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {Loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Loading spectators...
          </p>
        ) : spectators.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No spectators yet
          </p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {spectators.map((spectator) => (
              <div key={spectator.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
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
