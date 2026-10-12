import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  LogOut,
  MailCheck,
  Package,
  Truck,
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
    <div className="min-h-screen bg-gray-50" dir="ltr" style={{ colorScheme: "light" }}>
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <a href="/">
            <LogoIP5 className="h-9" />
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

      <main className="max-w-3xl mx-auto px-4 py-8">
        {status === "loading" && (
          <div className="py-20 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {status === "signed-out" && api && <Login api={api} />}

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

            <div className="sticky bottom-0 mt-6 -mx-4 px-4 py-4 bg-gray-50/95 backdrop-blur border-t border-gray-200">
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
                  className="inline-flex items-center gap-2 bg-[#2b5a8f] hover:bg-[#1f4470] text-white font-bold px-6 py-3 rounded-full disabled:opacity-50"
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
    <label className="flex items-center gap-3">
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      <input
        inputMode="decimal"
        className="w-28 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-semibold text-right text-base focus:border-[#2b5a8f] outline-none"
        value={value}
        maxLength={12}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,\s]/g, ""))}
      />
      <span className="w-20 text-xs text-gray-500">{unit}</span>
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
      <h1 className="text-2xl font-extrabold text-gray-900">Espace artisans partenaires</h1>
      <p className="text-sm text-gray-600 mt-2 mb-6">
        Créez votre compte puis indiquez vos tarifs de pose. Le matériel (Atlantic, Chappée) est fourni et livré par
        IP5 Énergie.
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
