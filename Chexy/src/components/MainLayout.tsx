import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import FriendsSidebar from "./FriendsSidebar";
import { Button } from "@/components/ui/button";

const MainLayout: React.FC = () => {
  const [isFriendsSidebarCollapsed, setIsFriendsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  console.log("MainLayout render:", { isFriendsSidebarCollapsed });

  const toggleFriendsSidebar = () => {
    setIsFriendsSidebarCollapsed(!isFriendsSidebarCollapsed);
  };

  // Don't show header on game pages
  const isGamePage = location.pathname.includes('/game/');

  return (
    <div className="min-h-screen bg-mystical-gradient flex flex-col">
      {/* Fantasy Header */}
      {!isGamePage && (
        <header className="bg-card/80 backdrop-blur-sm border-b border-border/50 mystical-glow flex-shrink-0">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo Section */}
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 flex items-center justify-center cursor-pointer"
                  onClick={() => navigate('/game-select')}
                >
                  <img
                    src="/chexy-logo.png"
                    alt="Chexy"
                    className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,193,7,0.6)]"
                  />
                </div>
                <div>
                  <h1 className="font-medieval text-xl font-bold text-primary animate-float">
                    Chexy
                  </h1>
                  <p className="text-xs text-muted-foreground font-elegant">
                    Strategic Chess
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/game-select')}
                  className="fantasy-button font-elegant"
                >
                  Arena
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/leaderboard')}
                  className="fantasy-button font-elegant"
                >
                  Hall of Fame
                </Button>
              </nav>

              {/* Mobile Menu Button */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFriendsSidebar}
                  className="fantasy-button"
                >
                  <span className="font-medieval">☰</span>
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main content area - simple scrolling */}
      <main className={`flex-1 transition-all duration-300 ${isFriendsSidebarCollapsed ? 'mr-12' : 'mr-80'}`}>
        <Outlet />
      </main>

      {/* Friends Sidebar */}
      <FriendsSidebar
        isCollapsed={isFriendsSidebarCollapsed}
        onToggleCollapse={toggleFriendsSidebar}
      />
    </div>
  );
};

export default MainLayout;
