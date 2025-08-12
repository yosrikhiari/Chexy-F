import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

export const AuthStatus: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <Badge variant="secondary">Loading...</Badge>;
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default">Authenticated</Badge>
        {user && (
          <span className="text-sm text-muted-foreground">
            {user.preferred_username || user.email}
          </span>
        )}
      </div>
    );
  }

  return <Badge variant="destructive">Not Authenticated</Badge>;
};
