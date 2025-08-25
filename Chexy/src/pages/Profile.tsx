import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, ArrowLeft, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User } from "@/Interfaces/user/User";

// Define an interface for achievements to ensure type safety
interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  date: string | null;
}

const Profile = () => {
  const navigate = useNavigate();

  // Get user info from localStorage, typed as Partial<User> to account for incomplete data
  const storedUser = localStorage.getItem("user");
  const userInfo: Partial<User> = storedUser
    ? JSON.parse(storedUser)
    : { username: "Guest", points: 0 };

  // Mock achievements data with proper typing
  const achievements: Achievement[] = [
    {
      id: 1,
      title: "First Victory",
      description: "Win your first chess match",
      icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      unlocked: true,
      date: "2025-05-10",
    },
    {
      id: 2,
      title: "Chess Master",
      description: "Win 10 matches",
      icon: <Medal className="h-5 w-5 text-amber-600" />,
      unlocked: (userInfo.points || 0) >= 100, // Use fallback to avoid undefined
      date: (userInfo.points || 0) >= 100 ? "2025-05-14" : null,
    },
    {
      id: 3,
      title: "Strategist",
      description: "Win a match in under 20 moves",
      icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      unlocked: false,
      date: null,
    },
    {
      id: 4,
      title: "RPG Explorer",
      description: "Complete your first RPG adventure",
      icon: <Medal className="h-5 w-5 text-amber-600" />,
      unlocked: false,
      date: null,
    },
    {
      id: 5,
      title: "Ranked Warrior",
      description: "Complete 5 ranked matches",
      icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      unlocked: false,
      date: null,
    },
  ];

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
          <h1 className="text-3xl font-bold text-primary">Player Profile</h1>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/leaderboard")}
              className="flex items-center gap-1"
            >
              <Users className="h-4 w-4" /> Leaderboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarFallback className="text-2xl bg-primary/20">
                    {userInfo.username?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-2xl">
                  {userInfo.username || "Guest"}
                </CardTitle>
                <CardDescription>Mystic Chess Player</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="bg-muted p-4 rounded-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Points
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {userInfo.points || 0}
                  </p>
                </div>

                <div className="bg-muted p-4 rounded-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Achievements Unlocked
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {achievements.filter((a) => a.unlocked).length}/
                    {achievements.length}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/game-select")}
                >
                  Play More Games
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Achievements Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" /> Achievements
              </CardTitle>
              <CardDescription>
                Complete various tasks to unlock achievements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {achievements.map((achievement, index) => (
                  <div key={achievement.id}>
                    <div
                      className={`flex items-center gap-4 p-3 rounded-md ${
                        achievement.unlocked ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          achievement.unlocked
                            ? "bg-primary/20"
                            : "bg-muted-foreground/20"
                        }`}
                      >
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{achievement.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {achievement.description}
                        </p>
                      </div>
                      <div className="text-right">
                        {achievement.unlocked ? (
                          <div>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                              Unlocked
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {achievement.date}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded-full">
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                    {index < achievements.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Profile Sections */}
        <div className="mt-8 space-y-6">
          {/* Game Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Game Statistics
              </CardTitle>
              <CardDescription>
                Your performance metrics and game history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted p-4 rounded-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">Games Played</p>
                  <p className="text-2xl font-bold text-primary">24</p>
                </div>
                <div className="bg-muted p-4 rounded-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
                  <p className="text-2xl font-bold text-primary">68%</p>
                </div>
                <div className="bg-muted p-4 rounded-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">Best Streak</p>
                  <p className="text-2xl font-bold text-primary">7</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🕒 Recent Activity
              </CardTitle>
              <CardDescription>
                Your latest games and achievements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-lg">♟️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Won against AI Master</h3>
                    <p className="text-sm text-muted-foreground">Classic Match • 2 hours ago</p>
                  </div>
                  <span className="text-sm text-primary font-medium">+15 pts</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                    <span className="text-lg">⚔️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Completed RPG Chapter 1</h3>
                    <p className="text-sm text-muted-foreground">RPG Adventure • 1 day ago</p>
                  </div>
                  <span className="text-sm text-accent font-medium">+25 pts</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                  <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center">
                    <span className="text-lg">🏆</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Ranked Match Victory</h3>
                    <p className="text-sm text-muted-foreground">Ranked Match • 3 days ago</p>
                  </div>
                  <span className="text-sm text-secondary-foreground font-medium">+20 pts</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings & Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚙️ Settings & Preferences
              </CardTitle>
              <CardDescription>
                Customize your gaming experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-secondary-foreground">Game Preferences</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sound Effects</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">On</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Music</span>
                      <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded-full">Off</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Animations</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">On</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-secondary-foreground">Privacy</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Profile Visibility</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Public</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Game History</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Public</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Online Status</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Visible</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
