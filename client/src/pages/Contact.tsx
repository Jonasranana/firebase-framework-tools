import React from "react";
import { Phone, MessageCircle, Mail, Facebook, Clock, MapPin } from "lucide-react";
import { PageLayout, PageHero, Simulator } from "./ip5-sections";
import { FACEBOOK_URL } from "./site-chrome";

// Page « Contact » : les moyens de nous joindre + le simulateur pour lancer
// directement une demande de devis gratuit.
const CONTACT_CHANNELS = [
  {
    icon: Phone,
    label: "Par téléphone",
    value: "07 49 52 52 67",
    href: "tel:+33749525267",
    hint: "Du lundi au samedi",
  },
  {
    icon: MessageCircle,
    label: "Sur WhatsApp",
    value: "07 49 52 52 67",
    href: "https://wa.me/33749525267",
    hint: "Réponse rapide",
  },
  {
    icon: Mail,
    label: "Par e-mail",
    value: "info@ip5energie.com",
    href: "mailto:info@ip5energie.com",
    hint: "Pour un devis écrit",
  },
  {
    icon: Facebook,
    label: "Sur Facebook",
    value: "IP5 Énergie",
    href: FACEBOOK_URL,
    hint: "Suivez nos actualités",
  },
];

const Contact = () => (
  <PageLayout title="Contact — IP5 Énergie">
    <PageHero
      kicker="Contact"
      kickerIcon={Phone}
      title="Parlons de votre"
      highlight="projet"
      subtitle="Une question, un devis, un rendez-vous ? Notre équipe familiale vous répond directement. Choisissez le moyen qui vous convient, ou lancez votre simulation gratuite."
    />

    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Moyens de contact */}
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
              Nous joindre
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Chez IP5 Énergie, un seul interlocuteur vous suit du premier appel
              à la mise en service de votre pompe à chaleur.
            </p>

            <div className="grid sm:grid-cols-2 gap-5">
              {CONTACT_CHANNELS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex flex-col gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 text-[#2b5a8f] flex items-center justify-center">
                    <c.icon size={22} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-1">
                    {c.label}
                  </p>
                  <p className="text-lg font-bold text-gray-900 group-hover:text-[#2b5a8f] transition-colors">
                    {c.value}
                  </p>
                  <p className="text-sm text-gray-500">{c.hint}</p>
                </a>
              ))}
            </div>

            <div className="mt-8 space-y-3 text-gray-600">
              <p className="flex items-center gap-3">
                <Clock size={18} className="text-[#2b5a8f] flex-shrink-0" />
                Ouvert du lundi au samedi, de 8h à 19h
              </p>
              <p className="flex items-center gap-3">
                <MapPin size={18} className="text-[#2b5a8f] flex-shrink-0" />
                Interventions partout en France
              </p>
            </div>

            <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-sm text-gray-500 leading-relaxed">
                <b className="text-gray-900">IP5 Énergie</b> — entreprise
                familiale certifiée RGE QualiPAC, spécialiste de l'installation
                de pompes à chaleur air/eau. Nous gérons vos démarches d'aides
                (MaPrimeRénov', CEE) de A à Z.
              </p>
            </div>
          </div>

          {/* Simulateur / demande de devis */}
          <div id="simulateur" className="relative scroll-mt-28">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
                Votre devis gratuit en 30 secondes
              </h2>
              <p className="text-gray-600">
                Répondez à quelques questions, un expert vous rappelle.
              </p>
            </div>
            <div className="absolute inset-0 top-24 bg-gradient-to-tr from-blue-100 to-green-50 transform rotate-3 rounded-[3rem] blur-lg opacity-40"></div>
            <div className="relative">
              <Simulator />
            </div>
          </div>
        </div>
      </div>
    </section>
  </PageLayout>
);

export default Contact;
