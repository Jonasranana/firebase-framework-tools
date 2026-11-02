import React, { useState } from "react";
import { Phone, MessageCircle, Mail, Facebook, Clock, MapPin, ArrowRight, CheckCircle2, Calculator } from "lucide-react";
import {
  PageLayout,
  PageHero,
  SectionHead,
  FRENCH_PHONE_REGEX,
  submitCallbackRequest,
  type CallbackRequest,
} from "./ip5-sections";
import { FACEBOOK_URL } from "./site-chrome";

// Page « Contact » : demande de rappel (même circuit que le rappel de /pac :
// collection ip5_leads, notification, CRM), les moyens de nous joindre et le
// déroulé après la demande.
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
    value: "contact@ip5energie.com",
    href: "mailto:contact@ip5energie.com",
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

const inputClass =
  "w-full px-4 py-3.5 rounded-xl border-2 border-white/15 bg-white/[0.07] text-white text-[16px] placeholder:text-white/50 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/15 outline-none transition-colors";

const EMPTY: CallbackRequest = { firstName: "", lastName: "", phone: "", postalCode: "", currentHeating: "", company: "" };

// Formulaire « On vous rappelle ».
const CallbackForm = () => {
  const [form, setForm] = useState<CallbackRequest>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Indiquez votre prénom.";
    if (!form.lastName.trim()) next.lastName = "Indiquez votre nom.";
    if (!FRENCH_PHONE_REGEX.test(form.phone.trim())) next.phone = "Numéro de téléphone invalide.";
    if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "Code postal à 5 chiffres.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    try {
      await submitCallbackRequest(form, "contact-rappel");
      setDone(true);
    } catch {
      setErrors({ submit: "L'envoi a échoué. Appelez-nous au 07 49 52 52 67." });
    } finally {
      setSending(false);
    }
  };

  if (done)
    return (
      <div className="text-center py-8">
        <span className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-300 text-[#0b1a2c] flex items-center justify-center">
          <CheckCircle2 size={34} />
        </span>
        <h3 className="text-2xl font-extrabold">Merci {form.firstName.trim()} !</h3>
        <p className="text-white/75 mt-2">Votre demande est bien reçue. Un conseiller vous rappelle très rapidement.</p>
      </div>
    );

  const err = (k: string) => errors[k] && <p className="text-red-300 text-xs mt-1">{errors[k]}</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input className={inputClass} placeholder="Prénom" autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          {err("firstName")}
        </div>
        <div>
          <input className={inputClass} placeholder="Nom" autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          {err("lastName")}
        </div>
      </div>
      <div>
        <input className={inputClass} type="tel" inputMode="tel" placeholder="Téléphone" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {err("phone")}
      </div>
      <div>
        <input className={inputClass} inputMode="numeric" maxLength={5} placeholder="Code postal" autoComplete="postal-code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })} />
        {err("postalCode")}
      </div>
      {errors.submit && <p className="text-red-300 text-sm">{errors.submit}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl py-4 text-[17px] font-bold text-[#0b1a2c] bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60"
      >
        {sending ? "Envoi…" : "Être rappelé(e)"} {!sending && <ArrowRight size={18} />}
      </button>
      <p className="text-[11.5px] text-white/50 leading-relaxed">
        En cliquant sur « Être rappelé(e) », j'accepte d'être recontacté(e) par IP5 Énergie au sujet de ma demande. Mes
        données ne sont jamais revendues et je peux exercer mes droits (accès, rectification, suppression) à tout moment.
      </p>
    </form>
  );
};

const NEXT_STEPS = [
  { title: "On vous rappelle", text: "Un conseiller vous appelle rapidement pour comprendre votre projet." },
  { title: "On estime vos aides", text: "Nous calculons vos droits MaPrimeRénov' et CEE selon votre situation." },
  { title: "Visite et devis", text: "Un technicien vérifie votre logement, puis vous recevez un devis clair, aides déduites." },
];

const Contact = () => (
  <PageLayout title="Contact — IP5 Énergie" hideFloatingWhileVisible="rappel">
    <PageHero
      kicker="Contact"
      kickerIcon={Phone}
      title="Parlons de votre"
      highlight="projet"
      subtitle="Une question, un devis, un rendez-vous ? Notre équipe familiale vous répond directement. Choisissez simplement le moyen qui vous convient."
      image="/images/site/contact-conseillere.jpg"
      imageAlt="Une conseillère souriante, avec son casque téléphonique"
      imagePosition="50% 30%"
    />

    <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10 items-start">
          {/* Demande de rappel */}
          <div id="rappel" className="lg:col-span-5 mb-10 lg:mb-0 rounded-[1.75rem] bg-[#0b1a2c] text-white p-6 md:p-8 shadow-2xl scroll-mt-24">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-amber-200">Rappel gratuit</p>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-2">On vous rappelle</h2>
            <p className="text-white/70 mt-2 mb-6">Laissez vos coordonnées, un conseiller vous appelle pour parler de votre projet.</p>
            <CallbackForm />
          </div>

          {/* Moyens de contact */}
          <div className="lg:col-span-7">
            <SectionHead align="left" kicker="Nous joindre" title="Ou contactez-nous directement" subtitle="Un seul interlocuteur vous suit, du premier appel à la mise en service." />
            <div className="grid sm:grid-cols-2 gap-4 -mt-2">
              {CONTACT_CHANNELS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 hover:shadow-lg transition-all p-5"
                >
                  <span className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${c.icon === MessageCircle ? "bg-gradient-to-br from-[#3ee07a] to-[#1faa52] text-white" : "bg-gradient-to-br from-[#4a7fc1] to-[#1d4e89] text-amber-200"}`}>
                    <c.icon size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{c.label}</span>
                    <span className="block font-bold text-[#0f2a47] dark:text-white break-all">{c.value}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{c.hint}</span>
                  </span>
                </a>
              ))}
            </div>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <p className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 text-slate-600 dark:text-slate-300 text-sm">
                <Clock size={18} className="text-[#2b5a8f] flex-shrink-0" /> Du lundi au samedi, 8h – 19h
              </p>
              <p className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 text-slate-600 dark:text-slate-300 text-sm">
                <MapPin size={18} className="text-[#2b5a8f] flex-shrink-0" /> Partout en France, hors pourtour méditerranéen et Corse
              </p>
            </div>
            <a
              href="/#simulateur"
              className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-5 hover:shadow-lg transition-shadow"
            >
              <span className="w-12 h-12 rounded-2xl bg-amber-300 text-[#0b1a2c] flex items-center justify-center flex-shrink-0">
                <Calculator size={22} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-[#0f2a47] dark:text-white">Vous préférez estimer vos aides d'abord ?</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">Le simulateur en ligne, gratuit, en 2 minutes.</span>
              </span>
              <ArrowRight size={20} className="text-[#0f2a47] dark:text-white" />
            </a>
          </div>
        </div>
      </div>
    </section>

    {/* Après votre demande */}
    <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <SectionHead kicker="Et ensuite ?" title="Ce qui se passe après votre demande" subtitle="Simple, rapide et sans engagement." />
        <ol className="relative grid gap-7 md:grid-cols-3 md:gap-6">
          <span className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px bg-slate-200 dark:bg-slate-800" aria-hidden="true"></span>
          <span className="md:hidden absolute top-2 bottom-2 left-6 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true"></span>
          {NEXT_STEPS.map((m, i) => (
            <li key={m.title} className="relative flex md:flex-col md:items-center md:text-center gap-4">
              <span className="relative z-10 w-12 h-12 flex-shrink-0 rounded-full bg-[#0b1a2c] text-amber-200 font-extrabold text-lg flex items-center justify-center ring-8 ring-white dark:ring-slate-950">{i + 1}</span>
              <div>
                <h3 className="font-bold text-[#0f2a47] dark:text-white text-lg">{m.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{m.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-12 text-center text-sm text-slate-400 max-w-2xl mx-auto">
          IP5 Énergie, entreprise familiale certifiée RGE QualiPAC, spécialiste de l'installation de pompes à chaleur
          air/eau. Nous gérons vos démarches d'aides (MaPrimeRénov', CEE) de A à Z.
        </p>
      </div>
    </section>
  </PageLayout>
);

export default Contact;
