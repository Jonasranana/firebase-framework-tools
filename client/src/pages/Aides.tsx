import React from "react";
import { PageLayout, AidesSection, AvisSection, FinalCTA } from "./ip5-sections";
import {
  AidesDispositifsSection,
  AidesProfilsSection,
  AidesErreursSection,
  AidesFaqSection,
} from "./aides-real-sections";

// Page « Aides de l'État » : le bloc bleu (projet clé en main), les 4 aides
// cumulables, les profils MaPrimeRénov', les erreurs à éviter, les avis, la
// FAQ, puis l'appel à l'action.
const Aides = () => (
  <PageLayout title="Aides de l'État (MaPrimeRénov', CEE) — IP5 Énergie">
    <AidesSection asHero />
    <AidesDispositifsSection />
    <AidesProfilsSection />
    <AidesErreursSection />
    <AvisSection />
    <AidesFaqSection />
    <FinalCTA />
  </PageLayout>
);

export default Aides;
