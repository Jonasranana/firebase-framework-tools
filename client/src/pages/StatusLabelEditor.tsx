import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Opt } from "@/lib/crm";

// Éditeur d'étiquettes façon Monday : renommer, changer l'ordre (glisser),
// couleur parmi ~24 (une même couleur n'est utilisable que sur UNE étiquette
// de la colonne), ajouter, supprimer. « Appliquer » enregistre pour toute l'équipe.
export const LABEL_COLORS = [
  "#037f4c", "#00c875", "#9cd326", "#cab641", "#ffcb00", "#fdab3d",
  "#ff642e", "#df2f4a", "#bb3354", "#e2445c", "#ff007f", "#ff5ac4",
  "#a25ddc", "#784bd1", "#579bfc", "#007eb5", "#66ccff", "#225091",
  "#5559df", "#a9bee8", "#7f5347", "#bca58a", "#c4c4c4", "#757575",
];

const newKey = () => `o_${Math.random().toString(36).slice(2, 7)}`;

export default function StatusLabelEditor({
  options,
  onApply,
  onClose,
}: {
  options: readonly Opt[];
  onApply: (next: Opt[]) => void;
  onClose: () => void;
}) {
  // L'étiquette vide (« par défaut ») reste à part : on la remet toujours en dernier.
  const empty = options.find((o) => o.label === "");
  const [list, setList] = useState<Opt[]>(options.filter((o) => o.label !== "").map((o) => ({ ...o })));
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const used = (except: number) => new Set(list.filter((_, i) => i !== except).map((o) => o.hex.toLowerCase()));
  const patch = (i: number, p: Partial<Opt>) => setList(list.map((o, k) => (k === i ? { ...o, ...p } : o)));
  const add = () => {
    const taken = used(-1);
    const hex = LABEL_COLORS.find((c) => !taken.has(c)) ?? LABEL_COLORS[0];
    setList([...list, { key: newKey(), label: "Nouvelle étiquette", hex }]);
  };
  const drop = (to: number) => {
    if (dragFrom === null || dragFrom === to) return;
    const next = [...list];
    const [m] = next.splice(dragFrom, 1);
    next.splice(to, 0, m);
    setList(next);
    setDragFrom(null);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier les étiquettes</DialogTitle>
          <p className="text-xs text-gray-500">Glissez pour changer l'ordre. Chaque couleur ne peut servir qu'une seule fois dans cette colonne.</p>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {empty && (
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-md px-1.5 py-1 opacity-60">
              <span className="w-5 h-5 rounded shrink-0" style={{ background: empty.hex }} />
              <span className="text-sm text-gray-500 truncate">Étiquette par défaut</span>
            </div>
          )}
          {list.map((o, i) => {
            const taken = used(i);
            return (
              <div
                key={o.key}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(i)}
                className={`flex items-center gap-1 border rounded-md px-1 py-1 bg-white ${dragFrom === i ? "opacity-40" : ""} border-gray-300`}
              >
                <GripVertical size={14} className="text-gray-300 cursor-grab shrink-0" />
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-6 h-6 rounded shrink-0 border border-black/10" style={{ background: o.hex }} aria-label="Couleur" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 bg-white border border-gray-200 shadow-xl" align="start">
                    <div className="grid grid-cols-6 gap-1.5">
                      {LABEL_COLORS.map((c) => {
                        const isTaken = taken.has(c) && c !== o.hex.toLowerCase();
                        return (
                          <button
                            key={c}
                            disabled={isTaken}
                            onClick={() => patch(i, { hex: c })}
                            title={isTaken ? "Déjà utilisée par une autre étiquette" : ""}
                            className={`w-7 h-7 rounded-md border-2 ${o.hex.toLowerCase() === c ? "border-gray-900" : "border-transparent"} ${isTaken ? "opacity-20 cursor-not-allowed" : "hover:scale-110"}`}
                            style={{ background: c }}
                          />
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <input
                  value={o.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  className="flex-1 min-w-0 text-sm bg-white text-gray-900 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-[#579bfc]"
                />
                <button onClick={() => setList(list.filter((_, k) => k !== i))} aria-label="Supprimer l'étiquette" className="text-gray-300 hover:text-red-600 shrink-0">
                  <X size={14} />
                </button>
              </div>
            );
          })}
          <button onClick={add} className="flex items-center gap-1 text-sm font-semibold text-gray-600 border border-gray-300 rounded-md px-2 py-1.5 hover:bg-gray-50">
            <Plus size={14} /> Nouvelle étiquette
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm px-3 py-2 rounded-md hover:bg-gray-100">
            Annuler
          </button>
          <button
            onClick={() => {
              onApply([...list.filter((o) => o.label.trim()), ...(empty ? [empty] : [])]);
              onClose();
            }}
            className="text-sm font-semibold text-white bg-[#0073ea] hover:bg-[#0060c2] rounded-md px-5 py-2"
          >
            Appliquer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
