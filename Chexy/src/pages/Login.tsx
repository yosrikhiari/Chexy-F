import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/AuthService.ts";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.login({ emailAddress: email, password });
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "Login successful",
        description: `Welcome to Chexy, ${data.user.username}!`,
      });
      navigate("/game-select");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-mystical-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
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

        <Card className="bg-card/80 backdrop-blur-sm border-2 border-border/50 mystical-glow">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-medieval text-2xl text-primary">Enter the Realm</CardTitle>
            <CardDescription className="font-elegant">
              Present your credentials to access the mystical arena
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                  >
                    Scroll Address
                  </label>
                  <Input
                    id="email"
                    placeholder="Enter your mystical scroll address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                  >
                    Secret Rune
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your secret rune"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>
              <Button 
                className="w-full mt-8 fantasy-button font-elegant text-lg py-3" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? "Summoning..." : "Enter the Arena"}
              </Button>
            </form>
            
            <div className="mt-6 space-y-3 text-center">
              <p className="text-sm font-elegant">
                New to the realm? <Link to="/register" className="text-primary hover:underline font-medium">Join the Order</Link>
              </p>
              <p className="text-sm font-elegant">
                <Link to="/forgot-password" className="text-primary hover:underline">Forgot your rune?</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
