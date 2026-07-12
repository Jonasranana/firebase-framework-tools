import React from "react";
import { Award } from "lucide-react";
import {
  PageLayout,
  PageHero,
  RealisationsSection,
  AvisSection,
  FinalCTA,
} from "./ip5-sections";

// Page « Réalisations » : nos chantiers (avant/après, détails) et les avis
// de nos clients.
const Realisations = () => (
  <PageLayout title="Nos réalisations et avis clients — IP5 Énergie">
    <PageHero
      kicker="Notre savoir-faire"
      kickerIcon={Award}
      title="Des chantiers soignés, des clients"
      highlight="satisfaits"
      subtitle="Découvrez nos installations avant / après, le détail de notre travail, et les retours de propriétaires qui nous ont fait confiance partout en France."
    />
    <RealisationsSection />
    <AvisSection />
    <FinalCTA />
  </PageLayout>
);

export default Realisations;
