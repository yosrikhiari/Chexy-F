import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield } from "lucide-react";
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
    <div className="min-h-screen bg-mystical-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Join the Mystic Chess Arena</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="firstname"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  First Name
                </label>
                <Input
                  id="firstname"
                  placeholder="Enter your first name"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="lastname"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Last Name
                </label>
                <Input
                  id="lastname"
                  placeholder="Enter your last name"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Username
                </label>
                <Input
                  id="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
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
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button className="w-full mt-6" type="submit" disabled={isLoading}>
              {isLoading ? "Verify Mail" : "Sign Up"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
