import React from "react";
import { Phone, MessageCircle, Mail, Facebook, Clock, MapPin } from "lucide-react";
import { PageLayout, PageHero } from "./ip5-sections";
import { FACEBOOK_URL } from "./site-chrome";

// Page « Contact » : les moyens de nous joindre. Le simulateur reste sur
// l'accueil ; ici on met en avant l'appel, WhatsApp, l'e-mail et Facebook.
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
      subtitle="Une question, un devis, un rendez-vous ? Notre équipe familiale vous répond directement. Choisissez simplement le moyen qui vous convient."
    />

    <section className="py-24 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
            Nous joindre
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Chez IP5 Énergie, un seul interlocuteur vous suit du premier appel à
            la mise en service de votre pompe à chaleur.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
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

        <div className="max-w-3xl mx-auto mt-10 flex flex-col sm:flex-row items-center justify-center gap-x-8 gap-y-3 text-gray-600">
          <p className="flex items-center gap-3">
            <Clock size={18} className="text-[#2b5a8f] flex-shrink-0" />
            Du lundi au samedi, 8h – 19h
          </p>
          <p className="flex items-center gap-3">
            <MapPin size={18} className="text-[#2b5a8f] flex-shrink-0" />
            Interventions partout en France
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-10 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
          <p className="text-sm text-gray-500 leading-relaxed">
            <b className="text-gray-900">IP5 Énergie</b> — entreprise familiale
            certifiée RGE QualiPAC, spécialiste de l'installation de pompes à
            chaleur air/eau. Nous gérons vos démarches d'aides (MaPrimeRénov',
            CEE) de A à Z.
          </p>
        </div>
      </div>
    </section>
  </PageLayout>
);

export default Contact;
