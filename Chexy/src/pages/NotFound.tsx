import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full bg-mystical-gradient flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Logo Section */}
        <div className="mb-8">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <img 
              src="/chexy-logo.png" 
              alt="Chexy" 
              className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(255,193,7,0.7)]"
            />
          </div>
          <h1 className="font-medieval text-3xl font-bold text-primary mb-2 animate-float">
            Chexy
          </h1>
        </div>

        {/* 404 Content */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-8 border-2 border-border/50 mystical-glow">
          <h2 className="font-medieval text-6xl text-primary mb-4">404</h2>
          <h3 className="font-medieval text-2xl text-primary mb-4">Page Not Found</h3>
          <p className="text-muted-foreground font-elegant mb-8">
            The mystical realm you seek has vanished into the void. 
            Perhaps it was never meant to be discovered...
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={() => navigate("/game-select")}
              className="w-full fantasy-button font-elegant text-lg py-3"
            >
              Return to the Arena
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate("/login")}
              className="w-full fantasy-button font-elegant"
            >
              Enter the Realm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
