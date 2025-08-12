import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { JwtService } from "@/services/JwtService.ts";
import { logger } from '../utils/log';

interface WebSocketContextType {
  client: Client | null;
  isConnected: boolean;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  client: null,
  isConnected: false,
  reconnect: () => {}
});

export const WebSocketProvider = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);
  const stompClient = useRef<Client | null>(null);
  const wsBaseUrl = import.meta.env.DEV ? '/chess-websocket' : 'http://localhost:8081/chess-websocket';

  const createConnection = useCallback(async () => {
    if (isConnecting.current) {
      logger.debug("[WebSocket] Connection already in progress, skipping...");
      return;
    }

    try {
      // Deactivate existing client if any
      if (stompClient.current) {
        try {
          await stompClient.current.deactivate();
        } catch (error) {
          logger.error("[WebSocket] Error deactivating existing client:", error);
        }
      }

      isConnecting.current = true;
      const wsUrl = `${wsBaseUrl}/chess-websocket`;
      logger.debug("[WebSocket] Connecting to:", wsUrl);

      const client = new Client({
        webSocketFactory: () => new WebSocket(wsUrl),
        debug: (str) => {
          if (import.meta.env.DEV) {
            logger.debug('[STOMP Debug]:', str);
          }
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      client.onConnect = (frame) => {
        logger.debug("[WebSocket] Connected successfully", frame);
        setIsConnected(true);
        isConnecting.current = false;
        reconnectAttempts.current = 0;
      };

      client.onStompError = (frame) => {
        logger.error("[WebSocket] STOMP error:", frame);
        setIsConnected(false);
        isConnecting.current = false;
      };

      client.onDisconnect = (frame) => {
        logger.debug("[WebSocket] Disconnected:", frame);
        setIsConnected(false);
        isConnecting.current = false;
      };

      client.onWebSocketError = (error) => {
        logger.error("[WebSocket] Connection error:", error);
        setIsConnected(false);
        isConnecting.current = false;
      };

      client.onWebSocketClose = (event) => {
        logger.debug("[WebSocket] Connection closed:", event.code, event.reason);
        setIsConnected(false);
        isConnecting.current = false;
      };

      stompClient.current = client;

      // Get JWT token for authentication
      const token = JwtService.getToken();
      if (!token) {
        logger.error("[WebSocket] No JWT token available");
        isConnecting.current = false;
        return;
      }

      // Add authorization header
      client.connectHeaders = {
        Authorization: `Bearer ${token}`,
      };

      try {
        await client.activate();
      } catch (error) {
        logger.error("[WebSocket] Failed to activate client:", error);
        isConnecting.current = false;
      }
    } catch (error) {
      logger.error("[WebSocket] Error in createConnection:", error);
      isConnecting.current = false;
    }
  }, [wsBaseUrl]);

  const reconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      logger.error("[WebSocket] Max reconnection attempts reached");
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
    logger.debug(`[WebSocket] Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      createConnection();
    }, delay);
  }, [createConnection]);

  const manualReconnect = useCallback(() => {
    logger.debug("[WebSocket] Manual reconnection requested");
    reconnectAttempts.current = 0;
    createConnection();
  }, [createConnection]);

  const disconnect = useCallback(async () => {
    logger.debug("[WebSocket] Cleaning up connection");
    try {
      if (stompClient.current) {
        await stompClient.current.deactivate();
        stompClient.current = null;
      }
      setIsConnected(false);
      isConnecting.current = false;
      reconnectAttempts.current = 0;
    } catch (error) {
      logger.error("[WebSocket] Error during cleanup:", error);
    }
  }, []);

  useEffect(() => {
    createConnection();

    return () => {
      logger.debug("[WebSocket] Cleaning up connection");
      disconnect();
    };
  }, [createConnection, disconnect]);

  // Remove the periodic health check - STOMP heartbeats handle this
  // The health check was potentially causing unnecessary reconnections

  const contextValue: WebSocketContextType = {
    client: stompClient.current,
    isConnected,
    reconnect: manualReconnect,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
