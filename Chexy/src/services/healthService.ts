import { API_BASE_URL } from "@/config/env";
import SockJS from "sockjs-client";

export class HealthService {
  baseUrl = API_BASE_URL;

  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/actuator/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Health] Backend health check successful:', data);
        return true;
      } else {
        console.error('[Health] Backend health check failed:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('[Health] Backend health check error:', error);
      return false;
    }
  }

  async checkWebSocketEndpoint(): Promise<boolean> {
    try {
      // Try to connect to the SockJS endpoint
      const sockJsUrl = import.meta.env.DEV ? '/chess-websocket' : 'http://localhost:8081/chess-websocket';
      const sock = new SockJS(sockJsUrl);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          sock.close();
          console.error('[Health] SockJS connection timeout');
          resolve(false);
        }, 5000);

        sock.onopen = () => {
          clearTimeout(timeout);
          sock.close();
          console.log('[Health] SockJS endpoint is accessible');
          resolve(true);
        };

        sock.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[Health] SockJS endpoint error:', error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('[Health] SockJS health check error:', error);
      return false;
    }
  }
}

export const healthService = new HealthService();
