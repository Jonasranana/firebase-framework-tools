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
import { FIREBASE_CONFIG, LogoIP5 } from "./site-chrome";

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
const CEE_DEFAUT = 4000; // prime CEE indicative, modifiable
const PLAFOND_DEPENSE_MPR = 12000; // dépense éligible plafonnée (mention légale)
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
    document.title = "Outil interne — IP5 Énergie";
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

type FirebaseUser = { email: string | null } | null;

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

// ── Le simulateur (affiché seulement une fois autorisé) ────────────────────
const Simulateur = ({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => void;
}) => {
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
    <div className="min-h-screen bg-gray-50 pb-16" dir="ltr">
      {/* Barre du haut */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <LogoIP5 className="h-9 md:h-9" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setClientMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-full transition-colors ${
                clientMode
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-50 text-[#2b5a8f]"
              }`}
            >
              {clientMode ? <EyeOff size={16} /> : <Eye size={16} />}
              {clientMode ? "Mode client" : "Mode interne"}
            </button>
            <button
              onClick={onSignOut}
              aria-label="Se déconnecter"
              className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-3 mb-4">
          <Lock size={13} /> Outil interne privé — {email}
          {clientMode && (
            <span className="ml-auto text-green-600 font-semibold">
              Coûts &amp; marge masqués
            </span>
          )}
        </div>

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
              hint="Modifiable — varie selon le fournisseur."
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
      </div>
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
  const [authApi, setAuthApi] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const [{ initializeApp, getApps, getApp }, auth] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
      ]);
      const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
      const authInstance = auth.getAuth(app);
      setAuthApi({ ...auth, authInstance });
      // Termine un éventuel retour de redirection et remonte les erreurs
      // de configuration (ex. connexion Google non activée dans Firebase).
      auth.getRedirectResult(authInstance).catch((e: any) => {
        setError(authErrorMessage(e));
      });
      unsub = auth.onAuthStateChanged(authInstance, (user: FirebaseUser) => {
        const mail = (user?.email ?? "").toLowerCase();
        if (!mail) {
          setStatus("signed-out");
        } else if (ALLOWED_EMAILS.includes(mail)) {
          setEmail(mail);
          setStatus("authorized");
        } else {
          setEmail(mail);
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
    try {
      const provider = new authApi.GoogleAuthProvider();
      // Redirection (fiable sur mobile, contrairement au popup souvent bloqué)
      await authApi.signInWithRedirect(authApi.authInstance, provider);
    } catch (e: any) {
      setError(authErrorMessage(e));
    }
  };

  const signOut = async () => {
    if (authApi) await authApi.signOut(authApi.authInstance);
  };

  if (status === "authorized") {
    return <Simulateur email={email} onSignOut={signOut} />;
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
              Outil interne — Devis
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Accès réservé. Connectez-vous avec votre compte Google autorisé.
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
