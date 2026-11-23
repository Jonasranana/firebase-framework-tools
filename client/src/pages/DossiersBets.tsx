import { useMemo, useState } from "react";
import { Phone, MapPin, Search } from "lucide-react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import { statusInfo, type Lead } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// « Dossiers BETS » : les clients qu'on ne peut pas prendre chez Praimy (déjà une
// pompe à chaleur, non éligibles…) et qu'on envoie chez Betsalel (BETS), qui s'occupe
// ensuite de tout. Suivi volontairement simple : envoyé → visite faite → installé.
// Un client y apparaît dès que, dans Pac Pac, son statut appel est une étiquette BETS,
// son poseur est « BETS » ou son pipeline est « BETSALEL ».
// ─────────────────────────────────────────────────────────────────────────
const ETAPES = [
  { key: "en_cours_bets", label: "1. Envoyé chez BETS", hex: "#66ccff" },
  { key: "vt_faite_bets", label: "2. Visite faite par BETS", hex: "#216edf" },
  { key: "installer_bets", label: "3. Installé par BETS", hex: "#037f4c" },
];
const estBets = (l: Lead) =>
  !l.deletedAt &&
  (l.board || "leads") === "leads" &&
  (ETAPES.some((e) => e.key === l.status) || l.fields.poseur === "BETS" || l.fields.pipeline === "BETSALEL");

export default function DossiersBets({ email, onOpenLead }: { email: string; onOpenLead: (id: string) => void }) {
  const { data: allLeads } = useLeads();
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const leads = useMemo(() => (allLeads ?? []).filter(estBets), [allLeads]);
  const shown = leads.filter((l) => {
    const s = q.trim().toLowerCase();
    return !s || `${l.name} ${l.phone} ${l.city} ${l.postalCode}`.toLowerCase().includes(s);
  });

  const setEtape = async (l: Lead, key: string) => {
    if (key === l.status) return;
    setErr("");
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, "crm_leads", l.id), {
        status: key,
        statusChangedAt: m.serverTimestamp(),
        crmOwned: true,
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
        notes: m.arrayUnion({
          id: Math.random().toString(36).slice(2, 12),
          text: `${statusInfo(l.status).label} → ${statusInfo(key).label}`,
          by: email,
          at: new Date().toISOString(),
          kind: "statut",
        }),
      });
    } catch (e) {
      console.error(e);
      setErr("Impossible d'enregistrer le changement. Réessayez.");
    }
  };

  const groupes = [
    ...ETAPES.map((e) => ({ ...e, rows: shown.filter((l) => l.status === e.key) })),
    { key: "autre", label: "À classer (poseur BETS ou pipeline BETSALEL, sans étape BETS)", hex: "#9ca3af", rows: shown.filter((l) => !ETAPES.some((e) => e.key === l.status)) },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Dossiers BETS</h1>
        <p className="text-sm text-gray-600 mt-1">
          Clients qu'on ne prend pas chez Praimy (déjà équipés d'une pompe à chaleur, non éligibles…) et qu'on envoie chez <b>Betsalel</b>, qui s'occupe ensuite de
          tout. Pour en ajouter un : dans Pac Pac, mettez son statut appel sur « En cours chez BETS ».
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ETAPES.map((e) => (
          <span key={e.key} className="text-xs font-bold text-white rounded-full px-3 py-1" style={{ background: e.hex }}>
            {e.label} · {leads.filter((l) => l.status === e.key).length}
          </span>
        ))}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg" />
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!allLeads ? (
        <p className="text-sm text-gray-500 py-10 text-center">Chargement…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-gray-500 py-10 text-center">Aucun client envoyé chez BETS pour l'instant.</p>
      ) : (
        groupes
          .filter((g) => g.rows.length)
          .map((g) => (
            <div key={g.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 text-sm font-extrabold text-gray-800 flex items-center gap-2" style={{ borderLeft: `6px solid ${g.hex}` }}>
                {g.label} <span className="font-semibold text-gray-400">· {g.rows.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50 border-y border-gray-200">
                    <th className="text-left py-2 px-4">Client</th>
                    <th className="text-left py-2 px-4">Téléphone</th>
                    <th className="text-left py-2 px-4">Ville</th>
                    <th className="text-left py-2 px-4">Étape BETS</th>
                    <th className="text-left py-2 px-4">Dernière note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {g.rows.map((l) => {
                    const last = [...l.notes].filter((n) => n.kind === "note" && n.text).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
                    return (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4">
                          <button onClick={() => onOpenLead(l.id)} className="font-semibold text-gray-900 hover:text-[#0073ea] hover:underline text-left" title="Ouvrir la fiche dans Pac Pac">
                            {l.name || "Sans nom"}
                          </button>
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          {l.phone ? (
                            <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0073ea]">
                              <Phone size={12} /> {l.phone}
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-600 whitespace-nowrap">
                          <MapPin size={12} className="inline text-gray-400 mr-1" />
                          {[l.postalCode, l.city].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="py-2 px-4">
                          <select value={ETAPES.some((e) => e.key === l.status) ? l.status : ""} onChange={(e) => setEtape(l, e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white">
                            {!ETAPES.some((e) => e.key === l.status) && <option value="">— choisir —</option>}
                            {ETAPES.map((e) => (
                              <option key={e.key} value={e.key}>
                                {e.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-600 max-w-[280px] truncate" title={last?.text}>
                          {last ? last.text : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
      )}
    </div>
  );
}
