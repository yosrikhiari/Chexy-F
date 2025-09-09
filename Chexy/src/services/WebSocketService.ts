import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { GameTimers } from '@/Interfaces/types/chess.ts';

interface PendingSubscription {
  gameId: string;
  onTimerUpdate: (timers: GameTimers) => void;
  onError?: (error: string) => void;
}

export class WebSocketService {
  private stompClient: Stomp.Client | null = null;
  private connected: boolean = false;
  private connecting: boolean = false;
  private subscriptions: Map<string, Stomp.Subscription> = new Map();
  private pendingSubscriptions: PendingSubscription[] = [];
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  connect(gameId: string, onTimerUpdate: (timers: GameTimers) => void, onError?: (error: string) => void) {
    // If already connected, subscribe immediately
    if (this.connected && this.stompClient) {
      this.subscribeToTimer(gameId, onTimerUpdate, onError);
      return;
    }

    // Store the subscription request for when connection is ready
    this.pendingSubscriptions.push({ gameId, onTimerUpdate, onError });

    // If already connecting, don't create another connection
    if (this.connecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    this.establishConnection();
  }

  private establishConnection() {
    if (this.connecting || this.connected) return;

    console.log('Establishing WebSocket connection...');
    this.connecting = true;

    // Clean up any existing connection
    this.cleanup();

    const wsUrl = import.meta.env.DEV ? '/chess-websocket' : 'http://localhost:8081/chess-websocket';
    console.log(`[WebSocket] Connecting to: ${wsUrl}`);
    const socket = new SockJS(wsUrl);
    this.stompClient = Stomp.over(socket);

    // Enable debug logging in development
    this.stompClient.debug = (str) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[STOMP Debug] ${str}`);
      }
    };

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      if (this.connecting) {
        console.error('WebSocket connection timeout');
        this.handleConnectionFailure('Connection timeout');
      }
    }, 10000); // 10 second timeout

    this.stompClient.connect(
      {},
      (frame) => {
        console.log('WebSocket connected successfully:', frame);
        this.onConnectionSuccess();
      },
      (error) => {
        console.error('WebSocket connection failed:', error);
        this.handleConnectionFailure(`Connection error: ${error}`);
      }
    );
  }

  private onConnectionSuccess() {
    this.connected = true;
    this.connecting = false;
    this.reconnectAttempts = 0;

    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Process all pending subscriptions
    const pendingCopy = [...this.pendingSubscriptions];
    this.pendingSubscriptions = [];

    // Add a small delay to ensure the connection is fully established
    setTimeout(() => {
      pendingCopy.forEach(({ gameId, onTimerUpdate, onError }) => {
        this.subscribeToTimer(gameId, onTimerUpdate, onError);
      });
    }, 100);
  }

  private handleConnectionFailure(error: string) {
    this.connected = false;
    this.connecting = false;

    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Notify all pending subscriptions of the error
    this.pendingSubscriptions.forEach(({ onError }) => {
      onError?.(error);
    });

    // Attempt reconnection if within limits
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      setTimeout(() => {
        if (this.pendingSubscriptions.length > 0) {
          this.establishConnection();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.pendingSubscriptions = [];
    }
  }

  private subscribeToTimer(gameId: string, onTimerUpdate: (timers: GameTimers) => void, onError?: (error: string) => void) {
    if (!this.stompClient || !this.connected) {
      const errorMsg = 'Cannot subscribe: WebSocket not connected';
      console.error(errorMsg);
      onError?.(errorMsg);
      return;
    }

    const subscriptionKey = `timer-${gameId}`;

    // Unsubscribe from previous subscription if exists
    const existingSubscription = this.subscriptions.get(subscriptionKey);
    if (existingSubscription) {
      try {
        if (this.stompClient?.connected) {
          existingSubscription.unsubscribe();
        }
      } catch (error) {
        console.warn('Error unsubscribing from existing subscription:', error);
      }
    }

    try {
      // Verify connection state before attempting subscription
      if (!this.stompClient.connected) {
        throw new Error('STOMP client not connected');
      }

      const subscription = this.stompClient.subscribe(
        `/topic/game/${gameId}/timer`,
        (message) => {
          try {
            console.log(`[WebSocket] Received timer message for game ${gameId}:`, message.body);
            const timers: GameTimers = JSON.parse(message.body);
            onTimerUpdate(timers);
          } catch (parseError) {
            console.error('Error parsing timer message:', parseError);
            onError?.('Failed to parse timer update');
          }
        }
      );

      this.subscriptions.set(subscriptionKey, subscription);
      console.log(`Successfully subscribed to timer updates for game: ${gameId}`);
    } catch (subscriptionError) {
      const errorMsg = `Error subscribing to timer updates: ${subscriptionError}`;
      console.error(errorMsg);
      onError?.(errorMsg);

      // If subscription fails, try to reconnect
      this.handleConnectionFailure('Subscription failed');
    }
  }

  disconnect() {
    console.log('Disconnecting WebSocket service...');

    // Clear any pending reconnection attempts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Clear pending subscriptions
    this.pendingSubscriptions = [];

    this.cleanup();
  }

  private cleanup() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((subscription, key) => {
      try {
        if (this.stompClient?.connected) {
          subscription.unsubscribe();
          console.log(`Unsubscribed from ${key}`);
        }
      } catch (error) {
        console.warn(`Error unsubscribing from ${key}:`, error);
      }
    });
    this.subscriptions.clear();

    // Disconnect STOMP client
    if (this.stompClient) {
      try {
        if (this.stompClient.connected) {
          this.stompClient.disconnect(() => {
            console.log('WebSocket disconnected');
          });
        }
      } catch (error) {
        console.warn('Error disconnecting STOMP client:', error);
      } finally {
        this.stompClient = null;
      }
    }

    this.connected = false;
    this.connecting = false;
  }

  isConnected(): boolean {
    return this.connected &&
      this.stompClient?.connected === true;
  }

  // Method to force reconnection
  reconnect() {
    console.log('Forcing WebSocket reconnection...');
    this.reconnectAttempts = 0;
    this.cleanup();

    if (this.pendingSubscriptions.length > 0) {
      this.establishConnection();
    }
  }

  // Get connection status for debugging
  getConnectionStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      stompConnected: this.stompClient?.connected || false,
      subscriptions: this.subscriptions.size,
      pendingSubscriptions: this.pendingSubscriptions.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

export const webSocketService = new WebSocketService();
