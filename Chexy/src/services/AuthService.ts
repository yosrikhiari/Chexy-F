import { LoginRequest } from "@/Interfaces/user/LoginRequest";
import { LoginResponse } from "@/Interfaces/user/LoginResponse";
import { SignupRequest } from "@/Interfaces/user/SignupRequest";
import { SignupResponse } from "@/Interfaces/user/SignupResponse";
import { JwtService } from "./JwtService";

import { API_BASE_URL } from "@/config/env";

export class AuthService {
  baseUrl = API_BASE_URL;

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error("Login failed");
    const data: LoginResponse = await response.json();
    localStorage.setItem("token", data.token);
    return data;
  }

  async register(userData: SignupRequest): Promise<SignupResponse> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error("Registration failed");
    return await response.json();
  }

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify({ userId, newPassword }),
    });
    return response.ok;
  }

  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error("Failed to send reset request");
  }

  isLoggedIn(): boolean {
    const token = JwtService.getToken();
    return !!token && !JwtService.isTokenExpired(token);
  }

  logout(): void {
    JwtService.removeToken();
    localStorage.removeItem("user");
  }
}

export const authService = new AuthService();
