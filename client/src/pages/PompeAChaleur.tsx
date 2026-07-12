import React from "react";
import { BadgeCheck } from "lucide-react";
import {
  PageLayout,
  PageHero,
  MarquesSection,
  FinalCTA,
} from "./ip5-sections";

// Page « La pompe à chaleur » : bandeau titre + les 6 modèles que nous
// installons (catalogue), puis appel à l'action.
const PompeAChaleur = () => (
  <PageLayout title="Nos pompes à chaleur — IP5 Énergie">
    <PageHero
      kicker="Nos pompes à chaleur"
      kickerIcon={BadgeCheck}
      title="La pompe à chaleur, le chauffage le plus"
      highlight="performant"
      subtitle="Chauffage doux en hiver, jusqu'à 4 kWh de chaleur pour 1 kWh consommé, et un logement valorisé. Découvrez les 6 marques que nous installons."
    />
    <MarquesSection />
    <FinalCTA />
  </PageLayout>
);

export default PompeAChaleur;
