import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import IP5Energie from "@/pages/IP5Energie";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Chargées à la demande : la page d'accueil (IP5 Énergie) reste légère, le
// reste du code (articles, pages légales, app voitures historique) n'est
// téléchargé que si le visiteur s'y rend.
const ArticlesList = lazy(() =>
  import("@/pages/Articles").then((m) => ({ default: m.ArticlesList })),
);
const ArticleDetail = lazy(() =>
  import("@/pages/Articles").then((m) => ({ default: m.ArticleDetail })),
);
const MentionsLegales = lazy(() =>
  import("@/pages/Legal").then((m) => ({ default: m.MentionsLegales })),
);
const Confidentialite = lazy(() =>
  import("@/pages/Legal").then((m) => ({ default: m.Confidentialite })),
);
// Pages du site IP5 Énergie (multi-pages). L'accueil (IP5Energie) est chargé
// d'emblée ; les pages intérieures sont chargées à la demande.
const PompeAChaleur = lazy(() => import("@/pages/PompeAChaleur"));
const Aides = lazy(() => import("@/pages/Aides"));
const Realisations = lazy(() => import("@/pages/Realisations"));
const Contact = lazy(() => import("@/pages/Contact"));
// Outil interne privé (accès Google restreint) — non lié depuis le site public.
const OutilDevis = lazy(() => import("@/pages/OutilDevis"));
const Home = lazy(() => import("@/pages/Home"));
const CarDetails = lazy(() => import("@/pages/CarDetails"));
const ListCar = lazy(() => import("@/pages/ListCar"));
const MyBookings = lazy(() => import("@/pages/MyBookings"));

const PageSpinner = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function Router() {
  const { isLoading } = useAuth();

  // Show loading spinner while checking auth status to prevent flicker
  if (isLoading) {
    return <PageSpinner />;
  }

  return (
    <Suspense fallback={<PageSpinner />}>
      <Switch>
        {/* La landing IP5 Énergie est la page d'accueil ; /ip5-energie reste
            en alias pour les liens déjà partagés. L'app voitures vit sur /autos. */}
        <Route path="/" component={IP5Energie} />
        <Route path="/ip5-energie" component={IP5Energie} />
        <Route path="/pompe-a-chaleur" component={PompeAChaleur} />
        <Route path="/aides" component={Aides} />
        <Route path="/realisations" component={Realisations} />
        <Route path="/contact" component={Contact} />
        <Route path="/articles" component={ArticlesList} />
        <Route path="/articles/:slug" component={ArticleDetail} />
        <Route path="/mentions-legales" component={MentionsLegales} />
        <Route path="/confidentialite" component={Confidentialite} />
        {/* Espace Pro — accès restreint par connexion Google (2 comptes) */}
        <Route path="/espace-pro" component={OutilDevis} />
        <Route path="/outil-devis" component={OutilDevis} />
        <Route path="/autos" component={Home} />
        <Route path="/cars/:id" component={CarDetails} />
        <Route path="/list-car" component={ListCar} />
        <Route path="/my-bookings" component={MyBookings} />
        <Route path="/my-cars" component={ListCar} /> {/* Alias for now */}
        <Route path="/profile" component={MyBookings} /> {/* Alias for now */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
