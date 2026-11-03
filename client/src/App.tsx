import { lazy, Suspense, type ComponentType } from "react";
import BrandLoader from "@/components/BrandLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import IP5Energie from "@/pages/IP5Energie";


// Page chargée à la demande, mais qu'on peut télécharger à l'avance (preload) :
// une fois téléchargée, elle s'affiche directement, sans écran de chargement.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPage = ComponentType<any>;
function lazyPage(factory: () => Promise<{ default: unknown }>) {
  let Loaded: AnyPage | null = null;
  const preload = (): Promise<unknown> =>
    factory().then((m) => { Loaded = m.default as AnyPage; return m; });
  const Lazy = lazy(preload as () => Promise<{ default: AnyPage }>);
  const Page = (props: any) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />);
  Page.preload = preload;
  return Page;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Chargées à la demande : la page d'accueil (IP5 Énergie) reste légère, le
// reste du code (articles, pages légales, app voitures historique) n'est
// téléchargé que si le visiteur s'y rend.
const ArticlesList = lazyPage(() =>
  import("@/pages/Articles").then((m) => ({ default: m.ArticlesList })),
);
const ArticleDetail = lazyPage(() =>
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
const PompeAChaleur = lazyPage(() => import("@/pages/PompeAChaleur"));
const PacVille = lazyPage(() => import("@/pages/PacVille"));
const ClientSpace = lazy(() => import("@/pages/ClientSpace"));
// Espace client : construit mais PAS publié. Passer à true le jour où il est mis en service
// (et activer crm_settings/client_space côté serveur).
const CLIENT_SPACE_PUBLIC = false;
// Landing pages dédiées aux campagnes publicitaires Meta (Facebook / Instagram).
const CampagnePAC = lazyPage(() => import("@/pages/CampagnePAC"));
const Desinscription = lazy(() => import("@/pages/Desinscription"));
const Avis = lazy(() => import("@/pages/Avis"));
const CampagneSolaire = lazyPage(() => import("@/pages/CampagneSolaire"));
// Landing B2B : stations de gonflage des pneumatiques (CEE TRA-SE-104),
// vendue aux entreprises/collectivités, pas aux particuliers.
const CampagneGonflage = lazy(() => import("@/pages/CampagneGonflage"));
const Aides = lazyPage(() => import("@/pages/Aides"));
const Realisations = lazyPage(() => import("@/pages/Realisations"));
const Contact = lazyPage(() => import("@/pages/Contact"));
// Outil interne privé (accès Google restreint) — non lié depuis le site public.
const OutilDevis = lazy(() => import("@/pages/OutilDevis"));
const EspaceArtisan = lazy(() => import("@/pages/EspaceArtisan"));
// Simulateur de marge Prémi, accès direct par URL secrète (pas de connexion,
// comme /pac ou /gonflage) — non lié depuis le site public. Ne jamais lier
// cette route ailleurs : quiconque a l'URL y a accès.
const MargesPremiPublic = lazy(() => import("@/pages/MargesPremiPublic"));
// Signature publique d'un pré-devis/contrat CEE Station de gonflage : pas
// de connexion, protégée par un jeton unique et imprévisible dans l'URL
// (voir GonflageCRM.tsx). Ne lie que la collection Firestore
// gonflage_signatures, jamais le dossier complet.
const GonflageSignature = lazy(() => import("@/pages/GonflageSignature"));
const Home = lazy(() => import("@/pages/Home"));
const CarDetails = lazy(() => import("@/pages/CarDetails"));
const ListCar = lazy(() => import("@/pages/ListCar"));
const MyBookings = lazy(() => import("@/pages/MyBookings"));

// Pages de l'outil interne (CRM, espace pro, ancienne app voitures) : chargement orange.
// Partout ailleurs (site des clients) : chargement bleu, aux couleurs du site.
const isInternalPath = () =>
  /^\/(admin|outil-devis|espace-pro|marges-|gonflage-signature|autos|cars|list-car|my-|profile)/.test(window.location.pathname);
const PageSpinner = () => <BrandLoader full tone={isInternalPath() ? "crm" : "site"} />;

// Vitesse : une fois la page affichée, on télécharge discrètement les autres
// pages du site client. Un clic sur un bouton ou le menu s'ouvre alors tout de
// suite, sans écran de chargement. (Pas pour l'outil interne, ni en économie
// de données.)
if (typeof window !== "undefined" && !isInternalPath()) {
  const prefetch = () => {
    const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) return;
    [PompeAChaleur, CampagnePAC, Aides, Contact, Realisations, CampagneSolaire, ArticlesList, ArticleDetail, PacVille]
      .map((page) => page.preload)
      .reduce((p: Promise<unknown>, load) => p.then(() => load().catch(() => undefined)), Promise.resolve());
  };
  const later = () => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(prefetch, { timeout: 3000 });
    else setTimeout(prefetch, 1200);
  };
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
}

function Router() {
  // Plus d'attente de la session avant d'afficher une page : seule l'ancienne app voitures s'en sert
  // (ses pages la vérifient elles-mêmes). Le site des clients s'affiche donc tout de suite.
  return (
    <Suspense fallback={<PageSpinner />}>
      <Switch>
        {/* La landing IP5 Énergie est la page d'accueil ; /ip5-energie reste
            en alias pour les liens déjà partagés. L'app voitures vit sur /autos. */}
        <Route path="/" component={IP5Energie} />
        <Route path="/ip5-energie" component={IP5Energie} />
        <Route path="/pompe-a-chaleur" component={PompeAChaleur} />
        <Route path="/pompe-a-chaleur/:ville" component={PacVille} />
        {CLIENT_SPACE_PUBLIC && <Route path="/mon-espace" component={ClientSpace} />}
        {/* Landing pubs Meta : /pac (URL courte pour les annonces) + alias */}
        <Route path="/pac" component={CampagnePAC} />
        <Route path="/simulateur-pac" component={CampagnePAC} />
        {/* Lien des campagnes de réactivation (mail/SMS) : même page, leads
            marqués à part dans Monday et exclus du pixel Meta. */}
        <Route path="/aides-pac">
          {() => <CampagnePAC source="reactivation-pac" />}
        </Route>
        <Route path="/desinscription" component={Desinscription} />
        <Route path="/avis" component={Avis} />
        <Route path="/solaire" component={CampagneSolaire} />
        <Route path="/chauffe-eau-solaire" component={CampagneSolaire} />
        {/* Landing pub Meta B2B : /gonflage (URL courte pour les annonces) + alias */}
        <Route path="/gonflage" component={CampagneGonflage} />
        <Route path="/gonflage-pneumatiques" component={CampagneGonflage} />
        <Route path="/aides" component={Aides} />
        <Route path="/realisations" component={Realisations} />
        <Route path="/contact" component={Contact} />
        {/* Rubrique « Conseils & actus » ; les anciennes adresses /articles redirigent ici. */}
        <Route path="/conseils" component={ArticlesList} />
        <Route path="/conseils/:slug" component={ArticleDetail} />
        <Route path="/articles">
          <Redirect to="/conseils" replace />
        </Route>
        <Route path="/articles/:slug">{(p: { slug: string }) => <Redirect to={`/conseils/${p.slug}`} replace />}</Route>
        <Route path="/mentions-legales" component={MentionsLegales} />
        <Route path="/confidentialite" component={Confidentialite} />
        {/* Espace Pro — accès restreint par connexion Google (2 comptes) */}
        {/* /espace-pro = espace des artisans partenaires ; l'outil interne IP5 est sur /admin */}
        <Route path="/espace-pro" component={EspaceArtisan} />
        <Route path="/admin" component={OutilDevis} />
        <Route path="/outil-devis" component={OutilDevis} />
        {/* Simulateur de marge Prémi — accès direct par URL secrète, sans
            connexion. Ne jamais lier cette route depuis une page publique. */}
        <Route path="/marges-premi-1e3e9eef05" component={MargesPremiPublic} />
        <Route path="/gonflage-signature/:token" component={GonflageSignature} />
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
