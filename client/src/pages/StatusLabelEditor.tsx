import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Opt } from "@/lib/crm";
import { FAMILLES, couleursPour, familleDeCouleur, familleDuNom, type Famille } from "@/lib/codeCouleur";

// Choix de couleur « intelligent » : la famille (ça avance / en attente / perdu / neutre) est devinée
// d'après le nom de l'étiquette, et seules les couleurs de cette famille sont proposées.
export function ChoixCouleurSens({ nom, hex, prises, onChange }: { nom: string; hex: string; prises: Iterable<string>; onChange: (hex: string) => void }) {
  const [choisie, setChoisie] = useState<Famille | null>(null);
  const devinee = familleDuNom(nom);
  const famille: Famille = choisie ?? devinee ?? familleDeCouleur(hex) ?? "gris";
  const couleurs = couleursPour(famille, Array.from(prises).filter((c) => c.toLowerCase() !== hex.toLowerCase()));
  return (
    <div className="space-y-1.5" dir="ltr">
      <div className="flex flex-wrap gap-1">
        {FAMILLES.map((f) => (
          <button
            key={f.key}
            type="button"
            title={f.aide}
            onClick={() => {
              setChoisie(f.key);
              onChange(couleursPour(f.key, prises)[0]);
            }}
            className={`text-[11px] font-bold rounded-full px-2 py-0.5 border ${famille === f.key ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!choisie && devinee && <p className="text-[11px] text-gray-500">Couleurs proposées d'après le nom « {nom.trim()} ».</p>}
      <div className="flex flex-wrap gap-1.5">
        {couleurs.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Couleur ${c}`}
            className={`w-7 h-7 rounded-md border-2 hover:scale-110 transition ${hex.toLowerCase() === c ? "border-gray-900" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

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
    const hex = couleursPour("gris", taken)[0];
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
          <p className="text-xs text-gray-500">Glissez pour changer l'ordre. La couleur suit le sens de l'étiquette (vert = ça avance, ambre = en attente, rouge = perdu, gris = neutre) : en cliquant sur la pastille, seules les couleurs qui vont avec le nom sont proposées.</p>
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
                  <PopoverContent dir="ltr" className="w-80 p-2.5 bg-white border border-gray-200 shadow-xl" align="start">
                    <ChoixCouleurSens nom={o.label} hex={o.hex} prises={taken} onChange={(c) => patch(i, { hex: c })} />
                  </PopoverContent>
                </Popover>
                <input
                  value={o.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  className="flex-1 min-w-0 text-sm bg-white text-gray-900 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-[#ff6a1a]"
                />
                {o.off && (
                  <button
                    onClick={() => patch(i, { off: false })}
                    title="Étiquette cachée de la liste de choix : cliquer pour la réafficher"
                    className="shrink-0 text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-orange-100 rounded px-1.5 py-0.5"
                  >
                    cachée
                  </button>
                )}
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
            className="text-sm font-semibold text-white bg-[#ff6a1a] hover:bg-[#e85a0c] rounded-md px-5 py-2"
          >
            Appliquer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
