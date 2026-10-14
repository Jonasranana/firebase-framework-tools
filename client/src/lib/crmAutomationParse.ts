import type { LeadColumn } from "@/lib/crmColumns";
import type { LeadGroup } from "@/lib/crm";

// « Mode simple » : comprend les phrases courantes sans IA (quand / alors, mail, SMS, équipe,
// groupe, note, rappel). Sert tant que la clé de l'IA n'est pas configurée, ou en secours.
export type AutoDraft = {
  name: string;
  explanation?: string;
  trigger: { type: "created" } | { type: "column_changes"; col: string; value: string };
  actions: any[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ACTION_START = /\b(envoie|envoyer|envoi|prevenir|previens|previent|notifie|notifier|alerte|deplace|deplacer|mets|mettre|met|ajoute|ajouter|note|range|ranger|cree|creer|sms|mail|email|rappel)\b/;

export function parseAutomation(text: string, columns: LeadColumn[], groups: LeadGroup[], templates: string[]): AutoDraft | { error: string } {
  const quotedAll = Array.from(text.matchAll(/[«"“]([^»"”]+)[»"”]/g)).map((m) => m[1].trim());
  const t = norm(text);
  if (!t) return { error: "Décrivez ce que vous voulez." };

  // Sépare « quand … » de « alors … » : la partie action commence au premier verbe d'action
  // situé après le début de la phrase.
  const tIdx = t.search(/\b(devient|passe|passent|change|arrive|est cree|est mis|sont)\b/);
  const start = tIdx >= 0 ? tIdx : 0;
  const m = ACTION_START.exec(t.slice(start));
  const cut = m ? start + m.index : -1;
  const when = cut > 0 ? t.slice(0, cut) : t;
  const then = cut > 0 ? t.slice(cut) : t;

  let trigger: AutoDraft["trigger"] | null = null;
  if (/(nouveau|nouvelle) (lead|fiche|client|contact)|lead (arrive|cree|entre)|quand un lead (arrive|est cree)/.test(when)) trigger = { type: "created" };
  if (!trigger) {
    let best: { col: string; value: string; len: number; at: number } | null = null;
    for (const c of columns) {
      if (c.type !== "status" || !c.options) continue;
      for (const o of c.options) {
        const label = norm(o.label.replace(/^\s*\d+\s*-\s*/, (x) => x));
        if (label.length < 3) continue;
        const at = when.indexOf(label);
        if (at >= 0 && (!best || label.length > best.len)) best = { col: c.key, value: o.key, len: label.length, at };
      }
    }
    if (best) trigger = { type: "column_changes", col: best.col, value: best.value };
  }
  if (!trigger) return { error: "Je n'ai pas compris quand ça doit se déclencher. Dites par exemple : « quand le statut devient Intéressé… »." };

  // Les citations qui désignent l'étiquette du déclencheur ne sont pas des textes à envoyer.
  const quoted = quotedAll.filter((q) => !when.includes(norm(q)));
  const actions: any[] = [];
  const wantsMail = /\b(mail|email|courriel)\b/.test(then);
  const wantsSms = /\bsms\b/.test(then);
  // Modèle de mail + SMS cité
  const tpl = templates.find((x) => {
    const n = norm(x);
    return n.length > 3 && then.includes(n);
  }) ?? templates.find((x) => /relance/.test(norm(x)) && new RegExp(`\\b${(then.match(/\b([123])\s*(er|e|eme)?\s*relance|relance\s*([123])\b/) ?? [])[1] ?? (then.match(/relance\s*([123])/) ?? [])[1] ?? "x"}\\b`).test(norm(x)));
  // « Quand Mail+SMS (Auto) devient X, envoie ce mail » : le modèle est celui de l'étiquette déclencheuse.
  const trigLabel = trigger.type === "column_changes" ? columns.find((c) => c.key === trigger!.col)?.options?.find((o) => o.key === (trigger as any).value)?.label ?? "" : "";
  const tplFromTrigger = trigLabel ? templates.find((x) => norm(x) === norm(trigLabel)) : undefined;
  const tplFinal = tpl ?? (!quoted.length && (wantsMail || wantsSms) ? tplFromTrigger : undefined);
  if (tplFinal) actions.push({ type: "send_template", template: tplFinal, mail: wantsSms && !wantsMail ? false : true, sms: wantsMail && !wantsSms ? false : true });
  else if (wantsSms && !wantsMail && quoted[0]) actions.push({ type: "send_sms", text: quoted[0] });
  else if (wantsMail && quoted.length) actions.push({ type: "send_email", subject: quoted.length > 1 ? quoted[0] : "IP5 Énergie", body: quoted.length > 1 ? quoted[1] : quoted[0] });
  if (/(previens|prevenir|notifie|notifier|alerte|informe).*(equipe|tout le monde|nous)|equipe/.test(then) && !tplFinal) actions.push({ type: "notify_team", message: quoted[0] ?? "" });
  const g = groups.find((x) => !x.archived && then.includes(norm(x.title)) && norm(x.title).length > 2);
  if (g && /(deplace|deplacer|mets|mettre|met|range|ranger)/.test(then)) actions.push({ type: "move_group", groupId: g.id });
  if (/\b(note|commentaire)\b/.test(then) && quoted[0]) actions.push({ type: "add_note", text: quoted[0] });
  const days = then.match(/rappel.*?(\d+)\s*jours?/);
  if (days) actions.push({ type: "set_date", col: "rappel", days: Number(days[1]) });
  else if (/rappel.*(demain)/.test(then)) actions.push({ type: "set_date", col: "rappel", days: 1 });

  if (!actions.length) return { error: "Je n'ai pas compris ce qu'il faut faire. Dites par exemple : « envoie le mail 1 - relance injoignable » ou « préviens l'équipe »." };
  return { name: "", trigger, actions };
}
