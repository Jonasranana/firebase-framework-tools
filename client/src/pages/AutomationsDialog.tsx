import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmFirestore } from "@/lib/crmDb";
import { LEAD_COLUMNS } from "@/lib/crmColumns";
import AutomationAssistant from "./AutomationAssistant";
import type { AutoDraft } from "@/lib/crmAutomationParse";
import type { LeadGroup } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Bouton « Automatiser » façon Monday : « quand … alors … ».
// Les règles sont dans Firestore (crm_automations) ; c'est la fonction
// runAutomations (serveur) qui les exécute à chaque modification d'un lead.
// ─────────────────────────────────────────────────────────────────────────
type Action = {
  type: "notify_team" | "send_template" | "send_email" | "send_sms" | "move_group" | "set_column" | "set_date" | "add_note";
  message?: string;
  template?: string;
  mail?: boolean;
  sms?: boolean;
  text?: string;
  subject?: string;
  body?: string;
  groupId?: string;
  col?: string;
  value?: string;
  days?: number;
};
type Trigger = { type: "created" } | { type: "column_changes"; col: string; value: string };
type Automation = { id: string; name: string; enabled: boolean; trigger: Trigger; actions: Action[]; runs?: number };

const TEMPLATES = [
  "1 - relance injoignable",
  "2 - relance injoignable",
  "3 - relance injoignable",
  "📎 demande avis d'imposition",
  "🙏 remerciement appel",
  "🏠 explication éligibilité",
  "confirmation + fiche technique",
];

const ACTION_LABEL: Record<Action["type"], string> = {
  notify_team: "Prévenir l'équipe par e-mail",
  send_template: "Envoyer un modèle Mail + SMS au lead",
  send_email: "Envoyer un e-mail libre au lead (depuis contact@)",
  send_sms: "Envoyer un SMS libre au lead",
  move_group: "Déplacer dans un groupe",
  set_column: "Changer la valeur d'une colonne",
  set_date: "Mettre une date (aujourd'hui + N jours)",
  add_note: "Ajouter une note dans l'historique",
};

const field = "text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 outline-none focus:border-[#2b5a8f]";

export function useAutomationsCount() {
  const [list, setList] = useState<Automation[]>([]);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.collection(db, "crm_automations"),
          (snap) => {
            if (!cancelled) setList(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as Automation));
          },
          (e) => console.error("Automatisations non lisibles (règle crm_automations ?)", e),
        );
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);
  return list;
}

function describe(a: Automation, groups: LeadGroup[]) {
  const t = a.trigger;
  let when = "Quand un lead est créé";
  if (t.type === "column_changes") {
    const col = LEAD_COLUMNS.find((c) => c.key === t.col);
    const opt = col?.options?.find((o) => o.key === t.value);
    when = `Quand « ${col?.title ?? t.col} » ${t.value ? `devient « ${opt?.label ?? t.value} »` : "change"}`;
  }
  const then = a.actions.map((x) => {
    if (x.type === "move_group") return `déplacer vers « ${groups.find((g) => g.id === x.groupId)?.title ?? "?"} »`;
    if (x.type === "send_template") return `envoyer « ${x.template} »`;
    if (x.type === "send_email") return `envoyer un e-mail « ${x.subject || "IP5 Énergie"} »`;
    if (x.type === "send_sms") return `envoyer un SMS « ${(x.text ?? "").slice(0, 60)} »`;
    return ACTION_LABEL[x.type].toLowerCase();
  });
  return `${when}, alors ${then.join(" + ") || "…"}`;
}

export default function AutomationsDialog({
  open,
  onClose,
  list,
  groups,
  email,
}: {
  open: boolean;
  onClose: () => void;
  list: Automation[];
  groups: LeadGroup[];
  email: string;
}) {
  const [editing, setEditing] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<Trigger>({ type: "column_changes", col: "status", value: "" });
  const [actions, setActions] = useState<Action[]>([{ type: "notify_team" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const statusCols = useMemo(() => LEAD_COLUMNS.filter((c) => c.type === "status" || c.type === "date" || c.type === "text"), [open]);

  const reset = () => {
    setEditing(false);
    setAssistant(false);
    setName("");
    setTrigger({ type: "column_changes", col: "status", value: "" });
    setActions([{ type: "notify_team" }]);
    setError("");
  };

  const createFromDraft = async (d: AutoDraft) => {
    setBusy(true);
    try {
      const { m, db } = await crmFirestore();
      const clean = d.actions.map((a: any) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)));
      await m.addDoc(m.collection(db, "crm_automations"), {
        name: d.name?.trim() || describe({ id: "", name: "", enabled: true, trigger: d.trigger as Trigger, actions: d.actions }, groups),
        enabled: true,
        trigger: d.trigger,
        actions: clean,
        runs: 0,
        createdBy: email,
        createdAt: m.serverTimestamp(),
        via: "assistant",
      });
      reset();
    } catch (e) {
      console.error(e);
      window.alert("Impossible d'enregistrer l'automatisation. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError("");
    if (!actions.length) return setError("Ajoutez au moins une action.");
    setBusy(true);
    try {
      const { m, db } = await crmFirestore();
      const clean = actions.map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)));
      await m.addDoc(m.collection(db, "crm_automations"), {
        name: name.trim() || describe({ id: "", name: "", enabled: true, trigger, actions }, groups),
        enabled: true,
        trigger,
        actions: clean,
        runs: 0,
        createdBy: email,
        createdAt: m.serverTimestamp(),
      });
      reset();
    } catch (e) {
      console.error(e);
      setError("Impossible d'enregistrer (règle Firestore crm_automations publiée ?).");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: Automation) => {
    const { m, db } = await crmFirestore();
    await m.updateDoc(m.doc(db, "crm_automations", a.id), { enabled: !a.enabled });
  };
  const remove = async (a: Automation) => {
    if (!window.confirm(`Supprimer l'automatisation « ${a.name} » ?`)) return;
    const { m, db } = await crmFirestore();
    await m.deleteDoc(m.doc(db, "crm_automations", a.id));
  };

  const setAction = (i: number, patch: Partial<Action>) => setActions(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const trigCol = trigger.type === "column_changes" ? LEAD_COLUMNS.find((c) => c.key === trigger.col) : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && (reset(), onClose())}>
      <DialogContent className="max-w-2xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap size={18} className="text-[#fdab3d]" /> Automatisations
          </DialogTitle>
          <DialogDescription>« Quand il se passe ceci, alors fais cela » — exécuté automatiquement, même si personne n'est connecté.</DialogDescription>
        </DialogHeader>

        {assistant && (
          <AutomationAssistant
            groups={groups}
            templates={TEMPLATES}
            busy={busy}
            describeDraft={(d) => describe({ id: "", name: "", enabled: true, trigger: d.trigger as Trigger, actions: d.actions }, groups)}
            onCreate={createFromDraft}
            onManual={(d) => {
              if (d) {
                setName(d.name ?? "");
                setTrigger(d.trigger as Trigger);
                setActions(d.actions as Action[]);
              }
              setAssistant(false);
              setEditing(true);
            }}
          />
        )}

        {!editing && !assistant && (
          <div className="space-y-3">
            {list.length === 0 && <p className="text-sm text-gray-500">Aucune automatisation pour l'instant.</p>}
            {list.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border border-gray-200 rounded-lg p-3">
                <input type="checkbox" checked={a.enabled} onChange={() => toggle(a)} className="mt-1 h-4 w-4" title="Activer / désactiver" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold break-words">{a.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{describe(a, groups)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Exécutée {a.runs ?? 0} fois</div>
                </div>
                <button onClick={() => remove(a)} className="text-gray-400 hover:text-red-600" aria-label="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setAssistant(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0073ea] hover:bg-[#0060c2] rounded-md px-3 py-2"
            >
              <Plus size={15} /> Nouvelle automatisation
            </button>
          </div>
        )}

        {editing && (
          <div className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (facultatif)" className={`${field} w-full`} />

            <div className="rounded-lg bg-blue-50 p-3 space-y-2">
              <div className="text-xs font-bold uppercase text-blue-800">Quand</div>
              <select
                className={`${field} w-full`}
                value={trigger.type === "created" ? "created" : "column_changes"}
                onChange={(e) => setTrigger(e.target.value === "created" ? { type: "created" } : { type: "column_changes", col: "status", value: "" })}
              >
                <option value="column_changes">une colonne change…</option>
                <option value="created">un nouveau lead est créé</option>
              </select>
              {trigger.type === "column_changes" && (
                <div className="flex gap-2 flex-wrap">
                  <select className={field} value={trigger.col} onChange={(e) => setTrigger({ type: "column_changes", col: e.target.value, value: "" })}>
                    {statusCols.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <select className={field} value={trigger.value} onChange={(e) => setTrigger({ ...trigger, value: e.target.value })}>
                    <option value="">n'importe quelle valeur</option>
                    {(trigCol?.options ?? []).map((o) => (
                      <option key={o.key} value={o.key}>
                        devient : {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-green-50 p-3 space-y-3">
              <div className="text-xs font-bold uppercase text-green-800">Alors</div>
              {actions.map((a, i) => {
                const col = LEAD_COLUMNS.find((c) => c.key === a.col);
                return (
                  <div key={i} className="space-y-2 border-b border-green-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex gap-2">
                      <select className={`${field} flex-1`} value={a.type} onChange={(e) => setAction(i, { type: e.target.value as Action["type"] })}>
                        {(Object.keys(ACTION_LABEL) as Action["type"][]).map((k) => (
                          <option key={k} value={k}>
                            {ACTION_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      {actions.length > 1 && (
                        <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label="Retirer">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    {a.type === "notify_team" && (
                      <input className={`${field} w-full`} placeholder="Message (facultatif) — {nom}, {telephone}, {ville}" value={a.message ?? ""} onChange={(e) => setAction(i, { message: e.target.value })} />
                    )}
                    {a.type === "send_template" && (
                      <div className="flex gap-3 flex-wrap items-center">
                        <select className={field} value={a.template ?? ""} onChange={(e) => setAction(i, { template: e.target.value })}>
                          <option value="">Choisir un modèle…</option>
                          {TEMPLATES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <label className="text-sm flex items-center gap-1">
                          <input type="checkbox" checked={a.mail !== false} onChange={(e) => setAction(i, { mail: e.target.checked })} /> Mail
                        </label>
                        <label className="text-sm flex items-center gap-1">
                          <input type="checkbox" checked={a.sms !== false} onChange={(e) => setAction(i, { sms: e.target.checked })} /> SMS
                        </label>
                      </div>
                    )}
                    {a.type === "send_email" && (
                      <div className="space-y-2">
                        <input className={`${field} w-full`} placeholder="Objet du mail" value={a.subject ?? ""} onChange={(e) => setAction(i, { subject: e.target.value })} />
                        <textarea className={`${field} w-full`} rows={4} placeholder="Texte du mail — {nom}, {telephone}, {ville}" value={a.body ?? ""} onChange={(e) => setAction(i, { body: e.target.value })} />
                      </div>
                    )}
                    {(a.type === "send_sms" || a.type === "add_note") && (
                      <textarea className={`${field} w-full`} rows={2} placeholder="Texte — {nom}, {telephone}, {ville}" value={a.text ?? ""} onChange={(e) => setAction(i, { text: e.target.value })} />
                    )}
                    {a.type === "move_group" && (
                      <select className={field} value={a.groupId ?? ""} onChange={(e) => setAction(i, { groupId: e.target.value })}>
                        <option value="">Choisir un groupe…</option>
                        {groups.filter((g) => !g.archived).map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {(a.type === "set_column" || a.type === "set_date") && (
                      <div className="flex gap-2 flex-wrap">
                        <select className={field} value={a.col ?? ""} onChange={(e) => setAction(i, { col: e.target.value, value: "" })}>
                          <option value="">Colonne…</option>
                          {LEAD_COLUMNS.filter((c) => (a.type === "set_date" ? c.type === "date" : c.type === "status" || c.type === "text")).map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        {a.type === "set_column" &&
                          (col?.options ? (
                            <select className={field} value={a.value ?? ""} onChange={(e) => setAction(i, { value: e.target.value })}>
                              <option value="">Valeur…</option>
                              {col.options.map((o) => (
                                <option key={o.key} value={o.key}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input className={field} placeholder="Valeur" value={a.value ?? ""} onChange={(e) => setAction(i, { value: e.target.value })} />
                          ))}
                        {a.type === "set_date" && (
                          <label className="text-sm flex items-center gap-1">
                            aujourd'hui +
                            <input type="number" className={`${field} w-16`} value={a.days ?? 0} onChange={(e) => setAction(i, { days: Number(e.target.value) })} /> jours
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => setActions([...actions, { type: "add_note" }])} className="text-sm font-semibold text-[#0073ea] inline-flex items-center gap-1">
                <Plus size={14} /> Ajouter une action
              </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={reset} className="text-sm px-3 py-2 rounded-md hover:bg-gray-100">
                Annuler
              </button>
              <button disabled={busy} onClick={save} className="text-sm font-semibold text-white bg-[#0073ea] hover:bg-[#0060c2] rounded-md px-4 py-2 disabled:opacity-50">
                Créer l'automatisation
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
