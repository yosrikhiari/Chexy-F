import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/AuthService';
import { JwtService } from '@/services/JwtService';
import { logger } from '@/utils/log';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  const checkAuthStatus = useCallback(() => {
    try {
      const isLoggedIn = authService.isLoggedIn();
      const token = JwtService.getToken();
      
      if (isLoggedIn && token) {
        const decodedToken = JwtService.decodeToken(token);
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: decodedToken,
        });
        logger.debug('[Auth] User is authenticated');
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
        logger.debug('[Auth] User is not authenticated');
      }
    } catch (error) {
      logger.error('[Auth] Error checking auth status:', error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });
    logger.debug('[Auth] User logged out');
  }, []);

  // Check auth status on mount and when token changes
  useEffect(() => {
    checkAuthStatus();

    // Listen for storage changes (when token is added/removed)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        logger.debug('[Auth] Token storage changed, rechecking auth status');
        checkAuthStatus();
      }
    };

    // Listen for custom auth events
    const handleAuthEvent = () => {
      logger.debug('[Auth] Auth event received, rechecking auth status');
      checkAuthStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authStateChanged', handleAuthEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthEvent);
    };
  }, [checkAuthStatus]);

  return {
    ...authState,
    logout,
    checkAuthStatus,
  };
};
