import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, ChevronLeft, ChevronRight, FileCheck2 } from "lucide-react";
import { REQUIRED_LEAD_DOCS } from "@/lib/crmDocs";
import { STATUS_RANK, formatPhone, type Lead } from "@/lib/crm";
import { ATTRIBUE, ATTRIBUE_KEY, type LeadColumn } from "@/lib/crmColumns";
import { RAPPEL_HEURE_KEY, rappelEnRetard, rappelShort } from "@/lib/rappel";
import { trancheInfo } from "@/lib/tranche";

// ─────────────────────────────────────────────────────────────────────────
// « Suivi des dossiers » : les clients dont le dossier avance, en colonnes par étape
// (Docs demandés → … → Installé). Glisser une carte dans une autre colonne change
// l'étape ; toucher une carte ouvre la fiche. Les dossiers qui n'ont pas bougé depuis
// plus de 7 jours sont signalés. Mêmes données que le tableau (colonne « Étape »).
// ─────────────────────────────────────────────────────────────────────────

const DAY = 86400000;
const STALE_DAYS = 7;
const START = "__start";

export type DossierMove = (leadId: string, etape: string) => void;

const etapeChangedMs = (l: Lead) => {
  let t = 0;
  for (const n of l.notes ?? []) {
    if (n.kind === "statut" && /^(Étape|Pipeline)\b.*→/i.test(n.text ?? "")) t = Math.max(t, Date.parse(n.at) || 0);
  }
  return t || Date.parse(l.statusChangedAt || l.updatedAt || l.createdAt || "") || 0;
};

// Dernière étiquette changée sur la fiche, dans n'importe quelle colonne : « Statut : RDV pris », « Commercial : Mebarek »…
const lastLabelChange = (l: Lead): { text: string; at: string } | null => {
  const notes = l.notes ?? [];
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (n.kind !== "statut" || !n.text || /^(🔔|Rappel|Groupe|Attribué)/.test(n.text)) continue;
    const cell = n.text.match(/^(.+?) : (.*) → (.*?)(?: \(Praimy\))?$/);
    if (cell) return { text: `${cell[1]} : ${cell[3] || "vide"}`, at: n.at };
    const st = n.text.match(/^(.+) → (.+)$/);
    if (st) return { text: `Statut : ${st[2]}`, at: n.at };
  }
  return null;
};
const agoText = (iso: string) => {
  const d = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY));
  return d === 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`;
};

const daysSince = (ms: number) => (ms ? Math.max(0, Math.floor((Date.now() - ms) / DAY)) : 0);

// Colonne « 🧭 Étape » du tableau (colonne personnalisée c_sxgefs, remplie aussi par la synchro PRAIMY).
export const findEtapeColumn = (cols: LeadColumn[]) =>
  cols.find((c) => c.key === "c_sxgefs") ?? cols.find((c) => c.type === "status" && /[ée]tape/i.test(c.title) && !/statut/i.test(c.title));
export const etapeOptions = (col?: LeadColumn) => (col?.options ?? []).filter((o) => o.label && !o.off);

// Un lead est un « dossier » dès qu'il a une étape, ou qu'un RDV est pris (étape à définir).
export const isDossier = (l: Lead, col?: LeadColumn) => !!(col && l.fields[col.key]) || (STATUS_RANK[l.status] ?? 0) >= 3;

export default function DossiersBoard({
  leads,
  etapeCol,
  onOpen,
  onMove,
  compact,
}: {
  leads: Lead[];
  etapeCol?: LeadColumn;
  onOpen: (id: string) => void;
  onMove: DossierMove;
  compact?: boolean;
}) {
  const [staleOnly, setStaleOnly] = useState(false);
  const [dragOver, setDragOver] = useState("");

  // Défilement latéral : flèches, glisser le fond avec la souris, ou le doigt / la molette en maj.
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const updateArrows = () => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [leads]);
  const slide = (dir: number) => scroller.current?.scrollBy({ left: dir * Math.max(280, (scroller.current?.clientWidth ?? 600) * 0.8), behavior: "smooth" });
  const pan = useRef<{ x: number; left: number } | null>(null);

  const columns = useMemo(() => {
    const cols = [{ key: START, label: "Sans étape", hex: "#9ca3af", hint: "RDV pris, étape à choisir" }, ...etapeOptions(etapeCol).map((p) => ({ key: p.key, label: p.label, hex: p.hex, hint: "" }))];
    const dossiers = leads.filter((l) => isDossier(l, etapeCol));
    const byKey = new Map<string, Lead[]>(cols.map((c) => [c.key, []]));
    for (const l of dossiers) {
      const v = etapeCol ? l.fields[etapeCol.key] : "";
      const k = v && byKey.has(v) ? v : START;
      byKey.get(k)!.push(l);
    }
    Array.from(byKey.values()).forEach((arr) => arr.sort((a, b) => etapeChangedMs(a) - etapeChangedMs(b))); // les plus anciens en haut
    return { cols, byKey, total: dossiers.length };
  }, [leads, etapeCol]);

  const isEnd = (key: string) => key === "termine" || key === "bloque";
  const ek = etapeCol?.key ?? "";
  const stale = useMemo(
    () => leads.filter((l) => isDossier(l, etapeCol) && !isEnd(l.fields[ek] ?? "") && daysSince(etapeChangedMs(l)) >= STALE_DAYS).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, etapeCol],
  );

  const mainSteps = etapeOptions(etapeCol).filter((p) => p.key !== "bloque");

  if (!etapeCol) return <p className="text-sm text-gray-500 py-6">La colonne « Étape » est introuvable : réactive-la dans le tableau (corbeille des colonnes).</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-sm font-bold text-gray-800">
          {columns.total} dossier{columns.total > 1 ? "s" : ""} en suivi
        </p>
        <button
          onClick={() => setStaleOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border-2 ${
            staleOnly ? "bg-red-500 text-white border-transparent" : stale ? "bg-red-50 text-red-700 border-red-100" : "bg-white text-gray-500 border-gray-200"
          }`}
        >
          <AlertTriangle size={13} /> Bloqués depuis {STALE_DAYS} j ou plus ({stale})
        </button>
        <p className="text-[11px] text-gray-400 ml-auto hidden sm:block">Flèches ◀ ▶ sur chaque carte, ou glissez-la dans une autre colonne : l'étape change aussi dans le tableau.</p>
      </div>

      <div className="relative">
        {canLeft && (
          <button onClick={() => slide(-1)} aria-label="Colonnes précédentes" className="absolute left-1 top-24 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-orange-50">
            <ChevronLeft size={22} />
          </button>
        )}
        {canRight && (
          <button onClick={() => slide(1)} aria-label="Colonnes suivantes" className="absolute right-1 top-24 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-orange-50">
            <ChevronRight size={22} />
          </button>
        )}
      <div
        ref={scroller}
        onScroll={updateArrows}
        onPointerDown={(e) => {
          // Glisser le fond avec la souris fait défiler les colonnes (pas sur une carte : elles se déplacent elles-mêmes).
          if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("[data-card]")) return;
          pan.current = { x: e.clientX, left: scroller.current?.scrollLeft ?? 0 };
        }}
        onPointerMove={(e) => {
          if (pan.current && scroller.current) scroller.current.scrollLeft = pan.current.left - (e.clientX - pan.current.x);
        }}
        onPointerUp={() => (pan.current = null)}
        onPointerLeave={() => (pan.current = null)}
        className="flex gap-3 overflow-x-auto pb-4 items-start overscroll-x-contain"
        style={{ scrollbarGutter: "stable" }}
      >
        {columns.cols.map((c) => {
          const all = columns.byKey.get(c.key) ?? [];
          const list = staleOnly ? all.filter((l) => !isEnd(c.key) && daysSince(etapeChangedMs(l)) >= STALE_DAYS) : all;
          const over = dragOver === c.key;
          return (
            <div
              key={c.key}
              onDragOver={(e) => {
                if (c.key === START) return;
                e.preventDefault();
                setDragOver(c.key);
              }}
              onDragLeave={() => setDragOver((k) => (k === c.key ? "" : k))}
              onDrop={(e) => {
                setDragOver("");
                const id = e.dataTransfer.getData("text/lead-id");
                if (id && c.key !== START) onMove(id, c.key);
              }}
              className={`snap-start shrink-0 ${compact ? "w-[78vw]" : "w-72"} rounded-2xl p-2 transition-colors ${over ? "bg-orange-100/70 ring-2 ring-orange-300" : "bg-gray-100/80"}`}
            >
              <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
                <h3 className="text-sm font-extrabold text-gray-800 truncate">{c.label}</h3>
                <span className="ml-auto text-xs font-bold text-gray-500 bg-white rounded-full px-2 py-0.5">{list.length}</span>
              </div>
              {c.hint && list.length > 0 && <p className="text-[10px] text-gray-400 px-2 -mt-1 mb-1.5">{c.hint}</p>}
              <div className="space-y-2">
                {list.map((l) => {
                  const ci = columns.cols.findIndex((x) => x.key === c.key);
                  const prevCol = ci > 1 ? columns.cols[ci - 1] : null; // « Sans étape » n'est pas une destination
                  const nextCol = ci < columns.cols.length - 1 ? columns.cols[ci + 1] : null;
                  const days = daysSince(etapeChangedMs(l));
                  const late = days >= STALE_DAYS && !isEnd(c.key);
                  const idx = mainSteps.findIndex((p) => p.key === l.fields[ek]);
                  const have = REQUIRED_LEAD_DOCS.filter((d) => l.docCats.includes(d)).length;
                  const need = REQUIRED_LEAD_DOCS.length;
                  const time = l.fields[RAPPEL_HEURE_KEY] ?? "";
                  const rLate = !!l.rappelLe && rappelEnRetard(l.rappelLe, time);
                  const tr = trancheInfo(l.fields.tranche ?? "");
                  const who = ATTRIBUE.find((o) => o.key === l.fields[ATTRIBUE_KEY]);
                  return (
                    <div
                      key={l.id}
                      role="button"
                      data-card
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", l.id)}
                      onClick={() => onOpen(l.id)}
                      onKeyDown={(e) => e.key === "Enter" && onOpen(l.id)}
                      className={`bg-white rounded-xl border shadow-sm p-3 cursor-pointer hover:border-orange-300 ${late ? "border-red-200" : "border-gray-100"}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm truncate">{l.name || "Sans nom"}</p>
                          <p className="text-[11px] text-gray-500 truncate">{[l.phone && formatPhone(l.phone), l.postalCode].filter(Boolean).join(" · ")}</p>
                        </div>
                        {tr && <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 mt-0.5" style={{ background: tr.color }} title={`Tranche ${tr.name}`} />}
                      </div>
                      {idx >= 0 && (
                        <div className="flex gap-0.5 mt-2">
                          {mainSteps.map((p, i) => (
                            <span key={p.key} className="flex-1 h-1 rounded-full" style={{ background: i <= idx ? "#ff7a1a" : "#e5e7eb" }} />
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${have === need ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                          title="Documents obligatoires reçus"
                        >
                          <FileCheck2 size={11} /> {have}/{need}
                        </span>
                        {l.rappelLe && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${rLate ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-800"}`}>
                            <BellRing size={10} /> {rappelShort(l.rappelLe, time)}
                          </span>
                        )}
                        {who && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <span className="w-2 h-2 rounded-full" style={{ background: who.hex }} />
                            {who.label}
                          </span>
                        )}
                        <span className={`ml-auto text-[11px] font-semibold ${late ? "text-red-600" : "text-gray-400"}`}>
                          {late && <AlertTriangle size={10} className="inline -mt-0.5 mr-0.5" />}
                          {days === 0 ? "aujourd'hui" : `${days} j`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={!prevCol}
                          onClick={() => prevCol && onMove(l.id, prevCol.key)}
                          title={prevCol ? `Reculer à « ${prevCol.label} »` : undefined}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold py-1.5 disabled:opacity-30 enabled:hover:bg-orange-100 enabled:active:bg-orange-200"
                        >
                          <ChevronLeft size={14} /> {prevCol ? <span className="truncate max-w-[70px]">{prevCol.label}</span> : null}
                        </button>
                        <button
                          disabled={!nextCol}
                          onClick={() => nextCol && onMove(l.id, nextCol.key)}
                          title={nextCol ? `Avancer à « ${nextCol.label} »` : undefined}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 text-white text-[11px] font-bold py-1.5 disabled:opacity-30 enabled:hover:bg-orange-600 enabled:active:bg-orange-700"
                        >
                          {nextCol ? <span className="truncate max-w-[70px]">{nextCol.label}</span> : null} <ChevronRight size={14} />
                        </button>
                      </div>
                      {(() => {
                        const ch = lastLabelChange(l);
                        return ch ? (
                          <p className="mt-1.5 text-[11px] text-gray-500 truncate" title={`${ch.text} · ${agoText(ch.at)}`}>
                            🏷️ <b className="font-semibold text-gray-700">{ch.text}</b> · {agoText(ch.at)}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  );
                })}
                {list.length === 0 && <p className="text-center text-[11px] text-gray-400 py-4">{staleOnly ? "Aucun dossier bloqué" : "Aucun dossier"}</p>}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
