// « @ » dans les bulles : taguer Carole, Mebarek, Alexis ou Jonas. Le serveur (postUpdate) envoie alors le message
// à contact@ ET dans la boîte perso de chaque personne taguée, et le note dans la bulle (note.mentions).
import type { ReactNode } from "react";
import type { LeadNote } from "@/lib/crm";

export const MENTION_PEOPLE = [
  { name: "Carole", keys: ["carole", "carol", "maman"] },
  { name: "Mebarek", keys: ["mebarek", "mebarouk", "mebarak"] },
  { name: "Alexis", keys: ["alexis", "papa"] },
  { name: "Jonas", keys: ["jonas"] },
];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isPerson = (w: string) => MENTION_PEOPLE.some((p) => p.keys.includes(norm(w)));

// Texte d'une bulle avec les @noms mis en avant.
export function MentionText({ text, light }: { text: string; light?: boolean }) {
  const parts: ReactNode[] = [];
  let last = 0;
  const re = /@([A-Za-zÀ-ÿ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!isPerson(m[1])) continue;
    const i = m.index;
    parts.push(text.slice(last, i));
    parts.push(
      <span key={i} className={`font-bold rounded px-1 ${light ? "bg-white/25 text-white" : "bg-orange-100 text-orange-700"}`}>
        @{m[1]}
      </span>,
    );
    last = i + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

// Ligne « 🏷️ Carole taguée · prévenue par mail » sous une bulle.
export function TaggedLine({ note, light }: { note: LeadNote; light?: boolean }) {
  const who = note.mentions ?? [];
  if (!who.length) return null;
  return (
    <p className={`text-[10px] mt-1 font-semibold ${light ? "text-white/80" : "text-orange-700"}`}>
      🏷️ {who.join(", ")} {who.length > 1 ? "tagués · prévenus aussi sur leur mail perso" : "tagué(e) · prévenu(e) aussi sur son mail perso"}
    </p>
  );
}

// Suggestions affichées pendant qu'on tape « @… » à la fin du message.
export function MentionPicker({ text, onPick }: { text: string; onPick: (next: string) => void }) {
  const m = text.match(/@([A-Za-zÀ-ÿ]*)$/);
  if (!m) return null;
  const q = norm(m[1]);
  const list = MENTION_PEOPLE.filter((p) => !q || p.keys.some((k) => k.startsWith(q)));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1.5 px-1">
      <span className="text-[11px] text-gray-500">Taguer :</span>
      {list.map((p) => (
        <button
          key={p.name}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(text.slice(0, text.length - m[0].length) + `@${p.name} `)}
          className="text-xs font-bold rounded-full bg-orange-100 text-orange-700 px-2.5 py-1 hover:bg-orange-200"
        >
          @{p.name}
        </button>
      ))}
    </div>
  );
}
