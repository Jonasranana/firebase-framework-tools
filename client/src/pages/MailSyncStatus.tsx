import { useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";

// Pastille de la barre du haut : état de la synchronisation de la boîte
// contact@ avec le CRM (fonction syncMailbox) + bouton « Actualiser » qui
// demande une synchronisation immédiate (document crm_mail_requests).
type State = {
  ok?: boolean;
  reason?: string;
  message?: string;
  lastRunAt?: { toMillis?: () => number };
  runningSince?: number;
};

const ago = (ms: number) => {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
};

export default function MailSyncStatus({ email }: { email: string }) {
  const [state, setState] = useState<State | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, "crm_mail_state", "main"),
          (snap) => !cancelled && setState((snap.data() as State) ?? null),
          () => !cancelled && setState(null),
        );
      } catch {
        setState(null);
      }
    })();
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => {
      cancelled = true;
      unsub?.();
      clearInterval(t);
    };
  }, []);

  const refresh = async () => {
    setBusy(true);
    try {
      const { m, db } = await crmFirestore();
      await m.addDoc(m.collection(db, "crm_mail_requests"), { by: email, at: m.serverTimestamp() });
      setTimeout(() => setBusy(false), 8000);
    } catch (e) {
      console.error(e);
      setBusy(false);
      alert("Impossible de lancer la synchronisation (règle Firestore crm_mail_requests à publier ?).");
    }
  };

  const last = state?.lastRunAt?.toMillis?.();
  const bad = state && state.ok === false;
  const label = bad
    ? state?.reason === "scope"
      ? "Boîte contact@ non connectée"
      : "Erreur boîte contact@"
    : last
      ? `Boîte contact@ ${ago(last)}`
      : "Boîte contact@ : jamais synchronisée";

  return (
    <div
      className={`ml-auto flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${
        bad ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-600 border-gray-200"
      }`}
      title={state?.message ?? ""}
    >
      <Mail size={13} className="shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <button onClick={refresh} disabled={busy} aria-label="Actualiser les mails" className="text-[#2b5a8f]">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      </button>
    </div>
  );
}
