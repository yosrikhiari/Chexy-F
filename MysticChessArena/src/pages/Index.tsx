import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft,
  User as UserIcon
  , Users } from "lucide-react";
import {JwtService} from "@/services/JwtService.ts";
import {userService} from "@/services/UserService.ts";
import ChessGameLayoutOverride from "@/components/InterfacesService/ChessGameLayout.tsx";
import { User } from "@/Interfaces/user/User";


const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Get game mode from location state
  const isRankedMatch = location.state?.isRankedMatch || false;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = JwtService.getToken();
        if (!token || JwtService.isTokenExpired(token)) {
          // Redirect to login if no valid token
          navigate("/login");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (keycloakId) {
          const userData = await userService.getCurrentUser(keycloakId);
          setUser(userData);
        } else {
          // Fallback to default user if keycloakId is missing
          setUser({ username: "Guest", points: 0 } as User);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        // Fallback to localStorage with error handling
        try {
          const storedUser = JSON.parse(localStorage.getItem("user") || '{"username": "Guest", "points": 0}');
          setUser(storedUser as User);
        } catch (parseError) {
          console.error("Failed to parse localStorage user:", parseError);
          setUser({ username: "Guest", points: 0 } as User);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>; // Simple loading state
  }

  return (
    <div className="min-h-screen bg-mystical-gradient">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/game-select")}
              className="flex items-center gap-1"
              aria-label="Back to game selection"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-1"
              aria-label="Go to profile"
            >
              <UserIcon className="h-4 w-4" /> Profile
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/leaderboard")}
              className="flex items-center gap-1"
              aria-label="Go to leaderboard"
            >
              <Users className="h-4 w-4" /> Leaderboard
            </Button>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              Playing as: <span className="font-medium text-primary">{user?.username || "Guest"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Points: <span className="font-medium">{user?.points || 0}</span>
            </p>
          </div>
        </div>
        <ChessGameLayoutOverride className="pt-4 md:pt-8" isRankedMatch={isRankedMatch} />
      </div>
    </div>
  );
};

export default Index;
