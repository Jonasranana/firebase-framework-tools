import { useState } from "react";
import { getEspaceProApp } from "@/lib/espacePro";
import { LEAD_STATUSES, NEWS_VIEWERS, whatsappHref, type Lead, type LeadNote } from "@/lib/crm";
import type { LeadColumn } from "@/lib/crmColumns";

// ─────────────────────────────────────────────────────────────────────────
// Assistant de relance, dans la discussion d'un client :
// - sous chaque message de l'équipe, un petit bouton « 🤖 Analyser » ;
// - l'IA (fonction planifierRelance) écrit sa proposition juste en dessous,
//   dans la discussion (bulle violette, sans e-mail) : résumé, prochaine
//   action, jour/heure de rappel, étiquette, étape, message de relance ;
// - « ✅ Valider » (ou « ✏️ Modifier » puis Valider) applique le rappel,
//   l'étiquette et l'étape (fonction validerRelance).
// Réservé à la direction (NEWS_VIEWERS).
// ─────────────────────────────────────────────────────────────────────────
export type Plan = {
  resume: string;
  infos_client?: Record<string, string>;
  negocie: string[];
  attentes_client: string[];
  a_faire_ip5: string[];
  prochaine_action: string;
  argument_cle?: string;
  rappel_date: string;
  rappel_heure: string;
  rappel_alternative: string;
  pourquoi: string;
  statut: string;
  etape: string;
  message_relance: string;
  vigilance: string;
};
type IaNote = LeadNote & { plan?: Plan; validatedAt?: string; validatedBy?: string; sourceId?: string };

export const canUseIa = (email: string) => NEWS_VIEWERS.includes(email.toLowerCase());
export const isIaNote = (n: LeadNote) => (n as { kind?: string }).kind === "ia";

async function callFn<T>(name: string, data?: unknown): Promise<T> {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const fn = httpsCallable(getFunctions(app, "europe-west9"), name, { timeout: 120000 });
  return (await fn(data)).data as T;
}

const errText = (e: unknown) => {
  const code = String((e as { code?: string })?.code ?? "");
  const msg = String((e as { message?: string })?.message ?? "");
  if ((code.endsWith("not-found") && /^not[ _-]?found$/i.test(msg)) || (code.endsWith("internal") && /^internal$/i.test(msg)))
    return "L'assistant n'est pas joignable pour le moment, réessayez.";
  return msg || "Une erreur est survenue, réessayez.";
};

const lists = (etapeCol?: LeadColumn) => {
  const etapes = (etapeCol?.options ?? []).filter((o) => o.label && !o.off).map((o) => ({ key: o.key, label: o.label }));
  const statuts = LEAD_STATUSES.filter((s) => s.label).map((s) => ({ key: s.key, label: s.label }));
  const labels: Record<string, string> = Object.fromEntries([...statuts, ...etapes].map((o) => [o.key, o.label]));
  return { etapes, statuts, labels };
};

// Petit bouton sous un message de la discussion.
export function IaAnalyseButton({ lead, note, etapeCol, light }: { lead: Lead; note: LeadNote; etapeCol?: LeadColumn; light?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dejaFait = (lead.notes ?? []).some((n) => isIaNote(n) && (n as IaNote).sourceId === note.id);
  if ((note.text ?? "").trim().length < 10) return null;
  const go = async () => {
    if (dejaFait && !window.confirm("Ce message a déjà été analysé. Relancer une analyse (quelques centimes) ?")) return;
    setBusy(true);
    setError("");
    try {
      const { etapes, statuts } = lists(etapeCol);
      await callFn("planifierRelance", { leadId: lead.id, sourceNoteId: note.id, statuts, etapes, etapeKey: etapeCol?.key ?? "" });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${light ? "bg-white/20 text-white" : "bg-violet-50 text-violet-700 border border-violet-200"} disabled:opacity-60`}
      >
        {busy ? "🤖 L'IA analyse… (10 à 30 s)" : dejaFait ? "🤖 Analyser à nouveau" : "🤖 Analyser et planifier la relance"}
      </button>
      {error && <p className={`text-[11px] mt-0.5 ${light ? "text-amber-200" : "text-red-600"}`}>{error}</p>}
    </div>
  );
}

// Bulle « proposition de l'IA » dans la discussion.
export function IaBubble({ lead, note, email, etapeCol }: { lead: Lead; note: LeadNote; email: string; etapeCol?: LeadColumn }) {
  const n = note as IaNote;
  const [edit, setEdit] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { etapes, statuts, labels } = lists(etapeCol);
  const plan = n.plan;
  const allowed = canUseIa(email);

  const valider = async (p: Plan) => {
    setBusy(true);
    setError("");
    try {
      await callFn("validerRelance", { leadId: lead.id, noteId: n.id, plan: p, etapeKey: etapeCol?.key ?? "", labels });
      setEdit(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const field = "w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[14px] text-gray-900";
  const set = (k: keyof Plan, v: string) => edit && setEdit({ ...edit, [k]: v });
  const wa = whatsappHref(lead.phone);
  const msg = (edit ?? plan)?.message_relance ?? "";

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm bg-violet-50 border border-violet-200 text-gray-900">
        <p className="text-[11px] font-bold mb-0.5 text-violet-700">🤖 Assistant IA · proposition de relance</p>
        {!edit && <p className="text-sm whitespace-pre-wrap break-words">{n.text.replace(/^🤖 Proposition de relance\n?/, "")}</p>}

        {edit && (
          <div className="space-y-2 mt-1">
            <label className="block text-[11px] font-bold text-gray-500">
              Prochaine action
              <textarea value={edit.prochaine_action} onChange={(e) => set("prochaine_action", e.target.value)} rows={2} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-gray-500">
                Jour du rappel
                <input type="date" value={edit.rappel_date} onChange={(e) => set("rappel_date", e.target.value)} className={field} />
              </label>
              <label className="text-[11px] font-bold text-gray-500">
                Heure
                <input type="time" value={edit.rappel_heure} onChange={(e) => set("rappel_heure", e.target.value)} className={field} />
              </label>
            </div>
            <label className="block text-[11px] font-bold text-gray-500">
              Étiquette
              <select value={edit.statut} onChange={(e) => set("statut", e.target.value)} className={field}>
                {statuts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {etapes.length > 0 && (
              <label className="block text-[11px] font-bold text-gray-500">
                Étape du dossier
                <select value={edit.etape} onChange={(e) => set("etape", e.target.value)} className={field}>
                  {etapes.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-[11px] font-bold text-gray-500">
              Message de relance
              <textarea value={edit.message_relance} onChange={(e) => set("message_relance", e.target.value)} rows={3} className={field} />
            </label>
          </div>
        )}

        {msg && !n.validatedAt && (
          <div className="flex gap-1.5 mt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(msg);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
              className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-white border border-gray-200"
            >
              {copied ? "✓ Message copié" : "📋 Copier le message"}
            </button>
            {wa && (
              <a href={`${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-[#25D366] text-white">
                WhatsApp
              </a>
            )}
          </div>
        )}

        {n.validatedAt ? (
          <p className="text-[11px] font-semibold text-emerald-700 mt-1.5">
            ✅ Validé{n.validatedBy ? ` par ${n.validatedBy.split("@")[0]}` : ""} : rappel, étiquette et étape appliqués
          </p>
        ) : (
          allowed &&
          plan && (
            <div className="flex gap-1.5 mt-2">
              {edit ? (
                <button type="button" onClick={() => setEdit(null)} disabled={busy} className="text-[12px] font-bold rounded-full px-3 py-1.5 bg-white border border-gray-200">
                  Annuler
                </button>
              ) : (
                <button type="button" onClick={() => setEdit({ ...plan })} disabled={busy} className="text-[12px] font-bold rounded-full px-3 py-1.5 bg-white border border-gray-200">
                  ✏️ Modifier
                </button>
              )}
              <button
                type="button"
                onClick={() => valider(edit ?? plan)}
                disabled={busy}
                className="flex-1 text-[12px] font-bold rounded-full px-3 py-1.5 bg-emerald-600 text-white disabled:opacity-60"
              >
                {busy ? "Enregistrement…" : "✅ Valider"}
              </button>
            </div>
          )
        )}
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  );
}
