import { User } from "@/Interfaces/user/User";
import { JwtService } from "./JwtService";

export class UserService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async getCurrentUser(keycloakId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/current?keycloakId=${keycloakId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get user");
    return await response.json();
  }

  async updateUserProfile(updateData: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(updateData),
    });
    if (!response.ok) throw new Error("Failed to update profile");
    return await response.json();
  }

  async getUserByUsername(username: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/username/${username}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get user");
    return await response.json();
  }

  async getUserByEmail(email: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/email/${email}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get user");
    return await response.json();
  }

  async getByUserId(Id: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/id/${Id}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get user");
    return await response.json();
  }

  async createUser(user: User): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error("Failed to create user");
    return await response.json();
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/update/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(updateData),
    });
    if (!response.ok) throw new Error("Failed to update user");
    return await response.json();
  }

  async deactivateUser(userId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user/deactivate?id=${userId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to deactivate user");
  }

  async deleteUser(userId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user?id=${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to delete user");
  }

  async getAllActiveUsers(): Promise<User[]> {
    const response = await fetch(`${this.baseUrl}/user/all-active`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get active users");
    return await response.json();
  }

  async getLeaderboard(limit: number = 10): Promise<User[]> {
    const response = await fetch(`${this.baseUrl}/user/leaderboard?limit=${limit}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get leaderboard");
    return await response.json();
  }

  async updateUserPoints(userId: string, points: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user/points?userId=${userId}&points=${points}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to update points");
  }
}

export const userService = new UserService();
