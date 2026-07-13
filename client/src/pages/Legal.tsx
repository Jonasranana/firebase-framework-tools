import React from "react";
import {
  SiteHeader,
  SiteFooter,
  WhatsAppButton,
  AIChatWidget,
  useFrenchPageMeta,
} from "./site-chrome";

// Pages légales : mentions légales (obligatoires, LCEN art. 6-III) et
// politique de confidentialité (RGPD). Société confirmée par le
// propriétaire du site : IP5 CONSEILS, SIREN 890 293 277.

const LegalLayout = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div dir="ltr" className="font-sans text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-950 min-h-screen">
    <SiteHeader />
    <main className="pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-10">
          {title}
        </h1>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm p-8 md:p-10 space-y-8">
          {children}
        </div>
      </div>
    </main>
    <SiteFooter />
    <AIChatWidget />
    <WhatsAppButton />
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
    <div className="text-gray-700 dark:text-slate-300 leading-relaxed space-y-3 text-[15px]">
      {children}
    </div>
  </section>
);

export const MentionsLegales = () => {
  useFrenchPageMeta("Mentions légales — IP5 Énergie");
  return (
    <LegalLayout title="Mentions légales">
      <Section title="Éditeur du site">
        <p>
          Le site <b>ip5-energie.web.app</b> (« IP5 Énergie ») est édité par :
        </p>
        <p>
          <b>IP5 CONSEILS</b>, société par actions simplifiée (SAS) au capital
          de 10 000 €<br />
          Siège social : 45 rue de Maubeuge, 75009 Paris, France
          <br />
          SIREN : 890 293 277 — RCS Paris
          <br />
          TVA intracommunautaire : FR72 890 293 277
        </p>
        <p>
          Directrice de la publication : Carole Sitbon
          <br />
          Contact :{" "}
          <a href="mailto:info@ip5energie.com" className="text-[#2b5a8f] dark:text-blue-400 underline">
            info@ip5energie.com
          </a>{" "}
          — 07 49 52 52 67
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          Le site est hébergé par le service Firebase Hosting de Google :
          <br />
          Google Ireland Limited, Gordon House, Barrow Street, Dublin 4,
          Irlande —{" "}
          <a
            href="https://firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2b5a8f] dark:text-blue-400 underline"
          >
            firebase.google.com
          </a>
        </p>
      </Section>

      <Section title="Activité">
        <p>
          IP5 Énergie propose l'étude, la fourniture et l'installation de
          pompes à chaleur, ainsi que l'accompagnement dans les démarches
          d'aides à la rénovation énergétique (MaPrimeRénov', certificats
          d'économies d'énergie), selon l'éligibilité de chaque projet.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus de ce site (textes, logo, photographies de
          chantiers, éléments graphiques) est la propriété d'IP5 CONSEILS ou
          fait l'objet d'une autorisation d'utilisation. Toute reproduction,
          représentation ou diffusion, totale ou partielle, sans autorisation
          écrite préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          Les informations et estimations fournies sur ce site (notamment par
          le simulateur d'économies) sont indicatives et non contractuelles.
          Elles ne remplacent pas une étude technique personnalisée. Les
          montants d'aides dépendent de l'éligibilité de chaque foyer et des
          barèmes en vigueur au moment de la demande.
        </p>
      </Section>

      <Section title="Médiation de la consommation et litiges">
        <p>
          Conformément aux articles L611-1 et suivants du Code de la
          consommation, tout consommateur a le droit de recourir gratuitement
          à un médiateur de la consommation en vue de la résolution amiable
          d'un litige. Vous pouvez également utiliser la plateforme européenne
          de règlement en ligne des litiges :{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2b5a8f] dark:text-blue-400 underline"
          >
            ec.europa.eu/consumers/odr
          </a>
          . Pour toute réclamation, contactez-nous d'abord à{" "}
          <a href="mailto:info@ip5energie.com" className="text-[#2b5a8f] dark:text-blue-400 underline">
            info@ip5energie.com
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
};

export const Confidentialite = () => {
  useFrenchPageMeta("Politique de confidentialité — IP5 Énergie");
  return (
    <LegalLayout title="Politique de confidentialité">
      <Section title="Qui est responsable de vos données ?">
        <p>
          Le responsable du traitement est <b>IP5 CONSEILS</b> (SIREN
          890 293 277), 45 rue de Maubeuge, 75009 Paris. Contact :{" "}
          <a href="mailto:info@ip5energie.com" className="text-[#2b5a8f] dark:text-blue-400 underline">
            info@ip5energie.com
          </a>
          .
        </p>
      </Section>

      <Section title="Quelles données collectons-nous, et pourquoi ?">
        <p>
          Lorsque vous utilisez notre <b>simulateur d'économies</b> et que
          vous demandez un devis, nous collectons : votre nom, votre numéro de
          téléphone, votre adresse e-mail (facultative) et vos réponses au
          simulateur (type de logement, statut d'occupation, surface,
          chauffage actuel, département, taille du foyer, tranche de revenu
          fiscal, échéance du projet).
        </p>
        <p>
          Ces données servent uniquement à <b>vous recontacter au sujet de
          votre demande de devis</b> et à préparer une étude personnalisée.
          Base légale : votre consentement (case à cocher avant l'envoi).
          Elles ne sont <b>jamais revendues</b> ni utilisées pour de la
          prospection non sollicitée.
        </p>
        <p>
          Si vous utilisez l'<b>assistant de discussion</b> (propulsé par
          Google Gemini), vos messages sont traités par Google pour générer
          les réponses. N'y saisissez pas de données sensibles.
        </p>
      </Section>

      <Section title="Qui a accès à vos données ?">
        <p>
          Vos données sont accessibles à l'équipe d'IP5 Énergie et à nos
          sous-traitants techniques, qui les traitent pour notre compte :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Google Firebase</b> (hébergement du site et stockage sécurisé
            des demandes) ;
          </li>
          <li>
            <b>monday.com</b> (outil interne de suivi des demandes de devis).
          </li>
        </ul>
      </Section>

      <Section title="Combien de temps les conservons-nous ?">
        <p>
          Vos données de prospect sont conservées au maximum <b>3 ans</b>{" "}
          après notre dernier contact, conformément aux recommandations de la
          CNIL, puis supprimées. Si vous devenez client, les données liées au
          contrat sont conservées selon les durées légales applicables.
        </p>
      </Section>

      <Section title="Cookies et mesure d'audience">
        <p>
          Ce site n'utilise pas de cookies publicitaires ni d'outil de
          traçage. Certaines ressources techniques (polices de caractères,
          services Google Firebase) peuvent transmettre votre adresse IP à
          Google dans le cadre strict de leur fonctionnement.
        </p>
      </Section>

      <Section title="Quels sont vos droits ?">
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous
          disposez des droits d'accès, de rectification, d'effacement,
          d'opposition, de limitation et de portabilité de vos données. Vous
          pouvez retirer votre consentement à tout moment.
        </p>
        <p>
          Pour les exercer, écrivez-nous à{" "}
          <a href="mailto:info@ip5energie.com" className="text-[#2b5a8f] dark:text-blue-400 underline">
            info@ip5energie.com
          </a>{" "}
          en précisant votre demande. Vous pouvez aussi introduire une
          réclamation auprès de la CNIL (
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2b5a8f] dark:text-blue-400 underline"
          >
            cnil.fr
          </a>
          ).
        </p>
      </Section>
    </LegalLayout>
  );
};
