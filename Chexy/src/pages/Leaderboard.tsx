import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  List,
  Search,
  Trophy,
  UserPlus,
  ArrowLeft,
  User as UserIcon
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";

import { User } from "@/Interfaces/user/User";
import { Friendship } from "@/Interfaces/types/Friendship";
import {JwtService} from "@/services/JwtService.ts";
import {userService} from "@/services/UserService.ts";
import {friendshipService} from "@/services/FriendshipService.ts";
import {gameSessionService} from "@/services/GameSessionService.ts";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [leaderboardUsers, setLeaderboardUsers] = useState<User[]>([]);
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = JwtService.getToken();
        if (!token) {
          toast({
            title: "Authentication Required",
            description: "Please log in to access the leaderboard",
            variant: "destructive",
          });
          navigate("/login");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) {
          throw new Error("Failed to get Keycloak ID from token");
        }

        const [userResponse, leaderboardResponse, friendsResponse] = await Promise.all([
          userService.getCurrentUser(keycloakId),
          userService.getLeaderboard(100), // Fetch top 100 players
          friendshipService.getFriends(keycloakId),
        ]);

        setCurrentUser(userResponse);
        setLeaderboardUsers(leaderboardResponse);
        setFriendsList(
          friendsResponse
            .flat()
            .filter((u): u is User => u !== undefined && u.id !== keycloakId)
        );
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        toast({
          title: "Error",
          description: "Failed to load leaderboard data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate, toast]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value.length > 0) {
      try {
        const user = await userService.getUserByUsername(value);
        setFilteredUsers(
          [user].filter((u) => u.id !== currentUser?.id && u.isActive)
        );
      } catch (error) {
        console.error("Error searching users:", error);
        setFilteredUsers([]);
      }
    } else {
      setFilteredUsers([]);
    }
  };

  const handleAddFriend = async (user: User) => {
    if (!currentUser) return;

    try {
      const existingFriendship = await friendshipService.areFriends(currentUser.id, user.id);
      if (existingFriendship) {
        toast({
          title: "Already Friends",
          description: `${user.username} is already your friend`,
        });
        return;
      }

      await friendshipService.sendFriendRequest(currentUser.id, user.id);
      toast({
        title: "Friend Request Sent",
        description: `Friend request sent to ${user.username}`,
      });
      setFriendsList([...friendsList, user]);
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive",
      });
    }
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleChallengePlayer = async (user: User) => {
    if (!currentUser) return;

    try {
      const gameSession = await gameSessionService.createGameSession(
        currentUser.id,
        "CLASSIC_MULTIPLAYER",
        true,
        user.id
      );
      toast({
        title: "Challenge Sent",
        description: `You've challenged ${user.username} to a match`,
      });
      navigate(`/game/${gameSession.gameId}`);
    } catch (error) {
      console.error("Error creating game session:", error);
      toast({
        title: "Error",
        description: "Failed to create game session",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mystical-gradient flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mystical-gradient p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/game-select")}
            className="flex items-center gap-1 mr-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-bold text-primary">Leaderboard</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-1"
            >
              <UserIcon className="h-4 w-4" /> Profile
            </Button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="text-center mb-6 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary/50 rounded-full mx-auto relative">
            <div className="w-1.5 h-3 bg-primary/70 rounded-full mx-auto mt-2 animate-pulse"></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-elegant">Scroll to see more leaderboard details</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" /> Global Rankings
              </CardTitle>
              <CardDescription>Top players ranked by points</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={user.id === currentUser?.id ? "bg-primary/10" : ""}
                    >
                      <TableCell className="font-medium">#{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/20">
                              {user.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1">
                            <span>{user.username}</span>
                            {user.id === currentUser?.id && (
                              <span className="text-xs bg-primary/30 text-primary px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                            {friendsList.some((f) => f.id === user.id) && (
                              <span className="text-xs bg-green-500/30 text-green-600 px-2 py-0.5 rounded-full">
                                Friend
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{user.points}</TableCell>
                      <TableCell className="text-right">
                        {user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChallengePlayer(user)}
                          >
                            Challenge
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Search and Friends Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" /> Friends & Search
              </CardTitle>
              <CardDescription>Find players and manage friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search players..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => setIsSearchOpen(true)}
                    />
                  </div>
                </div>

                {isSearchOpen && searchQuery.length > 0 && (
                  <div className="absolute w-full z-10 mt-1 bg-background rounded-md border shadow-md">
                    <Command>
                      <CommandList>
                        <CommandGroup heading="Players">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                              <CommandItem
                                key={user.id}
                                className="flex items-center justify-between p-2"
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary/20">
                                      {user.username.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div>{user.username}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {user.points} points
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                  onClick={() => handleAddFriend(user)}
                                >
                                  <UserPlus className="h-3 w-3" /> Add
                                </Button>
                              </CommandItem>
                            ))
                          ) : (
                            <CommandEmpty>No players found</CommandEmpty>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <h3 className="font-medium mb-3">Your Friends</h3>
                {friendsList.length > 0 ? (
                  <div className="space-y-3">
                    {friendsList.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/20">
                              {friend.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{friend.username}</div>
                            <div className="text-xs text-muted-foreground">
                              {friend.points} points
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChallengePlayer(friend)}
                        >
                          Challenge
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>You haven't added any friends yet</p>
                    <p className="text-sm">Search for players to add them</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
