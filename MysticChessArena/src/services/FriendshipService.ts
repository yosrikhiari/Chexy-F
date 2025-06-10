import { Friendship } from "@/Interfaces/types/Friendship";
import { JwtService } from "./JwtService";

export class FriendshipService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  async sendFriendRequest(requesterId: string, recipientId: string): Promise<Friendship> {
    const response = await fetch(`${this.baseUrl}/friendship/request?requesterId=${requesterId}&recipientId=${recipientId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to send friend request");
    return await response.json();
  }

  async acceptFriendRequest(friendshipId: string): Promise<Friendship> {
    const response = await fetch(`${this.baseUrl}/friendship/accept/${friendshipId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to accept friend request");
    return await response.json();
  }

  async declineFriendRequest(friendshipId: string): Promise<Friendship> {
    const response = await fetch(`${this.baseUrl}/friendship/decline/${friendshipId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to decline friend request");
    return await response.json();
  }

  async blockUser(userId: string, userToBlockId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/friendship/block?userId=${userId}&userToBlockId=${userToBlockId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to block user");
  }

  async unblockUser(userId: string, userToUnblockId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/friendship/unblock?userId=${userId}&userToUnblockId=${userToUnblockId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to unblock user");
  }

  async getFriends(userId: string): Promise<Friendship[]> {
    const response = await fetch(`${this.baseUrl}/friendship/friends/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get friends");
    return await response.json();
  }

  async getPendingRequests(userId: string): Promise<Friendship[]> {
    const response = await fetch(`${this.baseUrl}/friendship/pending/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get pending requests");
    return await response.json();
  }

  async getSentRequests(userId: string): Promise<Friendship[]> {
    const response = await fetch(`${this.baseUrl}/friendship/sent/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get sent requests");
    return await response.json();
  }

  async getBlockedUsers(userId: string): Promise<Friendship[]> {
    const response = await fetch(`${this.baseUrl}/friendship/blocked/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get blocked users");
    return await response.json();
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/friendship/remove/${userId}/${friendId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) {
      throw new Error("Failed to remove friend");
    }
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/friendship/are-friends/${userId1}/${userId2}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to check friendship status");
    return await response.json();
  }
}

export const friendshipService = new FriendshipService();
