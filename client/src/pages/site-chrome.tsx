import React, { useEffect, useRef, useState } from "react";
import {
  Phone,
  MessageCircle,
  ShieldCheck,
  Send,
  X,
  Loader2,
  Sparkles,
  Menu,
  Facebook,
  Moon,
  Sun,
} from "lucide-react";
import { useLocation } from "wouter";
import { LOGO_FULL_D, LOGO_FULL_VIEWBOX } from "./ip5-logo";

// Éléments d'en-tête, de pied de page et l'assistant IA, partagés entre la
// landing page et les pages d'articles pour une identité visuelle cohérente.

// Le reste de l'app (location de voitures) est en RTL (index.css force
// direction:rtl sur html). Chaque page IP5 Énergie est en français : ce hook
// impose le sens gauche→droite et le titre d'onglet pendant qu'elle est
// affichée, puis restaure l'état précédent en la quittant.
export function useFrenchPageMeta(title: string) {
  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.style.direction;
    const prevLang = html.lang;
    const prevTitle = document.title;
    html.style.direction = "ltr";
    html.lang = "fr";
    document.title = title;

    // URL canonique : le site vit sur plusieurs adresses (ip5energie.fr, ainsi
    // que ip5-energie.web.app et l'ancienne kachoto-7554c.web.app) ; on indique
    // à Google que ip5energie.fr fait foi, pour éviter le contenu dupliqué.
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const prevCanonical = canonical?.href ?? null;
    if (canonical) {
      canonical.href = `https://ip5energie.fr${window.location.pathname}`;
    }

    return () => {
      html.style.direction = prevDir;
      html.lang = prevLang;
      document.title = prevTitle;
      if (canonical && prevCanonical) canonical.href = prevCanonical;
    };
  }, [title]);
}

// Logo IP5 Énergie : tracé vectoriel exact du logo officiel (voir ip5-logo.ts).
// La couleur suit currentColor : bleu marque dans le header, blanchi par le
// filtre du footer.
export const LogoIP5 = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox={LOGO_FULL_VIEWBOX}
    className={`h-12 md:h-14 w-auto text-[#2b5a8f] ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="IP5 Énergie"
  >
    <path d={LOGO_FULL_D} fill="currentColor" fillRule="evenodd" />
  </svg>
);

// Config Firebase du site (projet Kachoto), partagée par l'enregistrement des
// leads (Firestore) et l'assistant IA (Firebase AI Logic / Gemini).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAllJSME9X_ECgmnUudhdapDhOfBsUYbz0",
  authDomain: "kachoto-7554c.firebaseapp.com",
  projectId: "kachoto-7554c",
  storageBucket: "kachoto-7554c.firebasestorage.app",
  messagingSenderId: "930806777855",
  appId: "1:930806777855:web:c73960da99f3853d3e49ca",
};

export const FACEBOOK_URL = "https://www.facebook.com/share/1DnkfumaaV/";

// Menu principal : un vrai site multi-pages. Chaque entrée mène à une page
// dédiée (et non plus à une ancre de la page d'accueil).
export const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/pompe-a-chaleur", label: "Pompes à chaleur" },
  { href: "/aides", label: "Aides" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/articles", label: "Articles" },
  { href: "/contact", label: "Contact" },
];

// Bouton lune/soleil : chaque visiteur choisit clair ou sombre. Le choix est
// mémorisé (localStorage) et appliqué dès le chargement par le script inline
// de index.html, pour éviter tout clignotement au premier affichage.
const ThemeToggle = () => {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="text-gray-500 dark:text-slate-300 hover:text-[#2b5a8f] dark:hover:text-blue-300 transition-colors p-1"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export const SiteHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  // La page d'accueil (« / ») ne doit être active que sur la racine exacte ;
  // les autres pages le sont dès que l'URL commence par leur chemin.
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md fixed w-full z-50 top-0 border-b border-gray-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={isMobileMenuOpen}
              className="lg:hidden text-gray-700 dark:text-slate-200 hover:text-[#2b5a8f] dark:hover:text-blue-400 transition-colors p-1 -ml-1"
            >
              {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
            <a href="/">
              <LogoIP5 />
            </a>
          </div>
          <div className="hidden lg:flex space-x-6 xl:space-x-8 items-center">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`font-medium whitespace-nowrap transition-colors ${
                  isActive(link.href)
                    ? "text-[#2b5a8f] dark:text-blue-400 font-semibold"
                    : "text-gray-600 dark:text-slate-300 hover:text-[#2b5a8f] dark:hover:text-blue-400"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="La page Facebook d'IP5 Énergie"
              className="hidden md:flex text-gray-400 dark:text-slate-500 hover:text-[#2b5a8f] dark:hover:text-blue-400 transition-colors"
            >
              <Facebook size={20} />
            </a>
            <a
              href="tel:+33749525267"
              className="flex items-center gap-2 text-[#2b5a8f] dark:text-blue-400 font-bold hover:text-blue-800 dark:hover:text-blue-300 transition-colors whitespace-nowrap"
              aria-label="Appeler IP5 Énergie au 07 49 52 52 67"
            >
              <Phone size={18} />
              <span className="hidden md:inline">07 49 52 52 67</span>
            </a>
            <a
              href="/contact"
              className="hidden xl:inline-flex items-center gap-2 bg-[#2b5a8f] text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-blue-800 transition-colors shadow-md"
            >
              Devis gratuit
            </a>
          </div>
        </div>
      </div>

      {/* Menu déroulant mobile */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 flex flex-col">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`py-3 font-medium border-b border-gray-50 dark:border-slate-800 last:border-0 transition-colors ${
                  isActive(link.href)
                    ? "text-[#2b5a8f] dark:text-blue-400 font-semibold"
                    : "text-gray-700 dark:text-slate-200 hover:text-[#2b5a8f] dark:hover:text-blue-400"
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href="tel:+33749525267"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 py-3 text-[#2b5a8f] dark:text-blue-400 font-bold border-b border-gray-50 dark:border-slate-800"
            >
              <Phone size={18} /> 07 49 52 52 67
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 py-3 text-gray-600 dark:text-slate-300 font-medium"
            >
              <Facebook size={18} /> Suivez-nous sur Facebook
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export const SiteFooter = () => (
  <footer className="bg-gray-900 text-gray-400 py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="mb-6 opacity-80 filter grayscale brightness-200">
            {/* Le Logo Vectoriel en mode Footer */}
            <LogoIP5 />
          </div>
          <p className="text-sm leading-relaxed max-w-sm mb-6">
            Votre partenaire de confiance pour la transition énergétique en
            France. Spécialiste de l'installation de pompes à chaleur
            certifié RGE.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldCheck size={18} className="text-green-500" /> Certifié
            RGE QualiPAC
          </div>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6 text-lg">Contact</h4>
          <ul className="space-y-4">
            <li>
              <a
                href="tel:+33749525267"
                className="flex items-center gap-3 hover:text-blue-400 transition-colors"
              >
                <Phone size={18} />{" "}
                <span className="font-medium">07 49 52 52 67</span>
              </a>
            </li>
            <li>
              <a
                href="mailto:info@ip5energie.com"
                className="flex items-center gap-3 hover:text-blue-400 transition-colors"
              >
                <MessageCircle size={18} />{" "}
                <span>info@ip5energie.com</span>
              </a>
            </li>
            <li>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-blue-400 transition-colors"
              >
                <Facebook size={18} /> <span>Facebook</span>
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6 text-lg">Légal</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="/mentions-legales"
                className="hover:text-blue-400 transition-colors"
              >
                Mentions légales
              </a>
            </li>
            <li>
              <a
                href="/confidentialite"
                className="hover:text-blue-400 transition-colors"
              >
                Politique de confidentialité
              </a>
            </li>
            <li>
              <a
                href="/espace-pro"
                className="hover:text-blue-400 transition-colors"
              >
                Espace Pro
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Mention obligatoire (arrêté du 7 juillet 2026, en vigueur au
          1er octobre 2026) : toute communication commerciale sur la
          rénovation énergétique doit renvoyer au service public France Rénov'.
          Phrase imposée mot pour mot. */}
      <div className="mt-14 rounded-xl border border-gray-800 bg-gray-800/40 px-5 py-4 text-sm leading-relaxed text-gray-400">
        Avant de vous engager, le service public vous informe gratuitement pour
        préparer et sécuriser votre projet :{" "}
        <a
          href="https://www.france-renov.gouv.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-400 hover:text-blue-300 underline"
        >
          www.france-renov.gouv.fr
        </a>
      </div>

      <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
        <p>
          &copy; {new Date().getFullYear()} IP5 Énergie. Tous droits
          réservés.
        </p>
        <p className="mt-4 md:mt-0 text-gray-500">
          IP5 CONSEILS — SIREN 890 293 277
        </p>
      </div>
    </div>
  </footer>
);

export const WhatsAppButton = () => (
  <a
    href="https://wa.me/33749525267"
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center group"
    aria-label="Contactez-nous sur WhatsApp"
  >
    <MessageCircle size={32} />
    <span className="absolute right-16 bg-white text-gray-900 text-sm font-bold py-2 px-4 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
      Une question ? Écrivez-nous !
    </span>
  </a>
);

// Consignes données à Gemini : cadrent les réponses sur le métier d'IP5
// Énergie et évitent de promettre des montants d'aide fermes (chaque dossier
// est différent, seul un appel avec un expert les confirme).
const AI_SYSTEM_INSTRUCTION = `Tu es l'assistant virtuel du site d'IP5 Énergie, entreprise française certifiée RGE QualiPAC, spécialisée dans l'installation de pompes à chaleur air/eau.

Ton rôle : répondre en français, en 2 à 5 phrases maximum, aux questions des visiteurs sur :
- Le fonctionnement des pompes à chaleur (COP, économies d'énergie, aspect écologique)
- Les aides de l'État : MaPrimeRénov' (profils Bleu/Jaune/Violet/Rose selon le revenu fiscal de référence), les Certificats d'Économie d'Énergie (CEE), l'éco-PTZ
- Le déroulement d'une installation et la certification RGE
- Les services d'IP5 Énergie : étude gratuite, prise en charge des démarches administratives, installation par des techniciens certifiés

Règles strictes :
- Ne donne jamais de montant d'aide exact et garanti pour la situation personnelle d'un visiteur : ce sont des estimations qui dépendent d'un dossier réel. Invite-le à utiliser le simulateur en haut de la page ou à appeler IP5 Énergie au 07 49 52 52 67 pour un calcul précis.
- Si la question sort du sujet chauffage/énergie/rénovation ou de l'entreprise IP5 Énergie, réponds poliment que tu es spécialisé sur ces sujets et invite à contacter IP5 Énergie pour le reste.
- Ne donne pas de conseil juridique ou fiscal définitif, seulement des informations générales publiques.
- Reste chaleureux et professionnel.
- Si le visiteur semble prêt à passer à l'action, encourage-le à remplir le simulateur ou à appeler / écrire sur WhatsApp au 07 49 52 52 67.`;

type ChatMessage = { role: "user" | "model"; text: string };

const AI_WELCOME_MESSAGE: ChatMessage = {
  role: "model",
  text: "👋 Bonjour ! Je suis l'assistant d'IP5 Énergie, propulsé par Gemini. Une question sur les aides (MaPrimeRénov', CEE) ou sur l'installation d'une pompe à chaleur ? Je suis là pour vous répondre.",
};

// Badge de marque Gemini : dégradé aux couleurs de l'icône Google Gemini,
// réutilisé sur le bouton flottant et dans l'en-tête du chat.
const GeminiBadge = ({ size = 12 }: { size?: number }) => (
  <span className="bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-full p-1 flex items-center justify-center flex-shrink-0">
    <Sparkles size={size} className="text-white" />
  </span>
);

// Étoile IA à quatre branches (le symbole des assistants IA modernes),
// utilisée à la place de l'ancienne icône robot.
const AIStar = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 1 C13.2 7.2 16.8 10.8 23 12 C16.8 13.2 13.2 16.8 12 23 C10.8 16.8 7.2 13.2 1 12 C7.2 10.8 10.8 7.2 12 1 Z" />
  </svg>
);

// Assistant IA flottant, propulsé par Gemini via Firebase AI Logic. Le SDK
// est importé dynamiquement (npm, code-splitté par Vite) pour ne pas
// alourdir le chargement initial de la page.
export const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([AI_WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  const getChatSession = async () => {
    if (chatRef.current) return chatRef.current;
    const [{ initializeApp, getApps, getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] =
      await Promise.all([import("firebase/app"), import("firebase/ai")]);
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      systemInstruction: AI_SYSTEM_INSTRUCTION,
    });
    chatRef.current = model.startChat();
    return chatRef.current;
  };

  const send = async () => {
    const question = input.trim();
    if (!question || isLoading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsLoading(true);
    try {
      const chat = await getChatSession();
      const result = await chat.sendMessage(question);
      const text = result.response.text();
      setMessages((prev) => [...prev, { role: "model", text }]);
    } catch (err) {
      console.error("Erreur assistant IA:", err);
      setError(
        "Désolé, l'assistant est momentanément indisponible. Appelez-nous au 07 49 52 52 67 ou écrivez sur WhatsApp.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-x-4 bottom-40 sm:inset-x-auto sm:right-6 sm:bottom-40 sm:w-96 h-[28rem] max-h-[70vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-r from-[#2b5a8f] via-[#41519e] to-[#6b4a9e] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <AIStar size={18} /> Assistant IP5 Énergie
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <GeminiBadge size={10} />
                <span className="text-[11px] font-semibold text-blue-100">
                  Propulsé par{" "}
                  <span className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                    Google Gemini
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer l'assistant"
              className="hover:opacity-70 transition-opacity"
            >
              <X size={20} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-slate-950">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#2b5a8f] text-white ml-auto rounded-br-sm"
                    : "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 w-fit">
                <Loader2 size={16} className="animate-spin text-[#2b5a8f] dark:text-blue-400" />
                <span className="text-sm text-gray-500 dark:text-slate-400">En train d'écrire...</span>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-2.5 text-sm">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-slate-700 flex-shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              aria-label="Votre question à l'assistant"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none text-sm bg-gray-50 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Envoyer"
              className="bg-[#2b5a8f] text-white rounded-full p-2.5 hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fermer l'assistant Gemini" : "Ouvrir l'assistant Gemini"}
        className="fixed bottom-24 right-6 bg-gradient-to-br from-[#4285f4] via-[#8b5cf6] to-[#ec4899] text-white p-4 rounded-full shadow-2xl shadow-purple-500/40 hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center group"
      >
        {!isOpen && (
          <span
            className="absolute inset-0 rounded-full bg-gradient-to-br from-[#4285f4] via-[#8b5cf6] to-[#ec4899] animate-ping opacity-25"
            aria-hidden="true"
          ></span>
        )}
        {isOpen ? (
          <X size={28} className="relative" />
        ) : (
          <AIStar size={28} className="relative drop-shadow" />
        )}
        {!isOpen && (
          <span className="hidden md:block absolute right-16 bg-white text-gray-900 text-sm font-bold py-2 px-4 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
            Posez vos questions à notre IA, propulsée par Gemini
          </span>
        )}
      </button>
    </>
  );
};
