import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Lead, Opt } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// « Ajouter un lead manuellement » : un carré propre avec seulement l'essentiel
// (nom, téléphone, code postal, ville, source, attribué à, statut).
// La fiche est créée dès que le téléphone est bon (bouton ou Entrée) ;
// si le numéro existe déjà, on propose d'ouvrir la fiche existante.
// ─────────────────────────────────────────────────────────────────────────
export type NouveauLead = { name: string; phone: string; postalCode: string; city: string; source: string; attribue: string; status: string };

// Numéro français → +33XXXXXXXXX (null si incomplet).
export function telValide(v: string): string | null {
  let d = v.replace(/[^\d+]/g, "");
  if (d.startsWith("+33")) d = "0" + d.slice(3);
  else if (d.startsWith("0033")) d = "0" + d.slice(4);
  else if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2);
  if (!/^0[1-9]\d{8}$/.test(d)) return null;
  return "+33" + d.slice(1);
}
const cle = (v: string) => (telValide(v) ?? v.replace(/\D/g, "")).slice(-9);

const SOURCES = [
  { key: "saisie-manuelle", label: "Saisie manuelle" },
  { key: "telephone", label: "Appel entrant" },
  { key: "bouche-a-oreille", label: "Bouche-à-oreille" },
  { key: "meta", label: "Facebook / Instagram" },
  { key: "site", label: "Site internet" },
];

export default function NouveauLeadDialog({
  groupe,
  leads,
  attribues,
  statuts,
  onCreate,
  onOpen,
  onClose,
}: {
  groupe: string;
  leads: Lead[];
  attribues: readonly Opt[];
  statuts: readonly Opt[];
  onCreate: (l: NouveauLead) => Promise<void>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<NouveauLead>({ name: "", phone: "", postalCode: "", city: "", source: "saisie-manuelle", attribue: "", status: "a_appeler" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const tel = telValide(f.phone);
  const doublon = useMemo(() => (tel ? leads.find((l) => l.phone && cle(l.phone) === cle(tel)) : undefined), [tel, leads]);
  const set = (k: keyof NouveauLead) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ok = !!tel && !doublon && !busy;
  const creer = async () => {
    if (!ok || !tel) return;
    setBusy(true);
    setErr("");
    try {
      await onCreate({ ...f, name: f.name.trim() || tel, phone: tel, city: f.city.trim(), postalCode: f.postalCode.trim() });
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Impossible de créer la fiche. Réessayez.");
      setBusy(false);
    }
  };
  const champ = "w-full text-[15px] bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15";
  const lab = "block text-[12px] font-bold text-gray-500 mb-1";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="ltr" className="max-w-lg bg-white text-gray-900 rounded-2xl p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle className="text-lg font-extrabold">＋ Ajouter un lead manuellement</DialogTitle>
          <p className="text-xs text-gray-500 mt-0.5">Groupe : {groupe}. Seul le téléphone est obligatoire.</p>
        </div>
        <form
          className="px-6 py-4 grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            creer();
          }}
        >
          <div className="col-span-2">
            <label className={lab}>Téléphone *</label>
            <input autoFocus inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="06 12 34 56 78" className={`${champ} text-lg font-semibold tracking-wide`} />
            {f.phone && !tel && <p className="text-[12px] text-[#d97706] mt-1">Numéro incomplet (10 chiffres).</p>}
            {tel && !doublon && <p className="text-[12px] text-[#059669] mt-1">✓ Numéro valide</p>}
            {doublon && (
              <p className="text-[12px] text-[#dc2626] mt-1">
                Ce numéro existe déjà : <b>{doublon.name || "fiche sans nom"}</b>.{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpen(doublon.id);
                  }}
                  className="font-bold text-[#2563eb] underline"
                >
                  Ouvrir la fiche
                </button>
              </p>
            )}
          </div>
          <div className="col-span-2">
            <label className={lab}>Nom et prénom</label>
            <input value={f.name} onChange={set("name")} placeholder="Jean Dupont" className={champ} />
          </div>
          <div>
            <label className={lab}>Code postal</label>
            <input inputMode="numeric" value={f.postalCode} onChange={set("postalCode")} placeholder="13100" className={champ} />
          </div>
          <div>
            <label className={lab}>Ville</label>
            <input value={f.city} onChange={set("city")} placeholder="Aix-en-Provence" className={champ} />
          </div>
          <div>
            <label className={lab}>Attribué à</label>
            <select value={f.attribue} onChange={set("attribue")} className={champ}>
              <option value="">Personne</option>
              {attribues.filter((o) => o.label && !o.off).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab}>Statut</label>
            <select value={f.status} onChange={set("status")} className={champ}>
              {statuts.filter((o) => o.label && !o.off).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lab}>Source</label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setF({ ...f, source: s.key })}
                  className={`text-[13px] font-semibold rounded-full px-3 py-1.5 border ${f.source === s.key ? "bg-[#2563eb] text-white border-[#2563eb]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="col-span-2 text-sm text-[#dc2626]">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-600 rounded-xl px-4 py-2.5 hover:bg-gray-100">
              Annuler
            </button>
            <button type="submit" disabled={!ok} className="text-sm font-bold text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 rounded-xl px-5 py-2.5">
              {busy ? "Création…" : "Créer la fiche"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
