import { useMemo, useState } from "react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import { statusInfo, type Lead } from "@/lib/crm";
import { useColumnsConfig } from "@/lib/crmColumnsConfig";
import { isSigne } from "@/lib/chantiers";
import { lienSms } from "@/lib/relances";

// ─────────────────────────────────────────────────────────────────────────
// Parrainage : chaque client signé reçoit un lien personnel vers /pac
// (…/pac?utm_source=parrainage&utm_campaign=<code>). Le site garde déjà ces
// paramètres (lib/pubOrigine) : la demande du filleul arrive dans Pac Pac avec
// « pubSource = parrainage » et « pubCampagne = code du parrain ». Rien à
// changer sur le site. La prime est due quand le filleul est installé ; on coche
// « payée » une fois versée (fields.primeParrain sur la fiche du filleul).
// ─────────────────────────────────────────────────────────────────────────
export const PRIME_PARRAIN = 100;
const SITE = "https://ip5energie.fr/pac";
const codeDe = (l: Lead) => String(l.fields?.codeParrain || `P${l.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase()}`);
const lienDe = (code: string) => `${SITE}?utm_source=parrainage&utm_campaign=${encodeURIComponent(code)}`;
const prenomDe = (l: Lead) => {
  const p = String(l.name ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
};
const smsParrainage = (l: Lead) =>
  `Bonjour ${prenomDe(l) || ""}, merci pour votre confiance ! Un proche a un projet de pompe à chaleur ? Envoyez-lui ce lien : ${lienDe(codeDe(l))} — s'il installe sa pompe à chaleur avec nous, nous vous offrons ${PRIME_PARRAIN} €. IP5 Énergie`.replace("Bonjour ,", "Bonjour,");
const installe = (l: Lead) => l.fields?.pipeline === "Installé" || /install/i.test(String(statusInfo(l.status).label ?? ""));
const jour = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—");

export default function ParrainageCRM({ email }: { email: string }) {
  const { data: tous } = useLeads();
  const { version } = useColumnsConfig(email, "leads");
  const [copie, setCopie] = useState("");
  const [msg, setMsg] = useState("");
  const leads = useMemo(() => (tous ?? []).filter((l) => !l.deletedAt && (l.board || "leads") === "leads"), [tous]);

  // Clients à qui proposer le parrainage : signés ou installés.
  const parrains = useMemo(
    () => leads.filter((l) => isSigne(l) || installe(l)).sort((a, b) => String(b.statusChangedAt ?? "").localeCompare(String(a.statusChangedAt ?? ""))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, version],
  );
  // Filleuls : demandes arrivées par un lien de parrainage.
  const filleuls = useMemo(() => leads.filter((l) => String(l.fields?.pubSource ?? "").toLowerCase() === "parrainage").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [leads]);
  const parCode = useMemo(() => new Map(leads.map((l) => [codeDe(l).toUpperCase(), l])), [leads]);
  const filleulsDe = (l: Lead) => filleuls.filter((f) => String(f.fields?.pubCampagne ?? "").toUpperCase() === codeDe(l).toUpperCase());

  const ecrire = async (l: Lead, patch: Record<string, unknown>, note?: string) => {
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, "crm_leads", l.id), {
        ...patch,
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
        ...(note ? { notes: m.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: note, by: email, at: new Date().toISOString(), kind: "note" }) } : {}),
      });
    } catch {
      setMsg("Enregistrement refusé.");
    }
  };
  // Le code est enregistré sur la fiche la première fois qu'on partage le lien (il ne change plus ensuite).
  const partager = (l: Lead, comment: string) => ecrire(l, l.fields?.codeParrain ? {} : { "fields.codeParrain": codeDe(l) }, `🤝 Parrainage proposé (${comment}) — code ${codeDe(l)}`);

  const signesFilleuls = filleuls.filter(isSigne);
  // La prime est due quand le filleul est installé (comme promis dans le SMS).
  const dues = filleuls.filter((f) => installe(f) && f.fields?.primeParrain !== "payée");
  const tuile = "rounded-2xl border border-[#e6eaf2] bg-white px-4 py-3 shadow-sm";

  return (
    <div className="max-w-[1300px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Parrainage</h1>
        <p className="text-sm text-gray-600">
          Chaque client signé a son lien personnel. S'il l'envoie à un proche et que ce proche installe sa pompe à chaleur, le client touche {PRIME_PARRAIN} €. Les demandes des proches arrivent dans Pac Pac comme les autres (source « parrainage »).
        </p>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className={tuile}><p className="text-xs text-gray-500">Clients qui peuvent parrainer</p><p className="text-2xl font-black text-gray-900">{parrains.length}</p></div>
        <div className={tuile}><p className="text-xs text-gray-500">Proches envoyés (filleuls)</p><p className="text-2xl font-black text-gray-900">{filleuls.length}</p></div>
        <div className={tuile}><p className="text-xs text-gray-500">Filleuls signés</p><p className="text-2xl font-black text-emerald-700">{signesFilleuls.length}</p></div>
        <div className={tuile}><p className="text-xs text-gray-500">Primes à verser</p><p className={`text-2xl font-black ${dues.length ? "text-[#d97706]" : "text-gray-900"}`}>{dues.length ? `${dues.length * PRIME_PARRAIN} €` : "0 €"}</p></div>
      </div>

      {/* Filleuls */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-black text-gray-900">Les proches envoyés par nos clients</h2>
        {filleuls.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">Pas encore de filleul. Envoyez le lien aux clients signés ci-dessous.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[12px] font-bold text-gray-700">
                <tr className="[&>th]:py-2 [&>th]:px-3 [&>th]:text-left">
                  <th>Filleul</th><th>Arrivé le</th><th>Statut</th><th>Parrainé par</th><th>Prime</th>
                </tr>
              </thead>
              <tbody>
                {filleuls.map((f) => {
                  const p = parCode.get(String(f.fields?.pubCampagne ?? "").toUpperCase());
                  const signe = installe(f);
                  const payee = f.fields?.primeParrain === "payée";
                  return (
                    <tr key={f.id} className="border-t border-gray-100 [&>td]:py-2 [&>td]:px-3">
                      <td className="font-semibold text-gray-900">{f.name}</td>
                      <td className="text-gray-600">{jour(f.createdAt)}</td>
                      <td>{String(statusInfo(f.status).label || "—")}</td>
                      <td>{p ? <span className="font-semibold">{p.name}</span> : <span className="text-gray-400">code {String(f.fields?.pubCampagne ?? "?")}</span>}</td>
                      <td>
                        {!signe ? (
                          <span className="text-gray-400">{isSigne(f) ? "signé · à la pose" : "quand il sera installé"}</span>
                        ) : (
                          <label className="inline-flex items-center gap-2 font-semibold">
                            <input type="checkbox" checked={payee} onChange={(e) => ecrire(f, { "fields.primeParrain": e.target.checked ? "payée" : "" }, e.target.checked ? `🤝 Prime de parrainage (${PRIME_PARRAIN} €) versée à ${p?.name ?? "parrain"}` : undefined)} />
                            <span className={payee ? "text-emerald-700" : "text-[#d97706]"}>{payee ? "payée" : `${PRIME_PARRAIN} € à verser`}</span>
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parrains */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-black text-gray-900">Proposer le parrainage aux clients signés</h2>
        <p className="text-sm text-gray-600">Le bon moment : juste après la pose, quand le client est content. Le SMS contient son lien personnel.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[12px] font-bold text-gray-700">
              <tr className="[&>th]:py-2 [&>th]:px-3 [&>th]:text-left">
                <th>Client</th><th>Statut</th><th>Code</th><th>Filleuls</th><th>Déjà proposé</th><th className="!text-right">Envoyer</th>
              </tr>
            </thead>
            <tbody>
              {parrains.map((l) => {
                const texte = smsParrainage(l);
                const nb = filleulsDe(l).length;
                const propose = (l.notes ?? []).filter((n) => /Parrainage proposé/.test(n.text ?? "")).map((n) => n.at).sort().pop();
                return (
                  <tr key={l.id} className="border-t border-gray-100 [&>td]:py-2 [&>td]:px-3">
                    <td className="font-semibold text-gray-900">{l.name}</td>
                    <td className="text-gray-600">{installe(l) ? "Installé" : String(statusInfo(l.status).label || "Signé")}</td>
                    <td className="font-mono text-xs text-gray-500">{codeDe(l)}</td>
                    <td className={nb ? "font-bold text-emerald-700" : "text-gray-400"}>{nb || "—"}</td>
                    <td className="text-gray-500">{propose ? jour(propose) : "jamais"}</td>
                    <td className="text-right whitespace-nowrap">
                      {l.phone && (
                        <a href={lienSms(l.phone, texte)} onClick={() => partager(l, "SMS")} className="md:hidden rounded-lg bg-[#edf2f8] px-2 py-1 text-xs font-bold text-[#1f4b7f]">
                          💬 SMS
                        </a>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(texte).catch(() => {});
                          setCopie(l.id);
                          partager(l, "SMS copié");
                        }}
                        title={texte}
                        className="hidden md:inline rounded-lg bg-[#edf2f8] px-2 py-1 text-xs font-bold text-[#1f4b7f] hover:bg-[#dde6f1]"
                      >
                        {copie === l.id ? "✓ Copié" : "💬 Copier le SMS"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {parrains.length === 0 && (
                <tr><td className="py-3 text-gray-400" colSpan={6}>Aucun client signé pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
