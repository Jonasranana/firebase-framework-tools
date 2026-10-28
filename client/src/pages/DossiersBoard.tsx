import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, FileCheck2, MoveHorizontal } from "lucide-react";
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
  const [ghost, setGhost] = useState<{ name: string } | null>(null);
  const ghostEl = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

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

  // Barre de défilement horizontale dessinée par nos soins, toujours visible en bas de l'écran
  // (les barres natives disparaissent sur Mac et téléphone) : on peut la glisser ou toucher la piste.
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 100 });
  const updateThumb = () => {
    const el = scroller.current;
    if (!el) return;
    const ratio = el.clientWidth / Math.max(1, el.scrollWidth);
    const width = Math.max(10, Math.min(100, ratio * 100));
    const left = (el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) * (100 - width);
    setThumb({ left: isFinite(left) ? left : 0, width });
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    updateThumb();
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    window.addEventListener("resize", updateThumb);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateThumb);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);
  const dragBar = useRef<{ x: number; left: number } | null>(null);
  const jumpTo = (clientX: number) => {
    const el = scroller.current;
    const tr = track.current;
    if (!el || !tr) return;
    const r = tr.getBoundingClientRect();
    const frac = (clientX - r.left) / r.width;
    el.scrollLeft = frac * el.scrollWidth - el.clientWidth / 2;
  };

  // Glisser avec le doigt : appui long sur une carte, puis déplacement (la page ne défile plus pendant le glissé).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let drag: { id: string; name: string } | null = null;
    let start = { x: 0, y: 0 };
    let raf = 0;
    let lastX = 0;
    let lastY = 0;

    const colUnder = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-col]")?.getAttribute("data-col") ?? "";
    const loop = () => {
      if (!drag) return;
      const r = el.getBoundingClientRect();
      if (lastX < r.left + 70) el.scrollLeft -= 16;
      else if (lastX > r.right - 70) el.scrollLeft += 16;
      raf = requestAnimationFrame(loop);
    };
    const end = (drop: boolean) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (drag) {
        const key = colUnder(lastX, lastY);
        if (drop && key && key !== START) onMoveRef.current(drag.id, key);
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 450);
      }
      drag = null;
      cancelAnimationFrame(raf);
      setGhost(null);
      setDragOver("");
    };
    const onStart = (e: TouchEvent) => {
      const card = (e.target as HTMLElement).closest("[data-card]") as HTMLElement | null;
      if (!card || e.touches.length !== 1) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastX = start.x;
      lastY = start.y;
      timer = setTimeout(() => {
        drag = { id: card.getAttribute("data-id") ?? "", name: card.getAttribute("data-name") ?? "" };
        try {
          navigator.vibrate?.(25);
        } catch {
          /* non essentiel */
        }
        setGhost({ name: drag.name });
        raf = requestAnimationFrame(loop);
      }, 380);
    };
    const onMoveT = (e: TouchEvent) => {
      const t = e.touches[0];
      lastX = t.clientX;
      lastY = t.clientY;
      if (!drag) {
        if (timer && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) {
          clearTimeout(timer);
          timer = null;
        }
        return;
      }
      e.preventDefault();
      if (ghostEl.current) ghostEl.current.style.transform = `translate(${t.clientX - 90}px, ${t.clientY - 30}px)`;
      const k = colUnder(t.clientX, t.clientY);
      setDragOver((cur) => (cur === k ? cur : k));
    };
    const onEnd = () => end(true);
    const onCancel = () => end(false);
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMoveT, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMoveT);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!etapeCol) return <p className="text-sm text-gray-500 py-6">La colonne « Étape » est introuvable : réactive-la dans le tableau (corbeille des colonnes).</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
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
      </div>
      <ProgressRoad
        steps={columns.cols.filter((c) => c.key !== "bloque").map((c) => ({ key: c.key, label: c.label, hex: c.hex, count: (columns.byKey.get(c.key) ?? []).length }))}
        blocked={(columns.byKey.get("bloque") ?? []).length}
        onPick={(key) => {
          const el = scroller.current?.querySelector(`[data-col="${key}"]`) as HTMLElement | null;
          if (el && scroller.current) scroller.current.scrollTo({ left: el.offsetLeft - scroller.current.offsetLeft - 8, behavior: "smooth" });
        }}
      />
      <p className="mb-3 flex items-start gap-2 rounded-xl bg-orange-50 text-orange-900 text-[13px] font-semibold px-3 py-2">
        <MoveHorizontal size={16} className="shrink-0 mt-0.5" />
        <span>
          Faites glisser une carte vers la droite ou vers la gauche pour changer son étape : elle change aussi dans le tableau.
          {coarse && <span className="font-normal"> Sur téléphone : appuyez longuement sur la carte, puis glissez-la.</span>}
        </span>
      </p>

      <div
        ref={scroller}
        onScroll={updateThumb}
        className="flex gap-3 overflow-x-auto pb-2 items-start overscroll-x-contain no-scrollbar"
      >
        {columns.cols.map((c) => {
          const all = columns.byKey.get(c.key) ?? [];
          const list = staleOnly ? all.filter((l) => !isEnd(c.key) && daysSince(etapeChangedMs(l)) >= STALE_DAYS) : all;
          const over = dragOver === c.key && c.key !== START;
          return (
            <div
              key={c.key}
              data-col={c.key}
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
              className={`shrink-0 ${compact ? "w-[78vw]" : "w-72"} rounded-2xl p-2 transition-colors ${over ? "bg-orange-100/70 ring-2 ring-orange-300" : "bg-gray-100/80"}`}
            >
              <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
                <h3 className="text-sm font-extrabold text-gray-800 truncate">{c.label}</h3>
                <span className="ml-auto text-xs font-bold text-gray-500 bg-white rounded-full px-2 py-0.5">{list.length}</span>
              </div>
              {c.hint && list.length > 0 && <p className="text-[10px] text-gray-400 px-2 -mt-1 mb-1.5">{c.hint}</p>}
              <div className="space-y-2">
                {list.map((l) => {
                  const days = daysSince(etapeChangedMs(l));
                  const late = days >= STALE_DAYS && !isEnd(c.key);
                  const idx = mainSteps.findIndex((p) => p.key === l.fields[ek]);
                  const have = REQUIRED_LEAD_DOCS.filter((d) => l.docCats.includes(d)).length;
                  const need = REQUIRED_LEAD_DOCS.length;
                  const time = l.fields[RAPPEL_HEURE_KEY] ?? "";
                  const rLate = !!l.rappelLe && rappelEnRetard(l.rappelLe, time);
                  const tr = trancheInfo(l.fields.tranche ?? "");
                  const who = ATTRIBUE.find((o) => o.key === l.fields[ATTRIBUE_KEY]);
                  const ch = lastLabelChange(l);
                  return (
                    <div
                      key={l.id}
                      role="button"
                      data-card
                      data-id={l.id}
                      data-name={l.name || "Sans nom"}
                      tabIndex={0}
                      draggable={!coarse}
                      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", l.id)}
                      onClick={() => !justDragged.current && onOpen(l.id)}
                      onKeyDown={(e) => e.key === "Enter" && onOpen(l.id)}
                      className={`bg-white rounded-xl border shadow-sm p-3 cursor-grab select-none hover:border-orange-300 ${late ? "border-red-200" : "border-gray-100"}`}
                      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
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
                      {ch && (
                        <p className="mt-1.5 text-[11px] text-gray-500 truncate" title={`${ch.text} · ${agoText(ch.at)}`}>
                          🏷️ <b className="font-semibold text-gray-700">{ch.text}</b> · {agoText(ch.at)}
                        </p>
                      )}
                    </div>
                  );
                })}
                {list.length === 0 && <p className="text-center text-[11px] text-gray-400 py-4">{staleOnly ? "Aucun dossier bloqué" : "Aucun dossier"}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barre de défilement horizontale collée au bas de l'écran */}
      <div className="sticky bottom-2 z-30 mt-1 px-1" style={{ touchAction: "none" }}>
        <div
          ref={track}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).dataset.thumb) return;
            jumpTo(e.clientX);
          }}
          className="relative h-7 rounded-full bg-white/95 border border-gray-200 shadow-lg"
          aria-label="Faire défiler les colonnes"
        >
          <div
            data-thumb="1"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              dragBar.current = { x: e.clientX, left: scroller.current?.scrollLeft ?? 0 };
            }}
            onPointerMove={(e) => {
              const el = scroller.current;
              const tr = track.current;
              if (!dragBar.current || !el || !tr) return;
              const dx = e.clientX - dragBar.current.x;
              el.scrollLeft = dragBar.current.left + (dx / tr.clientWidth) * el.scrollWidth;
            }}
            onPointerUp={() => (dragBar.current = null)}
            onPointerCancel={() => (dragBar.current = null)}
            className="absolute top-1 bottom-1 rounded-full cursor-grab active:cursor-grabbing"
            style={{ left: `${thumb.left}%`, width: `${thumb.width}%`, background: "linear-gradient(90deg,#ff8a00,#e0218a)", minWidth: 44 }}
          />
        </div>
      </div>

      {ghost && (
        <div
          ref={ghostEl}
          className="fixed left-0 top-0 z-[100] pointer-events-none rounded-xl bg-white border-2 border-orange-400 shadow-2xl px-4 py-2 text-sm font-extrabold text-gray-900 w-44 truncate"
          style={{ transform: "translate(-999px,-999px)" }}
        >
          {ghost.name}
        </div>
      )}
    </div>
  );
}

// Bandeau en haut : le parcours des étapes de gauche (début) à droite (fin).
// Une barre en couleurs (une part par étape, proportionnelle au nombre de dossiers)
// puis les étapes en pastilles « nom · nombre ». Sur téléphone, les pastilles se replient.
function ProgressRoad({
  steps,
  blocked,
  onPick,
}: {
  steps: { key: string; label: string; hex: string; count: number }[];
  blocked: number;
  onPick: (key: string) => void;
}) {
  const total = steps.reduce((n, s) => n + s.count, 0);
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  return (
    <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-extrabold text-gray-800">🚀 Parcours des dossiers</p>
        <div className="flex items-center gap-2 text-xs font-bold">
          {blocked > 0 && <span className="whitespace-nowrap rounded-full bg-red-50 text-red-600 px-2 py-0.5">⛔ {blocked} bloqué{blocked > 1 ? "s" : ""}</span>}
          <button onClick={() => setOpen((v) => !v)} className="whitespace-nowrap rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 hover:bg-gray-200">
            {open ? "Masquer ▴" : "Détail ▾"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1">
        <span>Début</span>
        <span className="flex-1 border-t border-dashed border-gray-200" />
        <span>Fin 🏁</span>
      </div>
      <div className="flex h-4 w-full gap-[2px] rounded-full overflow-hidden bg-gray-100">
        {steps
          .filter((s) => s.count > 0)
          .map((s) => (
            <button
              key={s.key}
              onClick={() => onPick(s.key)}
              title={`${s.label} : ${s.count} dossier${s.count > 1 ? "s" : ""}`}
              className="h-full hover:brightness-110"
              style={{ flexGrow: s.count, flexBasis: 0, minWidth: 6, background: s.hex }}
            />
          ))}
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((s) => (
            <button
              key={s.key}
              onClick={() => onPick(s.key)}
              title={`Voir la colonne « ${s.label} »`}
              className={`inline-flex items-center gap-1.5 rounded-full border pl-2 pr-1 py-0.5 text-xs font-semibold transition-colors ${
                s.count ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50" : "border-transparent bg-gray-50 text-gray-400"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.hex, opacity: s.count ? 1 : 0.4 }} />
              <span className="max-w-[160px] truncate">{s.label}</span>
              <span
                className="min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-black"
                style={s.count ? { background: s.hex, color: "#fff" } : { background: "#eef0f3", color: "#9ca3af" }}
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>
      )}
      {total === 0 && <p className="mt-2 text-xs text-gray-400">Aucun dossier pour l'instant.</p>}
    </div>
  );
}
