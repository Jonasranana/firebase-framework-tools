import React from "react";
import { BadgeCheck } from "lucide-react";
import {
  PageLayout,
  PageHero,
  AvantagesSection,
  MarquesSection,
  AidesSection,
  AvisSection,
  FinalCTA,
} from "./ip5-sections";
import {
  PacFeaturesSection,
  PacHowItWorksSection,
  PacInstallationSection,
  PacFaqSection,
} from "./pac-sections";

// Page « La pompe à chaleur » : ce qu'elle fait, comment elle marche
// (schéma interactif), les chiffres clés, les marques installées, ce que
// comprend l'installation (photos de chantier), les aides, les avis, la FAQ,
// puis appel à l'action.
const PompeAChaleur = () => (
  <PageLayout title="Nos pompes à chaleur — IP5 Énergie">
    <PageHero
      kicker="Nos pompes à chaleur"
      kickerIcon={BadgeCheck}
      title="La pompe à chaleur, le chauffage le plus"
      highlight="performant"
      subtitle="Chauffage doux en hiver, jusqu'à 4 kWh de chaleur pour 1 kWh consommé, et un logement valorisé. Découvrez les 7 marques que nous installons."
      image="/images/realisations/unite-exterieure.jpg"
      imageAlt="Unité extérieure de pompe à chaleur posée par IP5 Énergie"
      imagePosition="50% 60%"
    />
    <PacFeaturesSection />
    <PacHowItWorksSection />
    <AvantagesSection />
    <MarquesSection />
    <PacInstallationSection />
    <AidesSection />
    <AvisSection />
    <PacFaqSection />
    <FinalCTA />
  </PageLayout>
);

export default PompeAChaleur;
