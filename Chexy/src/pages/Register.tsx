import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/AuthService.ts";
import { SignupRequest } from "@/Interfaces/user/SignupRequest";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstname.trim() || !lastname.trim() || !username.trim() || !email.trim() || !password.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const userData: SignupRequest = {
        username,
        firstname,
        lastname,
        email,
        password,
      };
      await authService.register(userData);
      toast({
        title: "Registration successful",
        description: "Your account has been created. Please log in.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
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
            <CardTitle className="font-medieval text-2xl text-primary">Join the Order</CardTitle>
            <CardDescription className="font-elegant">
              Forge your destiny in the mystical arena
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="firstname"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                    >
                      Given Name
                    </label>
                    <Input
                      id="firstname"
                      placeholder="Your given name"
                      value={firstname}
                      onChange={(e) => setFirstname(e.target.value)}
                      required
                      className="bg-background/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="lastname"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                    >
                      Family Name
                    </label>
                    <Input
                      id="lastname"
                      placeholder="Your family name"
                      value={lastname}
                      onChange={(e) => setLastname(e.target.value)}
                      required
                      className="bg-background/50 border-border/50 focus:border-primary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                  >
                    Battle Name
                  </label>
                  <Input
                    id="username"
                    placeholder="Choose your battle name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-elegant"
                  >
                    Scroll Address
                  </label>
                  <Input
                    id="email"
                    placeholder="Your mystical scroll address"
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
                    placeholder="Create your secret rune"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>
              <Button 
                className="w-full mt-8 fantasy-button font-elegant text-lg py-3" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? "Forging..." : "Join the Order"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm font-elegant">
              Already a member? <Link to="/login" className="text-primary hover:underline font-medium">Enter the Arena</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
