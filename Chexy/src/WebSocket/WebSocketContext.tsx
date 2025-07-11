import React, { createContext, useContext, useEffect, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { JwtService } from "@/services/JwtService.ts";

interface WebSocketContextType {
  client: Client | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  client: null,
  isConnected: false
});

export const WebSocketProvider = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Use relative URL for WebSocket connection - Vite proxy will handle it
    const wsUrl = import.meta.env.DEV
      ? `/ws?token=${JwtService.getToken()}`
      : `http://localhost:8081/ws?token=${JwtService.getToken()}`;

    const socket = new SockJS(wsUrl);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: { Authorization: `Bearer ${JwtService.getToken()}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (str) => {
        console.log('STOMP Debug:', str);
      },
      onConnect: () => {
        console.log("Global WebSocket connected");
        setClient(stompClient);
        setIsConnected(true);
      },
      onStompError: (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      },
      onDisconnect: () => {
        console.log("Global WebSocket disconnected");
        setIsConnected(false);
      },
      onWebSocketError: (error) => {
        console.error("WebSocket connection error:", error);
        setIsConnected(false);
      }
    });

    stompClient.activate();

    return () => {
      if (stompClient.connected) {
        stompClient.deactivate();
      }
      setIsConnected(false);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ client, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
