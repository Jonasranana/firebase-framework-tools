import React from "react";
import { PageLayout, AidesSection, FinalCTA } from "./ip5-sections";

// Page « Aides de l'État » : un seul bloc bleu cohérent (MaPrimeRénov', CEE,
// projet clé en main), puis l'appel à l'action.
const Aides = () => (
  <PageLayout title="Aides de l'État (MaPrimeRénov', CEE) — IP5 Énergie">
    <AidesSection asHero />
    <FinalCTA />
  </PageLayout>
);

export default Aides;
