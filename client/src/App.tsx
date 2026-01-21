import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import CarDetails from "@/pages/CarDetails";
import ListCar from "@/pages/ListCar";
import MyBookings from "@/pages/MyBookings";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function Router() {
  const { isLoading } = useAuth();

  // Show loading spinner while checking auth status to prevent flicker
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cars/:id" component={CarDetails} />
      <Route path="/list-car" component={ListCar} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/my-cars" component={ListCar} /> {/* Alias for now */}
      <Route path="/profile" component={MyBookings} /> {/* Alias for now */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
