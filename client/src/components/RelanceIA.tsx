import { useState } from "react";
import { getEspaceProApp } from "@/lib/espacePro";
import { LEAD_STATUSES, NEWS_VIEWERS, whatsappHref, type Lead } from "@/lib/crm";
import type { LeadColumn } from "@/lib/crmColumns";

// ─────────────────────────────────────────────────────────────────────────
// Assistant de relance : on raconte l'appel, Claude propose la marche à
// suivre (résumé, prochaine action, jour et heure de rappel, étiquette,
// étape du dossier, message de relance). Rien n'est enregistré avant le clic
// sur « Valider ». Réservé à la direction (NEWS_VIEWERS).
// Fonctions serveur : planifierRelance / validerRelance (functions/relanceIA.js).
// ─────────────────────────────────────────────────────────────────────────
type Plan = {
  resume: string;
  negocie: string[];
  attentes_client: string[];
  a_faire_ip5: string[];
  prochaine_action: string;
  rappel_date: string;
  rappel_heure: string;
  rappel_alternative: string;
  pourquoi: string;
  statut: string;
  etape: string;
  message_relance: string;
  vigilance: string;
};

async function callFn<T>(name: string, data?: unknown): Promise<T> {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const fn = httpsCallable(getFunctions(app, "europe-west9"), name, { timeout: 120000 });
  return (await fn(data)).data as T;
}

const errText = (e: unknown) => {
  const code = String((e as { code?: string })?.code ?? "");
  const msg = String((e as { message?: string })?.message ?? "");
  // Fonction pas encore mise en ligne : Firebase renvoie « not-found » ou « internal » sans message utile.
  if ((code.endsWith("not-found") && /^not[ _-]?found$/i.test(msg)) || (code.endsWith("internal") && /^internal$/i.test(msg)))
    return "L'assistant n'est pas encore activé (clé d'accès à l'IA à enregistrer).";
  return msg || "Une erreur est survenue, réessayez.";
};

const List = ({ title, items }: { title: string; items: string[] }) =>
  items?.length ? (
    <div className="mt-2">
      <p className="text-[12px] font-bold uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((x, i) => (
          <li key={i} className="text-[14px] text-gray-800 leading-snug">
            • {x}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

export default function RelanceIA({ lead, email, etapeCol }: { lead: Lead; email: string; etapeCol?: LeadColumn }) {
  const [cr, setCr] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<"" | "analyse" | "valide">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [copied, setCopied] = useState(false);
  if (!NEWS_VIEWERS.includes(email.toLowerCase())) return null;

  const etapes = (etapeCol?.options ?? []).filter((o) => o.label && !o.off).map((o) => ({ key: o.key, label: o.label }));
  const statuts = LEAD_STATUSES.filter((s) => s.label).map((s) => ({ key: s.key, label: s.label }));
  const labels: Record<string, string> = Object.fromEntries([...statuts, ...etapes].map((o) => [o.key, o.label]));

  const analyser = async () => {
    setError("");
    setDone("");
    setBusy("analyse");
    try {
      const r = await callFn<{ plan: Plan }>("planifierRelance", { leadId: lead.id, compteRendu: cr, statuts, etapes, etapeKey: etapeCol?.key ?? "" });
      setPlan(r.plan);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  };

  const valider = async () => {
    if (!plan) return;
    setError("");
    setBusy("valide");
    try {
      await callFn("validerRelance", { leadId: lead.id, compteRendu: cr, plan, etapeKey: etapeCol?.key ?? "", labels });
      setDone(`✅ Enregistré : ${labels[plan.statut] ?? "statut"}${plan.etape ? ` · étape ${labels[plan.etape] ?? plan.etape}` : ""}${plan.rappel_date ? ` · rappel le ${plan.rappel_date.split("-").reverse().join("/")}${plan.rappel_heure ? ` à ${plan.rappel_heure}` : ""}` : ""}`);
      setPlan(null);
      setCr("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  };

  const set = (k: keyof Plan, v: string) => plan && setPlan({ ...plan, [k]: v });
  const field = "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[15px]";
  const wa = whatsappHref(lead.phone);

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-3.5 my-3">
      <p className="font-extrabold text-gray-900">🤖 Assistant de relance</p>
      {!plan && (
        <>
          <textarea
            value={cr}
            onChange={(e) => setCr(e.target.value)}
            rows={5}
            placeholder="Racontez l'appel : ce qui a été dit, proposé, promis, les documents attendus, ses disponibilités… (sur téléphone, le micro du clavier permet de dicter)"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-[16px] leading-relaxed"
          />
          <button
            type="button"
            onClick={analyser}
            disabled={busy !== "" || cr.trim().length < 10}
            className="mt-2 w-full rounded-xl bg-violet-600 text-white font-bold py-3 disabled:opacity-50"
          >
            {busy === "analyse" ? "Analyse en cours… (10 à 30 secondes)" : "🤖 Analyser et planifier"}
          </button>
        </>
      )}
      {done && <p className="mt-2 text-[14px] font-semibold text-emerald-700">{done}</p>}
      {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}

      {plan && (
        <div className="mt-2 rounded-xl bg-white border border-gray-200 p-3">
          <p className="text-[15px] text-gray-800 leading-relaxed">{plan.resume}</p>
          <List title="Négocié / proposé" items={plan.negocie} />
          <List title="Le client doit" items={plan.attentes_client} />
          <List title="IP5 doit" items={plan.a_faire_ip5} />
          <div className="mt-3 rounded-lg bg-violet-50 p-2.5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-violet-700">Prochaine action</p>
            <textarea value={plan.prochaine_action} onChange={(e) => set("prochaine_action", e.target.value)} rows={2} className={`${field} mt-1`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[12px] font-bold text-gray-500">
              Jour du rappel
              <input type="date" value={plan.rappel_date} onChange={(e) => set("rappel_date", e.target.value)} className={field} />
            </label>
            <label className="text-[12px] font-bold text-gray-500">
              Heure
              <input type="time" value={plan.rappel_heure} onChange={(e) => set("rappel_heure", e.target.value)} className={field} />
            </label>
          </div>
          {plan.pourquoi && <p className="mt-1 text-[13px] text-gray-600">💡 {plan.pourquoi}</p>}
          {plan.rappel_alternative && <p className="text-[13px] text-gray-500">Sinon : {plan.rappel_alternative}</p>}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-[12px] font-bold text-gray-500">
              Étiquette (statut)
              <select value={plan.statut} onChange={(e) => set("statut", e.target.value)} className={field}>
                {statuts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-bold text-gray-500">
              Étape du dossier
              <select value={plan.etape} onChange={(e) => set("etape", e.target.value)} className={field}>
                <option value="">— Ne pas changer —</option>
                {etapes.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {plan.vigilance && <p className="mt-3 text-[13px] text-amber-800 bg-amber-50 rounded-lg p-2">⚠️ {plan.vigilance}</p>}
          {plan.message_relance && (
            <div className="mt-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-gray-500">Message de relance</p>
              <textarea value={plan.message_relance} onChange={(e) => set("message_relance", e.target.value)} rows={3} className={`${field} mt-1`} />
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(plan.message_relance);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {}
                  }}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-[14px] font-semibold"
                >
                  {copied ? "✓ Copié" : "Copier"}
                </button>
                {wa && (
                  <a href={`${wa}?text=${encodeURIComponent(plan.message_relance)}`} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-[#25D366] text-white py-2 text-[14px] font-semibold text-center">
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => setPlan(null)} disabled={busy !== ""} className="rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-600">
              Modifier le texte
            </button>
            <button type="button" onClick={valider} disabled={busy !== ""} className="flex-1 rounded-xl bg-emerald-600 text-white font-bold py-3 disabled:opacity-50">
              {busy === "valide" ? "Enregistrement…" : "✅ Valider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
