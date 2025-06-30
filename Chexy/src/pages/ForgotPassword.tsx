import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/AuthService.ts";

const ForgotPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
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
        title: "Reset request sent",
        description: "If an account exists for this email, a reset link will be sent.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reset request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mystical-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Enter your email to receive a password reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetRequest}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button className="w-full mt-6" type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            Remember your password? <Link to="/login" className="text-primary hover:underline">Login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
