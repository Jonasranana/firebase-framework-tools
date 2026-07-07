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
import IP5Energie from "@/pages/IP5Energie";
import { ArticlesList, ArticleDetail } from "@/pages/Articles";
import { MentionsLegales, Confidentialite } from "@/pages/Legal";
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
      {/* La landing IP5 Énergie est la page d'accueil ; /ip5-energie reste
          en alias pour les liens déjà partagés. L'app voitures vit sur /autos. */}
      <Route path="/" component={IP5Energie} />
      <Route path="/ip5-energie" component={IP5Energie} />
      <Route path="/articles" component={ArticlesList} />
      <Route path="/articles/:slug" component={ArticleDetail} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/confidentialite" component={Confidentialite} />
      <Route path="/autos" component={Home} />
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
