import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/AuthService.ts";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Missing email",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      toast({
        title: "Reset link sent",
        description: "Check your email for password reset instructions",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "An error occurred while sending reset link",
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
            <CardTitle className="font-medieval text-2xl text-primary">Recover Your Rune</CardTitle>
            <CardDescription className="font-elegant">
              We'll send a mystical scroll to restore your access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                  >
                    Scroll Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your mystical scroll address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>
              <Button 
                className="w-full mt-6 fantasy-button font-elegant text-lg py-3" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? "Sending Scroll..." : "Send Recovery Scroll"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm font-elegant">
                <Link to="/login" className="text-primary hover:underline">Return to the Arena</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
