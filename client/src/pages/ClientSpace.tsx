import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageLayout } from "./ip5-sections";
import ClientSpaceDashboard from "./ClientSpaceDashboard";
import { getEspaceProApp } from "@/lib/espacePro";
import type { ClientView } from "@/lib/clientSpace";

// ─────────────────────────────────────────────────────────────────────────
// Espace client (/mon-espace) : connexion par e-mail + mot de passe, e-mail vérifié
// obligatoire, puis suivi du dossier. NON PUBLIÉ pour l'instant : la route n'est pas
// ajoutée à l'application (voir CLIENT_SPACE_PUBLIC dans App.tsx) et le serveur répond
// « désactivé » tant que crm_settings/client_space n'est pas activé.
// ─────────────────────────────────────────────────────────────────────────
type Data = { enabled: boolean; view: ClientView | null };

export default function ClientSpace() {
  const [auth, setAuth] = useState<any>(null);
  const [user, setUser] = useState<any>(undefined);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    (async () => {
      const app = await getEspaceProApp();
      const a = await import("firebase/auth");
      const inst = a.getAuth(app);
      setAuth({ a, inst });
      a.onAuthStateChanged(inst, (u: any) => setUser(u ?? null));
    })();
  }, []);

  useEffect(() => {
    if (!user || !user.emailVerified) return setData(null);
    (async () => {
      try {
        const app = await getEspaceProApp();
        const { getFunctions, httpsCallable } = await import("firebase/functions");
        await user.getIdToken(true);
        const r: any = await httpsCallable(getFunctions(app, "europe-west9"), "getClientSpace")();
        setData(r.data as Data);
      } catch (e: any) {
        setMsg(e?.message || "Impossible de charger votre espace.");
      }
    })();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setBusy(true);
    setMsg("");
    try {
      if (mode === "signup") {
        const c = await auth.a.createUserWithEmailAndPassword(auth.inst, email.trim(), password);
        await auth.a.sendEmailVerification(c.user);
        setMsg("Compte créé. Cliquez sur le lien reçu par e-mail pour le vérifier, puis reconnectez-vous.");
        await auth.a.signOut(auth.inst);
      } else {
        await auth.a.signInWithEmailAndPassword(auth.inst, email.trim(), password);
      }
    } catch (err: any) {
      setMsg(err?.code === "auth/invalid-credential" ? "E-mail ou mot de passe incorrect." : err?.message || "Échec de la connexion.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-gray-900 focus:border-[#2b5a8f] focus:ring-2 focus:ring-[#2b5a8f]/15 outline-none";
  return (
    <PageLayout title="Mon espace client — IP5 Énergie">
      <div className="pt-36 pb-20 px-4 bg-slate-50 min-h-screen">
        {user === undefined && <Loader2 className="animate-spin text-slate-400 mx-auto" />}
        {user === null && (
          <form onSubmit={submit} className="max-w-sm mx-auto bg-white border border-slate-200 rounded-xl p-6 space-y-3 shadow-sm">
            <h1 className="text-xl font-bold text-[#0f2a47]">{mode === "login" ? "Connexion à votre espace" : "Créer mon espace"}</h1>
            <p className="text-sm text-slate-500">Utilisez l'adresse e-mail que vous nous avez communiquée.</p>
            <input type="email" required autoComplete="email" placeholder="Votre e-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            <input type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mot de passe (8 caractères minimum)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            {msg && <p className="text-sm text-slate-700">{msg}</p>}
            <button disabled={busy} className="w-full bg-[#173a5e] hover:bg-[#122f4d] text-white font-semibold rounded-lg py-3 disabled:opacity-60">
              {busy ? "…" : mode === "login" ? "Me connecter" : "Créer mon compte"}
            </button>
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }} className="w-full text-sm text-[#2b5a8f] font-semibold">
              {mode === "login" ? "Première visite ? Créer mon espace" : "J'ai déjà un compte"}
            </button>
          </form>
        )}
        {user && !user.emailVerified && (
          <div className="max-w-sm mx-auto bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
            <p className="font-semibold text-[#0f2a47]">Vérifiez votre adresse e-mail</p>
            <p className="text-sm text-slate-600">Cliquez sur le lien que nous vous avons envoyé, puis actualisez cette page.</p>
            <button onClick={() => auth?.a.signOut(auth.inst)} className="text-sm text-[#2b5a8f] font-semibold">Se déconnecter</button>
          </div>
        )}
        {user?.emailVerified && !data && !msg && <Loader2 className="animate-spin text-slate-400 mx-auto" />}
        {user?.emailVerified && msg && !data && <p className="text-center text-slate-600">{msg}</p>}
        {data && !data.enabled && <p className="text-center text-slate-600">L'espace client sera bientôt disponible.</p>}
        {data?.enabled && !data.view && <p className="text-center text-slate-600">Nous ne trouvons pas encore de dossier à cette adresse e-mail. Appelez-nous au 07 49 52 52 67.</p>}
        {data?.enabled && data.view && (
          <>
            <ClientSpaceDashboard view={data.view} />
            <p className="text-center mt-6">
              <button onClick={() => auth?.a.signOut(auth.inst)} className="text-sm text-slate-500 underline">Se déconnecter</button>
            </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
