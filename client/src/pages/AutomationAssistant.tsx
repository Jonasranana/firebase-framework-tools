import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { LEAD_COLUMNS } from "@/lib/crmColumns";
import { getEspaceProApp } from "@/lib/espacePro";
import { parseAutomation, type AutoDraft } from "@/lib/crmAutomationParse";
import type { LeadGroup } from "@/lib/crm";

// Création d'une automatisation en parlant : l'utilisateur décrit ce qu'il veut, l'assistant
// prépare la règle, la résume en français et la crée après confirmation.
async function callFn<T>(name: string, data?: unknown): Promise<T> {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  return (await httpsCallable(getFunctions(app, "europe-west9"), name)(data)).data as T;
}

export type AiStatus = { configured: boolean; canConfigure: boolean; canUse: boolean };
export const fetchAiStatus = () => callFn<AiStatus>("aiSettings", {});
export const saveAiKey = (key: string) => callFn<AiStatus>("aiSettings", { action: "save", key });

const EXAMPLES = [
  "Quand un lead passe en « Intéressé », préviens toute l'équipe par mail",
  "Quand Mail+SMS (Auto) devient « 1 - Relance injoignable », envoie ce mail et ce SMS au client",
  "Quand un nouveau lead arrive, ajoute la note « À rappeler dans les 24 h » et mets un rappel dans 1 jour",
];

type Msg = { from: "bot" | "me"; text: string };

export default function AutomationAssistant({
  groups,
  templates,
  describeDraft,
  onCreate,
  onManual,
  busy,
}: {
  groups: LeadGroup[];
  templates: string[];
  describeDraft: (d: AutoDraft) => string;
  onCreate: (d: AutoDraft) => void;
  onManual: (d: AutoDraft | null) => void;
  busy: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "Bonjour ! Dites-moi, avec vos mots, ce que vous voulez automatiser. Je prépare la règle et vous la montre avant de l'activer." },
  ]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState<AutoDraft | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAiStatus().then(setAi).catch(() => setAi({ configured: false, canConfigure: false, canUse: false }));
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [msgs, draft, thinking]);

  const context = () => ({
    columns: LEAD_COLUMNS.filter((c) => c.type === "status" || c.type === "date").map((c) => ({
      key: c.key,
      title: c.title,
      type: c.type,
      options: c.options?.filter((o) => o.label).map((o) => ({ key: o.key, label: o.label })),
    })),
    groups: groups.filter((g) => !g.archived).map((g) => ({ id: g.id, title: g.title })),
    templates,
  });

  const submit = async (value?: string) => {
    const q = (value ?? text).trim();
    if (!q || thinking) return;
    setText("");
    setDraft(null);
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setThinking(true);
    let result: any = null;
    let simple = false;
    try {
      if (ai?.configured && ai.canUse) {
        result = await callFn<any>("draftAutomation", { text: q, context: context() });
      } else {
        simple = true;
        result = parseAutomation(q, LEAD_COLUMNS, groups, templates);
      }
    } catch (e: any) {
      const code = String(e?.message ?? "");
      simple = true;
      result = parseAutomation(q, LEAD_COLUMNS, groups, templates);
      if (/bad-key/.test(code)) setMsgs((m) => [...m, { from: "bot", text: "La clé de l'IA est refusée : j'utilise le mode simple en attendant." }]);
      else if (/quota/.test(code)) setMsgs((m) => [...m, { from: "bot", text: "Le crédit de l'IA est épuisé : j'utilise le mode simple en attendant." }]);
    }
    setThinking(false);
    if (result?.error) {
      setMsgs((m) => [
        ...m,
        {
          from: "bot",
          text: result.needsDesktop
            ? `${result.error}\n\nCe cas est trop complexe pour ce chat (images, pièces jointes, nouvelle fonction…). Parlez-en à Claude sur votre ordinateur (l'application Claude Code) : il pourra le construire directement dans le CRM, avec vos images.`
            : result.error,
        },
      ]);
      return;
    }
    const d = result as AutoDraft;
    setDraft(d);
    setMsgs((m) => [
      ...m,
      { from: "bot", text: `${d.explanation || describeDraft(d)}${simple ? "\n(mode simple : vérifiez bien avant de créer)" : ""}` },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[46vh] overflow-y-auto space-y-2 pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap text-sm rounded-2xl px-3.5 py-2 ${
                m.from === "me" ? "bg-[#0073ea] text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md"
              }`}
            >
              {m.from === "bot" && i === 0 && <Sparkles size={13} className="inline mr-1 text-[#fdab3d]" />}
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Je réfléchis…
          </div>
        )}
        {draft && !thinking && (
          <div className="rounded-xl border-2 border-[#0073ea]/40 bg-blue-50 p-3 space-y-2">
            <div className="text-xs font-bold text-[#0b63ce]">Voici ce que je vais activer :</div>
            <div className="text-sm text-gray-900">{describeDraft(draft)}</div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => onCreate(draft)}
                className="text-sm font-semibold text-white bg-[#00a359] hover:bg-[#008a4c] rounded-md px-4 py-2 disabled:opacity-50"
              >
                ✓ Créer cette automatisation
              </button>
              <button onClick={() => onManual(draft)} className="text-sm font-semibold text-gray-700 border border-gray-300 bg-white rounded-md px-3 py-2 hover:bg-gray-50">
                Ajuster à la main
              </button>
              <button onClick={() => setDraft(null)} className="text-sm text-gray-500 px-2">
                Autre formulation
              </button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && (
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => submit(e)} className="text-left text-xs text-[#0b63ce] bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5">
              {e}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => (e.preventDefault(), submit())}
        className="flex items-end gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Ex. : quand un lead devient « Intéressé », préviens l'équipe par mail…"
          className="flex-1 text-sm bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-[#0073ea] resize-none"
        />
        <button disabled={thinking || !text.trim()} className="h-10 w-10 shrink-0 rounded-full bg-[#0073ea] text-white flex items-center justify-center disabled:opacity-40" aria-label="Envoyer">
          <Send size={16} />
        </button>
      </form>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <button onClick={() => onManual(null)} className="underline">
          La construire à la main
        </button>
        {ai && <span>{ai.configured ? "IA activée" : "Mode simple (IA non configurée)"}</span>}
      </div>
    </div>
  );
}
