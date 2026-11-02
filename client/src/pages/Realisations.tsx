import React from "react";
import { Award } from "lucide-react";
import {
  PageLayout,
  PageHero,
  AvisSection,
  FinalCTA,
} from "./ip5-sections";
import { BeforeAfterSection, RealisationsGallerySection, EngagementsSection } from "./aides-real-sections";

// Page « Réalisations » : avant / après à glisser, galerie des détails
// (agrandissement), nos engagements et les avis de nos clients.
const Realisations = () => (
  <PageLayout title="Nos réalisations et avis clients — IP5 Énergie">
    <PageHero
      kicker="Notre savoir-faire"
      kickerIcon={Award}
      title="Des chantiers soignés, des clients"
      highlight="satisfaits"
      subtitle="Découvrez nos installations avant / après, le détail de notre travail, et les retours de propriétaires qui nous ont fait confiance partout en France."
      image="/images/realisations/interieur-pac-ballon.jpg"
      imageAlt="Module intérieur et ballon d'eau chaude installés par IP5 Énergie"
      imagePosition="50% 45%"
    />
    <BeforeAfterSection />
    <RealisationsGallerySection />
    <EngagementsSection />
    <AvisSection />
    <FinalCTA />
  </PageLayout>
);

export default Realisations;
