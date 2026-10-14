import React, { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Eye,
  EyeOff,
  Lock,
  Calculator,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { LogoIP5 } from "./site-chrome";
import ClientsCRM from "./ClientsCRM";
import LeadsCRM from "./LeadsCRM";
import ArtisansCRM from "./ArtisansCRM";
import StatsCRM from "./StatsCRM";
import DocumentsPage from "./DocumentsPage";
import TeamPage from "./TeamPage";
import { memberName } from "@/lib/crmTeam";
import GonflageCRM from "./GonflageCRM";
import AdminShell, { initialPage, rememberPage, type AdminPage, type PageTools } from "./AdminShell";
import type { SideItem } from "@/lib/crmSidebar";

// ─────────────────────────────────────────────────────────────────────────
// OUTIL INTERNE — Simulateur de marge + aides pour nos devis de pompes à
// chaleur. PRIVÉ : réservé aux e-mails de la liste blanche ci-dessous.
// Non lié depuis le site public, non indexé (noindex). Aucune donnée n'est
// stockée : la vérification de l'e-mail se fait côté navigateur après la
// connexion Google (Firebase Authentication).
// ─────────────────────────────────────────────────────────────────────────

// Liste blanche des personnes autorisées. Pour ajouter/retirer quelqu'un,
// modifier cette liste (en minuscules) puis redéployer.
const ALLOWED_EMAILS = [
  "jonassitbon8@gmail.com",
  "alexis.sitbon@gmail.com",
  "carol.sitbon05@gmail.com",
];

// ── Barème 2026 — À METTRE À JOUR quand le barème officiel change ──────────
// MaPrimeRénov' (parcours par geste : remplacement d'une chaudière
// fioul/gaz/charbon par une PAC air/eau), montant par profil de revenus.
const MPR_MONTANT: Record<string, number> = {
  Bleu: 5000,
  Jaune: 4000,
  Violet: 3000,
  Rose: 0,
};
// Écrêtement : plafond d'aides exprimé en % du montant TTC des travaux.
const ECRETEMENT: Record<string, number> = {
  Bleu: 0.9,
  Jaune: 0.75,
  Violet: 0.6,
  Rose: 0.4,
};
const TVA_TAUX = 0.055; // TVA réduite 5,5 % (rénovation énergétique)
// Prime CEE indicative (modifiable) : chez notre partenaire, ~7 000 à
// 8 200 € selon la région ; 7 500 € comme point de départ moyen.
const CEE_DEFAUT = 7500;
const PLAFOND_DEPENSE_MPR = 12000; // dépense éligible plafonnée (mention légale)
// ──────────────────────────────────────────────────────────────────────────

// ── Barème partenaire Econergos / plateforme Prémi ─────────────────────────
// Prémi gère marchandise + installateur + administratif, paie tous les 15
// jours (100 % du CEE, 80 % de MaPrimeRénov ; solde des 20 % restants plus
// tard), et prend une commission de 12 % HT sur le montant MaPrimeRénov.
// Chiffres à jour au 16/09/2026 — certains montants CEE restent "à vérifier"
// auprès d'Econergos (voir feuille Parametres du classeur de suivi).
const PREMI_COMMISSION = 0.12; // % HT sur MaPrimeRénov
const PREMI_TVA_COMMISSION = 0.2;
const PREMI_TAUX_NET_MPR = 1 - PREMI_COMMISSION * (1 + PREMI_TVA_COMMISSION); // 85,6 %

const PREMI_CEE: Record<string, Record<"H1" | "H2", number>> = {
  Bleu: { H1: 8517, H2: 7400 },
  Jaune: { H1: 4580, H2: 3200 },
  Violet: { H1: 4580, H2: 3200 },
};
const PREMI_MPR_BRUT: Record<string, number> = {
  Bleu: 5000,
  Jaune: 4000,
  Violet: 3000,
};
const PREMI_FOURNI_POSE: Record<string, number> = {
  Atlantis: 5700,
  Chappée: 5900,
};
const PREMI_PRECARITES = ["Bleu", "Jaune", "Violet"] as const;
const PREMI_ZONES = ["H1", "H2"] as const;
const PREMI_MARQUES = ["Atlantis", "Chappée"] as const;
// Marge minimum acceptée sur un dossier Prémi. En dessous, on complète en
// facturant un reste à charge au client plutôt que de vendre à perte.
const PREMI_MARGE_MIN = 2500;

// Chiffres relevés à la main par Carole ("Georges") le 25/09/2026, pour
// comparaison avec le calcul Prémi ci-dessus. Pas de formule connue derrière
// ces montants (CEE + MaPrimeRénov confondus) : simple grille figée tant que
// la méthode de calcul de Georges n'est pas précisée.
const GEORGES_TOTAL_PERCU: Record<string, Record<"H1" | "H2", number>> = {
  Bleu: { H1: 13500, H2: 12000 },
  Jaune: { H1: 8600, H2: 7400 },
  Violet: { H1: 7600, H2: 6400 },
};

const CALCUL_METHODES = [
  { key: "premi", label: "Prémi (actuel)" },
  { key: "premi_arrondi", label: "Prémi arrondi" },
  { key: "georges", label: "Georges" },
] as const;
// ──────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "Bleu", label: "Bleu — très modeste", dot: "bg-blue-600" },
  { key: "Jaune", label: "Jaune — modeste", dot: "bg-yellow-400" },
  { key: "Violet", label: "Violet — intermédiaire", dot: "bg-violet-500" },
  { key: "Rose", label: "Rose — supérieur", dot: "bg-pink-500" },
];

const euros = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR")} €`;

// Injecte <meta name="robots" content="noindex"> le temps où la page est
// affichée (retiré ensuite pour ne pas désindexer le reste du site).
function useNoIndex() {
  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.style.direction;
    html.style.direction = "ltr";
    document.title = "Espace Pro — IP5 Énergie";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      html.style.direction = prevDir;
      meta.remove();
    };
  }, []);
}

type FirebaseUser = {
  email: string | null;
  displayName?: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
} | null;

// Message clair selon l'erreur Firebase (surtout la configuration manquante).
function authErrorMessage(e: any): string {
  switch (e?.code) {
    case "auth/operation-not-allowed":
      return "Connexion Google non activée dans Firebase (Authentication → Sign-in method → Google → Activer).";
    case "auth/unauthorized-domain":
      return "Domaine non autorisé : ajoutez ip5-energie.web.app dans Firebase (Authentication → Settings → Authorized domains).";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    default:
      return "Connexion impossible. Vérifiez votre compte Google.";
  }
}

// ── Champ de saisie numérique (gros, mobile-first) ─────────────────────────
const NumField = ({
  label,
  value,
  onChange,
  suffix = "€ HT",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  hint?: string;
}) => (
  <label className="block">
    <span className="block text-sm font-semibold text-gray-700 mb-1.5">
      {label}
    </span>
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        placeholder="0"
        className="w-full text-xl font-bold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3.5 pr-16 outline-none focus:border-[#2b5a8f] transition-colors"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
        {suffix}
      </span>
    </div>
    {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
  </label>
);

// ── Simulateur de marge — dossiers PAC via Econergos / plateforme Prémi ────
export const MargesPremi = () => {
  const [precarite, setPrecarite] =
    useState<(typeof PREMI_PRECARITES)[number]>("Bleu");
  const [zone, setZone] = useState<(typeof PREMI_ZONES)[number]>("H1");
  const [marque, setMarque] =
    useState<(typeof PREMI_MARQUES)[number]>("Atlantis");
  const [methode, setMethode] =
    useState<(typeof CALCUL_METHODES)[number]["key"]>("premi");

  const r = useMemo(() => {
    const cee = PREMI_CEE[precarite]?.[zone] ?? 0;
    const mprBrut = PREMI_MPR_BRUT[precarite] ?? 0;
    const mprNet = mprBrut * PREMI_TAUX_NET_MPR;
    const totalPercuExact = cee + mprNet;
    const totalPercu =
      methode === "premi_arrondi"
        ? Math.round(totalPercuExact / 100) * 100
        : methode === "georges"
          ? (GEORGES_TOTAL_PERCU[precarite]?.[zone] ?? totalPercuExact)
          : totalPercuExact;
    const cout = PREMI_FOURNI_POSE[marque] ?? 0;
    const marge = totalPercu - cout;
    const margePct = totalPercu > 0 ? marge / totalPercu : 0;
    const resteACharge = Math.max(0, PREMI_MARGE_MIN - marge);
    return {
      cee,
      mprBrut,
      mprNet,
      totalPercuExact,
      totalPercu,
      cout,
      marge,
      margePct,
      resteACharge,
    };
  }, [precarite, zone, marque, methode]);

  const margeColor =
    r.margePct >= 0.4
      ? "text-green-600"
      : r.margePct >= 0.2
        ? "text-orange-500"
        : "text-red-600";

  return (
    <>
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
          Choisir le dossier
        </h2>
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              Méthode de calcul
            </span>
            <div className="grid grid-cols-3 gap-2">
              {CALCUL_METHODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMethode(m.key)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    methode === m.key
                      ? "border-[#2b5a8f] bg-blue-50 text-[#2b5a8f]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {methode === "georges" && (
              <p className="text-xs text-gray-400 mt-1.5">
                Grille figée relevée à la main le 25/09/2026 — pas de formule
                CEE/MaPrimeRénov détaillée derrière ces montants.
              </p>
            )}
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              Précarité énergétique
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PREMI_PRECARITES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrecarite(p)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    precarite === p
                      ? "border-[#2b5a8f] bg-blue-50 text-[#2b5a8f]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              Zone climatique
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PREMI_ZONES.map((z) => (
                <button
                  key={z}
                  onClick={() => setZone(z)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    zone === z
                      ? "border-[#2b5a8f] bg-blue-50 text-[#2b5a8f]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              Marque PAC (fourni-posé)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PREMI_MARQUES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMarque(m)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                    marque === m
                      ? "border-[#2b5a8f] bg-blue-50 text-[#2b5a8f]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {m}
                  <span className="block text-xs font-normal text-gray-400">
                    {euros(PREMI_FOURNI_POSE[m])}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="bg-gradient-to-br from-[#173a5e] to-[#2b5a8f] text-white rounded-3xl p-6 text-center shadow-lg">
          <p className="text-blue-100 text-sm font-semibold mb-1">
            Total perçu — CEE + MaPrimeRénov
          </p>
          <p className="text-5xl font-black leading-none">
            {euros(r.totalPercu)}
          </p>
          <p className="text-blue-200 text-xs mt-2">
            {methode === "georges"
              ? "Montant fixe (relevé Georges)"
              : methode === "premi_arrondi"
                ? `Arrondi — calcul exact ${euros(r.totalPercuExact)}`
                : `CEE ${euros(r.cee)} + MaPrimeRénov net ${euros(r.mprNet)}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-gray-500 text-sm font-semibold mb-1">
              Coût fourni-posé
            </p>
            <p className="text-3xl font-black text-gray-900">
              {euros(r.cout)}
            </p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-gray-500 text-sm font-semibold mb-1">Marge</p>
            <p className={`text-3xl font-black ${margeColor}`}>
              {euros(r.marge)}
            </p>
            <p className={`text-sm font-bold ${margeColor}`}>
              {(r.margePct * 100).toFixed(1)} %
            </p>
          </div>
        </div>

        {r.resteACharge > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-5">
            <p className="text-sm font-bold text-red-700 mb-1">
              Marge sous le minimum ({euros(PREMI_MARGE_MIN)})
            </p>
            <p className="text-sm text-red-600">
              Demander au client un reste à charge de{" "}
              <span className="font-black">{euros(r.resteACharge)}</span>{" "}
              pour ramener la marge à {euros(PREMI_MARGE_MIN)}.
            </p>
          </div>
        )}

        {methode === "georges" ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Détail
            </h3>
            <dl className="space-y-2">
              <Row
                k={`Montant Georges (${precarite} ${zone})`}
                v={euros(r.totalPercu)}
                bold
              />
            </dl>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Détail
            </h3>
            <dl className="space-y-2">
              <Row k={`CEE perçu (${precarite} ${zone})`} v={euros(r.cee)} />
              <Row
                k={`MaPrimeRénov brut (${precarite})`}
                v={euros(r.mprBrut)}
              />
              <Row
                k={`Commission Prémi (${Math.round(PREMI_COMMISSION * 100)}% HT)`}
                v={`− ${euros(r.mprBrut - r.mprNet)}`}
              />
              <div className="border-t border-gray-100 pt-2">
                <Row k="MaPrimeRénov net reçu" v={euros(r.mprNet)} bold />
              </div>
              {methode === "premi_arrondi" && (
                <div className="border-t border-gray-100 pt-2">
                  <Row
                    k="Total perçu exact (non arrondi)"
                    v={euros(r.totalPercuExact)}
                  />
                </div>
              )}
            </dl>
          </div>
        )}
      </section>

      <div className="mt-6 text-[11px] leading-relaxed text-gray-400 space-y-1">
        <p className="font-semibold text-gray-500">
          Montants indicatifs — Econergos / plateforme Prémi.
        </p>
        <p>
          Prémi paie 100 % du CEE et 80 % de MaPrimeRénov sous 15 jours,
          solde des 20 % restants plus tard.
        </p>
        <p>
          Certains montants CEE restent à vérifier auprès d'Econergos avant
          utilisation en dossier réel.
        </p>
      </div>
    </>
  );
};

// ── Calculette de devis PAC (affichée seulement une fois autorisé) ─────────
const DevisPAC = ({ email }: { email: string }) => {
  const [clientMode, setClientMode] = useState(false);
  const [prixAchatPompe, setPrixAchatPompe] = useState("");
  const [pose, setPose] = useState("");
  const [nbVentilo, setNbVentilo] = useState("");
  const [prixVentilo, setPrixVentilo] = useState("");
  const [autresCouts, setAutresCouts] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [categorie, setCategorie] = useState("Bleu");
  const [primeCEE, setPrimeCEE] = useState(String(CEE_DEFAUT));

  const num = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isFinite(n) ? n : 0;
  };

  const r = useMemo(() => {
    const sousTotalVentilo = num(nbVentilo) * num(prixVentilo);
    const coutRevient =
      num(prixAchatPompe) + num(pose) + sousTotalVentilo + num(autresCouts);
    const pv = num(prixVente);
    const tva = pv * TVA_TAUX;
    const prixTTC = pv * (1 + TVA_TAUX);
    const marge = pv - coutRevient;
    const margePct = pv > 0 ? marge / pv : 0;
    const mpr = MPR_MONTANT[categorie] ?? 0;
    const cee = num(primeCEE);
    const totalAvantPlafond = mpr + cee;
    const plafond = (ECRETEMENT[categorie] ?? 0) * prixTTC;
    const totalAidesRetenu = Math.min(totalAvantPlafond, plafond);
    const resteACharge = prixTTC - totalAidesRetenu;
    return {
      sousTotalVentilo,
      coutRevient,
      tva,
      prixTTC,
      marge,
      margePct,
      mpr,
      cee,
      totalAvantPlafond,
      plafond,
      totalAidesRetenu,
      resteACharge,
      plafonne: totalAvantPlafond > plafond,
    };
  }, [
    prixAchatPompe,
    pose,
    nbVentilo,
    prixVentilo,
    autresCouts,
    prixVente,
    categorie,
    primeCEE,
  ]);

  const margeColor =
    r.margePct >= 0.3
      ? "text-green-600"
      : r.margePct >= 0.15
        ? "text-orange-500"
        : "text-red-600";

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Lock size={13} /> Calculette IP5 Énergie — {email}
        <button
          onClick={() => setClientMode((v) => !v)}
          className={`ml-auto inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-full transition-colors ${
            clientMode ? "bg-green-100 text-green-700" : "bg-blue-50 text-[#2b5a8f]"
          }`}
        >
          {clientMode ? <EyeOff size={16} /> : <Eye size={16} />}
          {clientMode ? "Mode client" : "Mode interne"}
        </button>
      </div>
      {clientMode && (
        <p className="text-green-600 text-xs font-semibold mb-3">Coûts &amp; marge masqués</p>
      )}
      <>
        {/* NOS COÛTS — masqués en mode client */}
        {!clientMode && (
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Nos coûts (confidentiel)
            </h2>
            <div className="space-y-4">
              <NumField
                label="Prix d'achat de la pompe"
                value={prixAchatPompe}
                onChange={setPrixAchatPompe}
              />
              <NumField label="Pose / sous-traitance" value={pose} onChange={setPose} />
              <div className="grid grid-cols-2 gap-3">
                <NumField
                  label="Nb ventilo-convecteurs"
                  value={nbVentilo}
                  onChange={setNbVentilo}
                  suffix="u."
                />
                <NumField
                  label="Prix unitaire posé"
                  value={prixVentilo}
                  onChange={setPrixVentilo}
                />
              </div>
              {r.sousTotalVentilo > 0 && (
                <p className="text-sm text-gray-500 -mt-1">
                  Sous-total ventilo-convecteurs :{" "}
                  <b className="text-gray-800">{euros(r.sousTotalVentilo)}</b>
                </p>
              )}
              <NumField
                label="Autres coûts"
                value={autresCouts}
                onChange={setAutresCouts}
              />
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                <span className="text-sm font-semibold text-gray-600">
                  Coût de revient total
                </span>
                <span className="text-lg font-black text-gray-900">
                  {euros(r.coutRevient)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* DEVIS CLIENT */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
            Devis client
          </h2>
          <div className="space-y-4">
            <NumField
              label="Prix de vente au client"
              value={prixVente}
              onChange={setPrixVente}
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-blue-50 rounded-2xl px-4 py-3">
                <span className="block text-xs text-gray-500">TVA 5,5 %</span>
                <span className="font-black text-[#2b5a8f]">{euros(r.tva)}</span>
              </div>
              <div className="bg-blue-50 rounded-2xl px-4 py-3">
                <span className="block text-xs text-gray-500">Prix TTC</span>
                <span className="font-black text-[#2b5a8f]">
                  {euros(r.prixTTC)}
                </span>
              </div>
            </div>

            <div>
              <span className="block text-sm font-semibold text-gray-700 mb-1.5">
                Catégorie de revenus (MaPrimeRénov')
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategorie(c.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-sm font-semibold transition-all ${
                      categorie === c.key
                        ? "border-[#2b5a8f] bg-blue-50 text-[#2b5a8f]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <NumField
              label="Prime CEE"
              value={primeCEE}
              onChange={setPrimeCEE}
              suffix="€"
              hint="≈ 7 000 à 8 200 € selon la région — à ajuster selon le partenaire CEE."
            />
          </div>
        </section>

        {/* RÉSULTATS */}
        <section className="space-y-3">
          {/* Reste à charge — mis en avant */}
          <div className="bg-gradient-to-br from-[#173a5e] to-[#2b5a8f] text-white rounded-3xl p-6 text-center shadow-lg">
            <p className="text-blue-100 text-sm font-semibold mb-1">
              Reste à charge du client
            </p>
            <p className="text-5xl font-black leading-none">
              {euros(r.resteACharge)}
            </p>
            <p className="text-blue-200 text-xs mt-2">
              Prix TTC {euros(r.prixTTC)} − aides {euros(r.totalAidesRetenu)}
            </p>
          </div>

          <div className={`grid gap-3 ${clientMode ? "" : "grid-cols-2"}`}>
            {/* Total aides */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-gray-500 text-sm font-semibold mb-1">
                Total des aides
              </p>
              <p className="text-3xl font-black text-green-600">
                {euros(r.totalAidesRetenu)}
              </p>
              {r.plafonne && (
                <p className="text-[11px] text-orange-500 font-semibold mt-1">
                  Plafonné (écrêtement)
                </p>
              )}
            </div>

            {/* Marge — masquée en mode client */}
            {!clientMode && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-center">
                <p className="text-gray-500 text-sm font-semibold mb-1">
                  Notre marge
                </p>
                <p className={`text-3xl font-black ${margeColor}`}>
                  {euros(r.marge)}
                </p>
                <p className={`text-sm font-bold ${margeColor}`}>
                  {(r.margePct * 100).toFixed(1)} %
                </p>
              </div>
            )}
          </div>

          {/* Détail des aides */}
          {!clientMode && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 text-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Détail des aides
              </h3>
              <dl className="space-y-2">
                <Row k={`MaPrimeRénov' (${categorie})`} v={euros(r.mpr)} />
                <Row k="Prime CEE" v={euros(r.cee)} />
                <Row
                  k="Total avant plafond"
                  v={euros(r.totalAvantPlafond)}
                />
                <Row
                  k={`Plafond écrêtement (${Math.round(
                    (ECRETEMENT[categorie] ?? 0) * 100,
                  )}% du TTC)`}
                  v={euros(r.plafond)}
                />
                <div className="border-t border-gray-100 pt-2">
                  <Row
                    k="Aides retenues"
                    v={euros(r.totalAidesRetenu)}
                    bold
                  />
                </div>
              </dl>
            </div>
          )}
        </section>

        {/* Mentions obligatoires */}
        <div className="mt-6 text-[11px] leading-relaxed text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">
            Estimations, selon éligibilité.
          </p>
          <p>
            MaPrimeRénov' 2026 (parcours par geste) : remplacement d'une
            chaudière fioul, gaz ou charbon, réalisé par un artisan RGE ;
            dépense éligible plafonnée à {euros(PLAFOND_DEPENSE_MPR)}. Profil
            Rose = 0 € (non éligible).
          </p>
          <p>La prime CEE varie selon le fournisseur.</p>
          <p>Montants définitifs confirmés au montage du dossier.</p>
        </div>
      </>
    </div>
  );
};

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className="flex items-center justify-between">
    <dt className={`text-gray-600 ${bold ? "font-bold text-gray-900" : ""}`}>
      {k}
    </dt>
    <dd className={`text-gray-900 ${bold ? "font-black" : "font-semibold"}`}>
      {v}
    </dd>
  </div>
);

// ── Page : gère la connexion Google + la liste blanche ─────────────────────
export default function OutilDevis() {
  useNoIndex();
  const [status, setStatus] = useState<
    "loading" | "signed-out" | "authorized" | "denied"
  >("loading");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [authApi, setAuthApi] = useState<any>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<AdminPage>(initialPage);
  const [activeItem, setActiveItem] = useState<SideItem | null>(null);
  const navigate = (p: AdminPage, item?: SideItem) => {
    setPage(p);
    setActiveItem(item ?? null);
    rememberPage(p, item);
  };

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const [{ getEspaceProApp }, auth] = await Promise.all([
        import("@/lib/espacePro"),
        import("firebase/auth"),
      ]);
      // App Firebase dédiée à l'outil : authDomain = domaine du site public,
      // pour que la connexion se fasse en même origine (session persistante)
      // et que l'outil vive sur ip5-energie.web.app (pas de « kachoto »
      // visible). Nécessite d'avoir ajouté l'URI de redirection
      // https://ip5-energie.web.app/__/auth/handler côté OAuth Google.
      // Réutilisée par l'onglet Clients (Firestore) pour partager la même
      // session authentifiée.
      const app = await getEspaceProApp();
      const authInstance = auth.getAuth(app);
      setAuthApi({ ...auth, authInstance });
      // Connexion uniquement par pop-up (voir signIn) : pas de
      // getRedirectResult, qui pouvait resurgir une vieille erreur de
      // redirection restée coincée dans le stockage du navigateur.
      unsub = auth.onAuthStateChanged(authInstance, async (user: FirebaseUser) => {
        const mail = (user?.email ?? "").toLowerCase();
        if (!user || !mail) {
          setStatus("signed-out");
          return;
        }
        // Accès : administrateur d'origine, ou personne ajoutée à l'équipe (claim
        // crm). Une personne tout juste ajoutée reçoit son claim à la première
        // connexion (fonction claimTeamAccess).
        let ok = ALLOWED_EMAILS.includes(mail);
        if (!ok) {
          try {
            ok = (await user.getIdTokenResult()).claims.crm === true;
            if (!ok) {
              const { getFunctions, httpsCallable } = await import("firebase/functions");
              const r = await httpsCallable(getFunctions(app, "europe-west9"), "claimTeamAccess")();
              if ((r.data as { ok?: boolean }).ok) {
                await user.getIdToken(true);
                ok = true;
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
        setEmail(mail);
        setUserName(memberName(mail, user.displayName ?? ""));
        if (ok) {
          // Prépare tout de suite la base du CRM (cache local) pour que les
          // tableaux s'affichent sans attendre.
          import("@/lib/crmDb").then((m) => m.crmFirestore()).catch(() => {});
          setStatus("authorized");
        } else {
          setStatus("denied");
        }
      });
    })().catch((e) => {
      console.error(e);
      setError("Impossible d'initialiser la connexion. Réessayez.");
      setStatus("signed-out");
    });
    return () => unsub();
  }, []);

  const signIn = async () => {
    if (!authApi) return;
    setError("");
    const provider = new authApi.GoogleAuthProvider();
    try {
      // Uniquement pop-up : session fiable même quand le domaine du site
      // diffère de l'authDomain Firebase, et aucun résidu de redirection.
      await authApi.signInWithPopup(authApi.authInstance, provider);
    } catch (e: any) {
      if (e?.code === "auth/popup-blocked") {
        setError(
          "Votre navigateur a bloqué la fenêtre de connexion. Autorisez les pop-ups pour ce site, puis réessayez.",
        );
        return;
      }
      setError(authErrorMessage(e));
    }
  };

  const signOut = async () => {
    if (authApi) await authApi.signOut(authApi.authInstance);
  };

  if (status === "authorized") {
    // La station de gonflage a sa propre mise en page plein écran : le menu
    // n'y est pas affiché, le bouton retour ramène aux leads.
    if (page === "gonflage") {
      return <GonflageCRM email={email} onBack={() => navigate("leads")} />;
    }
    const narrow = (node: React.ReactNode) => <div className="max-w-2xl mx-auto">{node}</div>;
    // Contenu d'une page (utilisé par l'écran principal et par « Ouvrir en superposition »).
    const renderPage = (p: AdminPage, item: SideItem | null, tools: PageTools) => (
      <>
        {p === "leads" && (
          <LeadsCRM
            key={item?.id ?? "leads"}
            email={email}
            boardView={item?.kind === "view" ? item.view : undefined}
            onBoardViewChange={item?.kind === "view" ? (v) => tools.updateItem(item.id, { view: v }) : undefined}
          />
        )}
        {p === "artisans" && <ArtisansCRM email={email} />}
        {p === "stats" && <StatsCRM />}
        {p === "documents" && <DocumentsPage />}
        {p === "equipe" && narrow(<TeamPage email={email} />)}
        {p === "devis" && <DevisPAC email={email} />}
        {p === "marges" && narrow(<MargesPremi />)}
        {p === "clients" && narrow(<ClientsCRM email={email} />)}
      </>
    );
    return (
      <AdminShell
        email={email}
        userName={userName}
        page={page}
        activeItem={activeItem}
        onNavigate={navigate}
        onSignOut={signOut}
        renderPage={renderPage}
      />
    );
  }

  // Écran de connexion / accès refusé
  return (
    <div
      dir="ltr"
      className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
    >
      <div className="max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <LogoIP5 className="h-10 mx-auto mb-6" />

        {status === "loading" && (
          <div className="py-6 text-gray-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Chargement…</span>
          </div>
        )}

        {status === "signed-out" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2b5a8f] flex items-center justify-center mx-auto mb-4">
              <Calculator size={26} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Espace Pro
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Accès réservé aux professionnels IP5 Énergie. Connectez-vous
              avec votre compte Google autorisé.
            </p>
            <button
              onClick={signIn}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#2b5a8f] text-white font-semibold px-6 py-3 rounded-full hover:bg-blue-800 transition-colors"
            >
              Se connecter avec Google
            </button>
            {error && <p className="text-red-600 text-xs mt-4">{error}</p>}
          </>
        )}

        {status === "denied" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={26} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Accès non autorisé
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Ce compte n'a pas accès à cet outil.
            </p>
            <button
              onClick={signOut}
              className="w-full inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold px-6 py-3 rounded-full hover:bg-gray-200 transition-colors"
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </>
        )}
      </div>
    </div>
  );
}
