import React from "react";
import { HandCoins } from "lucide-react";
import { PageLayout, PageHero, AidesSection, FinalCTA } from "./ip5-sections";

// Page « Aides de l'État » : MaPrimeRénov', CEE et le projet clé en main.
const Aides = () => (
  <PageLayout title="Aides de l'État (MaPrimeRénov', CEE) — IP5 Énergie">
    <PageHero
      kicker={`Aides de l'État ${new Date().getFullYear()}`}
      kickerIcon={HandCoins}
      title="Jusqu'à 80% de votre installation"
      highlight="financée"
      subtitle="MaPrimeRénov' et Certificats d'Économie d'Énergie : nous calculons vos droits, gérons 100% des démarches, et déduisons les aides directement de votre devis."
    />
    <AidesSection />
    <FinalCTA />
  </PageLayout>
);

export default Aides;
