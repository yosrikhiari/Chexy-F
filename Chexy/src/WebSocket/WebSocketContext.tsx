import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { JwtService } from "@/services/JwtService.ts";

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

  const createConnection = () => {
    console.log("[WebSocket] Creating new connection...");

    // Clean up existing connection
    if (client) {
      try {
        client.deactivate();
      } catch (error) {
        console.error("[WebSocket] Error deactivating existing client:", error);
      }
    }

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Use clean URL without token - let Vite proxy handle it
    const wsUrl = import.meta.env.DEV ? '/ws' : 'http://localhost:8081/ws';
    console.log("[WebSocket] Connecting to:", wsUrl);

    const socket = new SockJS(wsUrl);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${JwtService.getToken()}`,
        'Content-Type': 'application/json'
      },
      reconnectDelay: 0, // Disable automatic reconnection, we'll handle it manually
      heartbeatIncoming: 20000, // 20 seconds
      heartbeatOutgoing: 20000, // 20 seconds
      debug: (str) => {
        console.log('[STOMP Debug]:', str);
      },
      onConnect: (frame) => {
        console.log("[WebSocket] Connected successfully", frame);
        setClient(stompClient);
        setIsConnected(true);
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      },
      onStompError: (frame) => {
        console.error("[WebSocket] STOMP error:", frame);
        setIsConnected(false);
        handleReconnection();
      },
      onDisconnect: (frame) => {
        console.log("[WebSocket] Disconnected:", frame);
        setIsConnected(false);
        setClient(null);
      },
      onWebSocketError: (error) => {
        console.error("[WebSocket] Connection error:", error);
        setIsConnected(false);
        handleReconnection();
      },
      onWebSocketClose: (event) => {
        console.log("[WebSocket] Connection closed:", event.code, event.reason);
        setIsConnected(false);
        setClient(null);

        // Only attempt reconnection for unexpected closures
        if (event.code !== 1000) { // 1000 = normal closure
          handleReconnection();
        }
      }
    });

    // Add beforeConnect handler to ensure fresh token
    stompClient.beforeConnect = () => {
      const token = JwtService.getToken();
      if (!token) {
        console.error("[WebSocket] No JWT token available");
        return Promise.reject(new Error("No authentication token"));
      }
      stompClient.connectHeaders = {
        ...stompClient.connectHeaders,
        Authorization: `Bearer ${token}`
      };
      return Promise.resolve();
    };

    try {
      stompClient.activate();
    } catch (error) {
      console.error("[WebSocket] Failed to activate client:", error);
      handleReconnection();
    }

    return stompClient;
  };

  const handleReconnection = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnection attempts reached");
      return;
    }

    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttempts.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff, max 30s

    console.log(`[WebSocket] Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      createConnection();
    }, delay);
  };

  const reconnect = () => {
    console.log("[WebSocket] Manual reconnection requested");
    reconnectAttempts.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    createConnection();
  };

  useEffect(() => {
    const stompClient = createConnection();

    return () => {
      console.log("[WebSocket] Cleaning up connection");

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (stompClient && stompClient.connected) {
        try {
          stompClient.deactivate();
        } catch (error) {
          console.error("[WebSocket] Error during cleanup:", error);
        }
      }
      setIsConnected(false);
      setClient(null);
    };
  }, []);

  // Remove the periodic health check - STOMP heartbeats handle this
  // The health check was potentially causing unnecessary reconnections

  return (
    <WebSocketContext.Provider value={{ client, isConnected, reconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
