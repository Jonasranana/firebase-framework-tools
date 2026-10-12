import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  Loader2,
  LogOut,
  MailCheck,
  MapPin,
  Package,
  Truck,
  Wrench,
} from "lucide-react";
import { LogoIP5 } from "./site-chrome";
import { getEspaceProApp } from "@/lib/espacePro";
import {
  ARTISAN_GRID_SECTIONS,
  SUPPLIED_MATERIAL,
  TRAVEL_FIELDS,
  type ArtisanGrid,
} from "@/lib/artisanGrid";

// ─────────────────────────────────────────────────────────────────────────
// ESPACE ARTISANS PARTENAIRES — route /espace-pro.
// Les artisans (pas l'équipe IP5, dont l'outil interne est sur /admin)
// créent un compte, remplissent leur grille de prix de pose et cliquent
// « J'ai terminé ». La grille est enregistrée automatiquement dans
// Firestore artisan_grids/{uid} ; la Cloud Function
// notifyArtisanGridSubmitted envoie alors le PDF à IP5 et à l'artisan.
// Aucun tarif IP5 n'est affiché ici.
// ─────────────────────────────────────────────────────────────────────────

type Status = "loading" | "signed-out" | "ready" | "done";

const EMPTY: ArtisanGrid = {
  email: "",
  company: {},
  travel: {},
  prices: {},
  comment: "",
  status: "draft",
};

const input =
  "w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-[#2b5a8f] outline-none text-sm";

function authMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou mot de passe incorrect.";
    case "auth/email-already-in-use":
      return "Un compte existe déjà avec cet e-mail : connectez-vous.";
    case "auth/weak-password":
      return "Mot de passe trop court (6 caractères minimum).";
    case "auth/invalid-email":
      return "Adresse e-mail invalide.";
    case "auth/popup-blocked":
      return "La fenêtre Google a été bloquée : autorisez les pop-ups puis réessayez.";
    case "auth/popup-closed-by-user":
      return "";
    case "auth/operation-not-allowed":
      return "Ce mode de connexion n'est pas encore activé. Utilisez Google ou appelez-nous au 07 49 52 52 67.";
    default:
      return "Une erreur est survenue. Réessayez ou appelez-nous au 07 49 52 52 67.";
  }
}

export default function EspaceArtisan() {
  const [status, setStatus] = useState<Status>("loading");
  const [api, setApi] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [grid, setGrid] = useState<ArtisanGrid>(EMPTY);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const [open, setOpen] = useState<string>("pose_mono");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    document.title = "Espace artisans partenaires — IP5 Énergie";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const [app, auth, fs] = await Promise.all([
        getEspaceProApp(),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);
      const authInstance = auth.getAuth(app);
      const db = fs.getFirestore(app);
      setApi({ auth, fs, authInstance, db });
      unsub = auth.onAuthStateChanged(authInstance, async (u: any) => {
        loaded.current = false;
        if (!u) {
          setUser(null);
          setStatus("signed-out");
          return;
        }
        setUser(u);
        try {
          const snap = await fs.getDoc(fs.doc(db, "artisan_grids", u.uid));
          const data = snap.exists() ? (snap.data() as Partial<ArtisanGrid>) : {};
          setGrid({
            ...EMPTY,
            ...data,
            email: (u.email ?? "").toLowerCase(),
            company: { ...(data.company ?? {}) },
            travel: { ...(data.travel ?? {}) },
            prices: { ...(data.prices ?? {}) },
          });
        } catch (e) {
          console.error(e);
          setGrid({ ...EMPTY, email: (u.email ?? "").toLowerCase() });
        }
        loaded.current = true;
        setStatus("ready");
      });
    })().catch((e) => {
      console.error(e);
      setStatus("signed-out");
    });
    return () => unsub();
  }, []);

  const save = async (next: ArtisanGrid, extra: Record<string, unknown> = {}) => {
    if (!api || !user) return;
    setSaveState("saving");
    try {
      await api.fs.setDoc(
        api.fs.doc(api.db, "artisan_grids", user.uid),
        {
          email: next.email,
          company: next.company,
          travel: next.travel,
          prices: next.prices,
          comment: next.comment,
          status: next.status,
          updatedAt: api.fs.serverTimestamp(),
          ...extra,
        },
        { merge: true },
      );
      setSaveState("saved");
    } catch (e) {
      console.error(e);
      setSaveState("error");
      throw e;
    }
  };

  // Enregistrement automatique, 1 s après la dernière frappe.
  const update = (fn: (g: ArtisanGrid) => ArtisanGrid) => {
    setGrid((prev) => {
      const next = fn(prev);
      if (loaded.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => save(next).catch(() => {}), 1000);
      }
      return next;
    });
  };

  const filledPrices = useMemo(
    () => Object.values(grid.prices).filter((v) => String(v ?? "").trim() !== "").length,
    [grid.prices],
  );

  const finish = async () => {
    const errs: string[] = [];
    if (filledPrices === 0) errs.push("Indiquez au moins un prix de pose.");
    setErrors(errs);
    if (errs.length) return;
    setSubmitting(true);
    clearTimeout(saveTimer.current);
    try {
      const next = { ...grid, status: "submitted" as const };
      await save(next, { submittedAt: api.fs.serverTimestamp() });
      setGrid(next);
      setStatus("done");
      window.scrollTo({ top: 0 });
    } catch {
      setErrors(["L'envoi a échoué. Réessayez dans un instant ou appelez-nous au 07 49 52 52 67."]);
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => api?.auth.signOut(api.authInstance);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#eef4fb] to-[#dce9f7]" dir="ltr" style={{ colorScheme: "light" }}>
      <header className="bg-white/80 backdrop-blur border-b border-gray-100">
        <div className={`${status === "signed-out" ? "max-w-5xl" : "max-w-3xl"} mx-auto px-4 py-4 flex items-center justify-between gap-3`}>
          <a href="/">
            <LogoIP5 className="h-9 !text-[#f28c28]" />
          </a>
          {user && (
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              <LogOut size={16} /> Déconnexion
            </button>
          )}
        </div>
      </header>

      <main className={`${status === "signed-out" ? "max-w-5xl" : "max-w-3xl"} mx-auto px-4 py-6 sm:py-8`}>
        {status === "loading" && (
          <div className="py-20 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {status === "signed-out" && api && (
          <>
            <Presentation />
            <div id="inscription" className="scroll-mt-6 mt-10">
              <Login api={api} />
            </div>
          </>
        )}

        {status === "done" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={48} />
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Merci, c'est bien reçu !</h1>
            <p className="text-gray-600 mb-2">
              Votre grille a été transmise à IP5 Énergie. Vous allez recevoir une copie en PDF par e-mail.
            </p>
            <p className="text-gray-600 mb-6">Nous revenons vers vous très rapidement.</p>
            <button
              onClick={() => setStatus("ready")}
              className="text-[#2b5a8f] font-semibold underline"
            >
              Modifier ma grille
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Vos tarifs de pose</h1>
            <p className="text-gray-600 mt-2">
              Indiquez vos prix <b>hors taxes</b> pour la pose. Laissez vide ce que vous ne faites pas. Tout est
              enregistré automatiquement : vous pouvez revenir plus tard.
            </p>
            <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-[#173a5e]">
              <b>Pourquoi cette grille ?</b> Elle nous permet de vous proposer directement des chantiers dans
              votre secteur, au prix que <b>vous</b> avez fixé et dans le rayon que vous acceptez, sans
              renégocier à chaque fois.
            </div>
            {user && !user.emailVerified && user.providerData?.[0]?.providerId === "password" && (
              <p className="mt-4 flex gap-2 items-start text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">
                <MailCheck size={18} className="flex-shrink-0 mt-0.5" />
                Pensez à confirmer votre adresse e-mail (lien reçu par mail) pour recevoir la copie PDF de votre grille.
              </p>
            )}

            <section className="mt-6 bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Package size={18} className="text-[#2b5a8f]" /> Matériel fourni et livré par IP5
              </h2>
              <p className="text-sm text-gray-600 mt-1">Vous n'achetez pas le matériel : vos prix concernent la pose.</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {SUPPLIED_MATERIAL.map((m) => (
                  <div key={m.brand} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                    {m.image ? (
                      <img src={m.image} alt={`${m.brand} ${m.model}`} className="w-16 h-12 object-cover rounded-lg" />
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                        {m.brand}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{m.brand}</div>
                      <div className="text-xs text-gray-500">{m.model}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6 space-y-3">
              <Panel id="travel" title="Déplacements" icon={<Truck size={18} />} open={open} setOpen={setOpen}>
                <div className="space-y-3">
                  {TRAVEL_FIELDS.map((f) => (
                    <PriceRow
                      key={f.id}
                      label={f.label}
                      unit={f.unit}
                      value={grid.travel[f.id] ?? ""}
                      onChange={(v) => update((g) => ({ ...g, travel: { ...g.travel, [f.id]: v } }))}
                    />
                  ))}
                </div>
              </Panel>

              {ARTISAN_GRID_SECTIONS.map((s) => (
                <Panel key={s.id} id={s.id} title={s.title} open={open} setOpen={setOpen}>
                  {s.hint && <p className="text-xs text-gray-500 mb-3">{s.hint}</p>}
                  <div className="space-y-3">
                    {s.lines.map((l) => (
                      <PriceRow
                        key={l.id}
                        label={l.label}
                        unit={l.unit}
                        value={grid.prices[l.id] ?? ""}
                        onChange={(v) => update((g) => ({ ...g, prices: { ...g.prices, [l.id]: v } }))}
                      />
                    ))}
                  </div>
                </Panel>
              ))}

              <Panel id="comment" title="Commentaire (facultatif)" open={open} setOpen={setOpen}>
                <textarea
                  className={`${input} min-h-[100px]`}
                  maxLength={2000}
                  placeholder="Conditions particulières, délais, disponibilités…"
                  value={grid.comment}
                  onChange={(e) => update((g) => ({ ...g, comment: e.target.value }))}
                />
              </Panel>
            </div>

            <div className="sticky bottom-0 mt-6 -mx-4 px-4 py-4 bg-white/95 backdrop-blur border-t border-gray-200">
              {errors.map((e) => (
                <p key={e} className="text-sm text-red-600 mb-2">
                  {e}
                </p>
              ))}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 flex-1">
                  {filledPrices} prix renseigné{filledPrices > 1 ? "s" : ""}
                  {saveState === "saving" && " · enregistrement…"}
                  {saveState === "saved" && " · enregistré ✓"}
                  {saveState === "error" && " · erreur d'enregistrement"}
                </span>
                <button
                  onClick={finish}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-[#f28c28] hover:bg-[#e07a12] text-white font-bold px-6 py-3 rounded-full shadow-md disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={18} />}
                  J'ai terminé
                </button>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-10">
          Une question ? 07 49 52 52 67 · contact@ip5energie.com
        </p>
      </main>
    </div>
  );
}

// Présentation de l'offre aux artisans (visible avant la connexion) : tout
// ce qu'il faut savoir même si on ne les a pas eus au téléphone.
const OFFER = [
  {
    icon: MapPin,
    title: "Des chantiers près de chez vous",
    text: "Nous trouvons les clients et vous proposons des installations de pompes à chaleur dans votre secteur.",
  },
  {
    icon: Package,
    title: "Matériel fourni et livré",
    text: "PAC Atlantic ou Chappée livrées par IP5 : vous n'achetez rien, vous posez.",
  },
  {
    icon: FileCheck2,
    title: "Zéro administratif",
    text: "Dossiers d'aides (CEE, MaPrimeRénov'), devis et suivi client : notre équipe s'occupe de tout.",
  },
  {
    icon: Wrench,
    title: "Vos prix, vos conditions",
    text: "Vous fixez vos tarifs de pose et votre rayon d'intervention. Vous restez libre d'accepter chaque chantier.",
  },
];

const STEPS = [
  { icon: ClipboardList, title: "Vous remplissez votre grille", text: "5 minutes, sur téléphone ou ordinateur." },
  { icon: MapPin, title: "On vous propose des chantiers", text: "Dans votre zone, à vos prix, selon vos disponibilités." },
  { icon: CalendarCheck, title: "Vous posez, on gère le reste", text: "Matériel livré, client et dossier suivis par IP5." },
];

// Photo d'illustration (image générée, pas un vrai client).
const HERO_PHOTO = "/images/artisans/installateur-client.jpg";

const goToSignup = () =>
  document.getElementById("inscription")?.scrollIntoView({ behavior: "smooth", block: "start" });

function Presentation() {
  return (
    <div>
      <section className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
        <div className="order-2 md:order-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#f28c28]">Artisans RGE QualiPAC</p>
          <h1 className="text-[28px] leading-tight md:text-4xl font-extrabold text-[#0f2b4a] mt-2">
            Recevez des chantiers de pompes à chaleur dans votre région
          </h1>
          <p className="text-gray-600 mt-4 text-base md:text-lg">
            IP5 Énergie accompagne des particuliers qui remplacent leur chaudière fioul ou gaz. Nous cherchons des
            artisans de confiance pour réaliser la pose près de chez eux.
          </p>
          <button
            onClick={goToSignup}
            className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f28c28] hover:bg-[#e07a12] text-white font-bold text-lg px-8 py-4 rounded-full shadow-lg shadow-orange-200"
          >
            Remplir ma grille de tarifs
          </button>
          <p className="text-xs text-gray-500 mt-3">Gratuit et sans engagement · 5 minutes</p>
        </div>
        <div className="order-1 md:order-2">
          <img
            src={HERO_PHOTO}
            alt="Un installateur et des propriétaires satisfaits devant leur pompe à chaleur"
            className="w-full h-56 sm:h-72 md:h-[22rem] object-cover rounded-3xl shadow-xl ring-4 ring-white"
          />
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Ce que nous vous proposons</h2>
        <div className="grid sm:grid-cols-2 gap-3 md:gap-4 mt-4">
          {OFFER.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-[#2b5a8f] flex items-center justify-center">
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-bold text-gray-900">{title}</span>
                <span className="block text-sm text-gray-600 mt-0.5">{text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Comment ça marche</h2>
        <ol className="grid md:grid-cols-3 gap-3 md:gap-4 mt-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex md:flex-col gap-3 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#f28c28] text-white font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>
                <span className="flex items-center gap-2 font-bold text-gray-900">
                  <Icon size={18} className="text-[#2b5a8f] hidden md:inline" /> {title}
                </span>
                <span className="block text-sm text-gray-600 mt-0.5">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-100 p-4 md:p-5 text-sm md:text-base text-[#173a5e]">
          <b>Pourquoi une grille de tarifs ?</b> Avec vos prix de pose, votre rayon de déplacement et la distance
          maximale que vous acceptez, nous savons tout de suite quels chantiers vous proposer. Pas de négociation à
          chaque fois : vous recevez uniquement des installations qui vous conviennent.
        </div>
      </section>
    </div>
  );
}

function Panel({
  id,
  title,
  icon,
  open,
  setOpen,
  children,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  open: string;
  setOpen: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <section className="bg-white rounded-2xl border border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(isOpen ? "" : id)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-bold text-gray-900"
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-[#2b5a8f]">{icon}</span>}
          {title}
        </span>
        <ChevronDown size={20} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function PriceRow({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 sm:gap-3">
      <span className="flex-1 min-w-0 text-sm text-gray-700 leading-snug">{label}</span>
      <input
        inputMode="decimal"
        className="w-24 sm:w-28 flex-shrink-0 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-semibold text-right text-base focus:border-[#2b5a8f] outline-none"
        value={value}
        maxLength={12}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,\s]/g, ""))}
      />
      <span className="w-14 sm:w-20 flex-shrink-0 text-[11px] sm:text-xs leading-tight text-gray-500">{unit}</span>
    </label>
  );
}

function Login({ api }: { api: any }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setMsg("");
    try {
      await api.auth.signInWithPopup(api.authInstance, new api.auth.GoogleAuthProvider());
    } catch (e: any) {
      setMsg(authMessage(e?.code));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await api.auth.signInWithEmailAndPassword(api.authInstance, email.trim(), password);
      } else if (mode === "signup") {
        const cred = await api.auth.createUserWithEmailAndPassword(api.authInstance, email.trim(), password);
        await api.auth.sendEmailVerification(cred.user).catch(() => {});
      } else {
        await api.auth.sendPasswordResetEmail(api.authInstance, email.trim());
        setMsg("Si un compte existe, un e-mail de réinitialisation vient d'être envoyé.");
      }
    } catch (err: any) {
      setMsg(authMessage(err?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
      <h2 className="text-2xl font-extrabold text-gray-900">Accédez à votre grille</h2>
      <p className="text-sm text-gray-600 mt-2 mb-6">
        Créez votre compte (ou connectez-vous) pour indiquer vos tarifs de pose. Tout est enregistré
        automatiquement : vous pouvez revenir quand vous voulez.
      </p>
      <button
        onClick={google}
        className="w-full rounded-full border-2 border-gray-200 py-3 font-semibold text-gray-800 hover:border-gray-300"
      >
        Continuer avec Google
      </button>
      <div className="flex items-center gap-3 my-5 text-xs text-gray-400">
        <span className="flex-1 h-px bg-gray-200" /> ou avec votre e-mail <span className="flex-1 h-px bg-gray-200" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Adresse e-mail"
          autoComplete="email"
          className={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== "reset" && (
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe (6 caractères minimum)"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <button
          disabled={busy}
          className="w-full bg-[#2b5a8f] text-white font-bold py-3 rounded-full disabled:opacity-50"
        >
          {mode === "signin" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Recevoir le lien"}
        </button>
      </form>
      {msg && <p className="text-sm text-gray-700 mt-3">{msg}</p>}
      <div className="mt-5 text-sm text-center space-y-1">
        {mode !== "signup" && (
          <button className="text-[#2b5a8f] font-semibold block mx-auto" onClick={() => setMode("signup")}>
            Pas encore de compte ? Créer un compte
          </button>
        )}
        {mode !== "signin" && (
          <button className="text-[#2b5a8f] font-semibold block mx-auto" onClick={() => setMode("signin")}>
            J'ai déjà un compte
          </button>
        )}
        {mode === "signin" && (
          <button className="text-gray-500 block mx-auto" onClick={() => setMode("reset")}>
            Mot de passe oublié ?
          </button>
        )}
      </div>
    </div>
  );
}
