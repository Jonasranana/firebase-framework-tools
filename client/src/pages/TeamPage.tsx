import { useMemo, useState } from "react";
import { BellOff, Check, Loader2, Pencil, Phone, Trash2, UserPlus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { callTeam, isRootAdmin, useTeam, type TeamMember } from "@/lib/crmTeam";
import { useLeads } from "@/lib/crmStore";
import { statusInfo, type Lead } from "@/lib/crm";
import { accesDe } from "@/lib/crmAcces";
import ProfileDialog from "./ProfileDialog";

// Page « Équipe » : qui a accès au CRM, avec la fiche de chaque personne
// (photo, poste, téléphone, e-mails de mise à jour). Chacun modifie son
// propre profil ; les trois administrateurs modifient tous les profils,
// ajoutent et retirent des personnes (e-mail Google).
// Les administrateurs voient en plus, pour chaque personne : ce à quoi elle a
// accès dans le CRM, son activité (d'après l'historique des fiches) et ses leads attribués.
export default function TeamPage({ email, onOpenLead }: { email: string; onOpenLead?: (id: string) => void }) {
  const members = useTeam();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [selected, setSelected] = useState<string>("");
  const admin = isRootAdmin(email);

  const run = async (data: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await callTeam(data);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  // Activité de la semaine de chacun (pour la liste et pour ouvrir par défaut la personne la plus active).
  const { data: leads } = useLeads();
  const activite = useMemo(() => {
    const out = new Map<string, { n: number; last: number }>();
    if (!leads || !members || !admin) return out;
    const depuis = Date.now() - 7 * JOUR;
    const parBy = new Map<string, string>();
    for (const m of members) {
      parBy.set(m.email.toLowerCase(), m.email);
      parBy.set(m.name.toLowerCase(), m.email);
    }
    for (const l of leads)
      for (const n of l.notes ?? []) {
        const who = parBy.get(String(n.by ?? "").toLowerCase());
        if (!who) continue;
        const t = Date.parse(n.at);
        if (!Number.isFinite(t)) continue;
        const r = out.get(who) ?? { n: 0, last: 0 };
        if (t >= depuis) r.n++;
        r.last = Math.max(r.last, t);
        out.set(who, r);
      }
    return out;
  }, [leads, members, admin]);
  const parDefaut = members
    ?.filter((m) => !m.root)
    .sort((a, b) => (activite.get(b.email)?.last ?? 0) - (activite.get(a.email)?.last ?? 0))[0];
  const choisi = members?.find((m) => m.email === selected) ?? (admin ? parDefaut ?? members?.[0] : undefined);

  const liste = members && (
    <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
      {members.map((m) => {
        const canEdit = admin || m.email === email.toLowerCase();
        const actif = admin && choisi?.email === m.email;
        return (
          <li
            key={m.email}
            onClick={() => admin && setSelected(m.email)}
            className={`flex items-center gap-3 px-4 py-3 ${admin ? "cursor-pointer hover:bg-gray-50" : ""} ${actif ? "bg-blue-50/70 hover:bg-blue-50/70" : ""}`}
          >
            <Avatar name={m.name} photoUrl={m.photoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 truncate">
                {m.name}
                {m.email === email.toLowerCase() && <span className="ml-1.5 text-[11px] font-semibold text-gray-400">(vous)</span>}
              </p>
              {m.title && <p className="text-xs text-gray-600 truncate">{m.title}</p>}
              <p className="text-xs text-gray-500 truncate">{m.email}</p>
              {admin && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {activite.get(m.email)?.n ? <b>{activite.get(m.email)!.n} actions</b> : "Aucune action"} sur 7 jours
                  {activite.get(m.email)?.last ? ` · dernière ${quand(new Date(activite.get(m.email)!.last).toISOString())}` : ""}
                </p>
              )}
              {m.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone size={10} /> {m.phone}
                </p>
              )}
            </div>
            {m.notify === false && (
              <span title="Ne reçoit pas les e-mails de mise à jour" className="text-gray-400">
                <BellOff size={15} />
              </span>
            )}
            <span className={`hidden sm:inline text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.root ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
              {m.root ? (admin ? "Admin" : "Administrateur") : "Membre"}
            </span>
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(m);
                }}
                title="Modifier le profil"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2b5a8f] border border-[#2b5a8f]/40 rounded-lg px-2.5 py-1.5 hover:bg-blue-50"
              >
                <Pencil size={12} /> {admin ? "" : "Modifier"}
              </button>
            )}
            {admin && !m.root && (
              <button
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Retirer l'accès de ${m.name} ?`)) run({ action: "remove", email: m.email });
                }}
                aria-label={`Retirer ${m.name}`}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  const ajout = admin && (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
        <UserPlus size={16} /> Ajouter une personne
      </h3>
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Prénom et nom"
        className="w-full text-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f]"
      />
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder="Adresse Gmail / Google de la personne"
        className="w-full text-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f]"
      />
      <button
        disabled={busy || !newEmail.includes("@")}
        onClick={async () => {
          await run({ action: "add", email: newEmail, name: newName });
          setNewEmail("");
          setNewName("");
        }}
        className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl py-2.5"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
        Ajouter à l'équipe
      </button>
      <p className="text-xs text-gray-400">
        La personne se connecte ensuite sur ip5energie.fr/admin avec ce compte Google. Elle recevra aussi les e-mails de mise à jour des fiches. Elle arrive avec les
        accès « Membre » (voir la fiche à droite).
      </p>
    </div>
  );

  return (
    <div className={`[color-scheme:light] ${admin ? "max-w-[1400px] mx-auto" : "max-w-2xl mx-auto"}`}>
      <p className="text-sm text-gray-500 mb-4">
        Les personnes ci-dessous peuvent se connecter à ce CRM avec leur compte Google.
        {admin ? " Cliquez sur une personne pour voir ses accès et son activité." : " Vous pouvez modifier votre profil ; seuls les administrateurs ajoutent ou retirent quelqu'un."}
      </p>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!members && (
        <div className="py-8 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto" size={22} />
        </div>
      )}
      {members &&
        (admin ? (
          <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
            <div className="space-y-6 lg:sticky lg:top-4">
              {liste}
              {ajout}
            </div>
            {choisi && <FichePersonne key={choisi.email} m={choisi} onOpenLead={onOpenLead} />}
          </div>
        ) : (
          <div className="space-y-6">{liste}</div>
        ))}
      {editing && <ProfileDialog key={editing.email} member={editing} open onClose={() => setEditing(null)} />}
    </div>
  );
}

// ── Fiche d'une personne (vue administrateur) ───────────────────────────────
const JOUR = 86400000;
const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const quand = (iso: string) => {
  const d = new Date(iso);
  const auj = new Date();
  const hier = new Date(Date.now() - JOUR);
  if (d.toDateString() === auj.toDateString()) return `aujourd'hui à ${heure(iso)}`;
  if (d.toDateString() === hier.toDateString()) return `hier à ${heure(iso)}`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${heure(iso)}`;
};
const cle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Action = { lead: Lead; at: string; t: number; text: string; type: "statut" | "note" | "message" | "rangement" };

function typeAction(kind: string | undefined, text: string): Action["type"] {
  if (kind === "note" || !kind) return "note";
  if (kind === "message" || kind === "mail") return "message";
  if (/^(Attribué|Groupe|Tableau)/i.test(text)) return "rangement";
  return "statut";
}

function FichePersonne({ m, onOpenLead }: { m: TeamMember; onOpenLead?: (id: string) => void }) {
  const { data: leads } = useLeads();
  const [periode, setPeriode] = useState<1 | 7 | 30>(7);
  const acces = accesDe(m.email);
  const prenom = m.name.split(/\s+/)[0] ?? m.name;

  const d = useMemo(() => {
    if (!leads) return null;
    const mail = m.email.toLowerCase();
    const nom = m.name.toLowerCase();
    const estLui = (by?: string) => {
      const b = String(by ?? "").toLowerCase();
      return b === mail || (!!nom && b === nom);
    };
    const actions: Action[] = [];
    for (const l of leads) {
      if (l.deletedAt) continue;
      for (const n of l.notes ?? []) {
        if (!estLui(n.by)) continue;
        const t = Date.parse(n.at);
        if (!Number.isFinite(t)) continue;
        actions.push({ lead: l, at: n.at, t, text: n.text ?? "", type: typeAction(n.kind, n.text ?? "") });
      }
    }
    actions.sort((a, b) => b.t - a.t);
    // Portefeuille : fiches où il est dans « Attribué à ».
    const p = prenom.toLowerCase();
    const portefeuille = leads.filter((l) => !l.deletedAt && (l.board || "leads") === "leads" && String(l.fields?.attribue ?? "").toLowerCase().split(/[,;/]+/).some((x) => x.trim() === p || x.trim() === nom));
    return { actions, portefeuille };
  }, [leads, m.email, m.name, prenom]);

  const stats = useMemo(() => {
    if (!d) return null;
    const debut = periode === 1 ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : Date.now() - periode * JOUR;
    const a = d.actions.filter((x) => x.t >= debut);
    const fiches = new Set(a.map((x) => x.lead.id)).size;
    const jours = new Set(a.map((x) => cle(new Date(x.t)))).size;
    const statuts = a.filter((x) => x.type === "statut");
    const resultats = new Map<string, number>();
    for (const s of statuts) {
      const apres = s.text.split("→").pop()?.trim() || "?";
      resultats.set(apres, (resultats.get(apres) ?? 0) + 1);
    }
    // Les 14 derniers jours, pour le graphique.
    const parJour: { k: string; label: string; n: number; we: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const x = new Date(Date.now() - i * JOUR);
      parJour.push({ k: cle(x), label: x.toLocaleDateString("fr-FR", { weekday: "narrow", day: "numeric" }), n: 0, we: x.getDay() === 0 || x.getDay() === 6 });
    }
    for (const x of d.actions) {
      const j = parJour.find((p) => p.k === cle(new Date(x.t)));
      if (j) j.n++;
    }
    // Aujourd'hui : première et dernière action.
    const auj = d.actions.filter((x) => cle(new Date(x.t)) === cle(new Date()));
    return {
      total: a.length,
      fiches,
      jours,
      statuts: statuts.length,
      notes: a.filter((x) => x.type === "note").length,
      messages: a.filter((x) => x.type === "message").length,
      rangement: a.filter((x) => x.type === "rangement").length,
      resultats: Array.from(resultats.entries()).sort((x, y) => y[1] - x[1]).slice(0, 8),
      parJour,
      max: Math.max(1, ...parJour.map((p) => p.n)),
      auj: auj.length ? { n: auj.length, de: auj[auj.length - 1].at, a: auj[0].at } : null,
    };
  }, [d, periode]);

  const porte = useMemo(() => {
    if (!d) return null;
    const parStatut = new Map<string, number>();
    for (const l of d.portefeuille) parStatut.set(l.status || "vide", (parStatut.get(l.status || "vide") ?? 0) + 1);
    const jamaisTouchees = d.portefeuille.filter((l) => !(l.notes ?? []).some((n) => d.actions.some((a) => a.lead.id === l.id && a.at === n.at))).length;
    return { total: d.portefeuille.length, parStatut: Array.from(parStatut.entries()).sort((a, b) => b[1] - a[1]), jamaisTouchees };
  }, [d]);

  const derniere = d?.actions[0];

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
        <Avatar name={m.name} photoUrl={m.photoUrl} size={64} />
        <div className="flex-1 min-w-[200px]">
          <p className="text-xl font-extrabold text-gray-900">{m.name}</p>
          <p className="text-sm text-gray-500">
            {m.title ? `${m.title} · ` : ""}
            {m.root ? "Administrateur" : "Membre"} · {m.email}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            Dernière action : {derniere ? <b>{quand(derniere.at)}</b> : <span className="text-gray-400">aucune trouvée</span>}
            {derniere && <span className="text-gray-500"> — {derniere.lead.name || "fiche sans nom"}</span>}
          </p>
        </div>
        {stats?.auj && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-900">
            Aujourd'hui : <b>{stats.auj.n} actions</b>
            <br />
            de {heure(stats.auj.de)} à {heure(stats.auj.a)}
          </div>
        )}
      </div>

      {/* Activité */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="text-lg font-extrabold text-gray-900">Son activité</h3>
          <div className="ml-auto inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {([1, 7, 30] as const).map((p) => (
              <button key={p} onClick={() => setPeriode(p)} className={`px-3 py-1.5 font-semibold ${periode === p ? "bg-[#2b5a8f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {p === 1 ? "Aujourd'hui" : `${p} jours`}
              </button>
            ))}
          </div>
        </div>
        {!stats ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { t: "Fiches travaillées", v: stats.fiches, s: `${stats.total} actions au total` },
                { t: "Statuts changés", v: stats.statuts, s: "≈ appels passés et notés" },
                { t: "Notes écrites", v: stats.notes, s: `${stats.messages} SMS / e-mails envoyés` },
                { t: "Jours actifs", v: stats.jours, s: periode === 1 ? "aujourd'hui" : `sur ${periode} jours` },
              ].map((k) => (
                <div key={k.t} className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">{k.t}</p>
                  <p className="text-2xl font-extrabold text-gray-900">{k.v}</p>
                  <p className="text-[11px] text-gray-500">{k.s}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-5">
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">Actions par jour (14 derniers jours)</p>
                <div className="flex items-end gap-1 h-32">
                  {stats.parJour.map((p) => (
                    <div key={p.k} className="flex-1 flex flex-col items-center justify-end h-full" title={`${p.n} action(s)`}>
                      <span className="text-[10px] text-gray-500">{p.n || ""}</span>
                      <div className={`w-full rounded-t ${p.we ? "bg-gray-300" : "bg-[#2b5a8f]"}`} style={{ height: `${(p.n / stats.max) * 100}%`, minHeight: p.n ? 3 : 0 }} />
                      <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">Statuts qu'il a mis {periode === 1 ? "aujourd'hui" : `(${periode} jours)`}</p>
                {stats.resultats.length ? (
                  <div className="space-y-1.5">
                    {stats.resultats.map(([lab, n]) => (
                      <div key={lab} className="flex items-center gap-2 text-sm">
                        <span className="w-40 truncate text-gray-700" title={lab}>
                          {lab}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className="h-2 rounded-full bg-[#2b5a8f]" style={{ width: `${(100 * n) / stats.resultats[0][1]}%` }} />
                        </div>
                        <b className="w-8 text-right text-gray-900">{n}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Aucun changement de statut sur la période.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {/* Portefeuille */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-lg font-extrabold text-gray-900">Ses leads attribués</h3>
          <p className="text-xs text-gray-500 mb-3">Fiches de Pac Pac avec « {prenom} » dans la colonne « Attribué à ».</p>
          {!porte ? (
            <p className="text-sm text-gray-400">Chargement…</p>
          ) : porte.total === 0 ? (
            <p className="text-sm text-gray-400">Aucune fiche attribuée.</p>
          ) : (
            <>
              <p className="text-3xl font-extrabold text-gray-900">
                {porte.total} <span className="text-sm font-semibold text-gray-500">fiches</span>
              </p>
              {porte.jamaisTouchees > 0 && (
                <p className="text-sm text-amber-700 mt-1">
                  dont <b>{porte.jamaisTouchees}</b> qu'il n'a encore jamais touchées
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {porte.parStatut.map(([k, n]) => {
                  const s = statusInfo(k);
                  return (
                    <span key={k} className="text-xs font-bold text-white rounded-full px-2.5 py-1" style={{ background: s.hex || "#c4c4c4" }}>
                      {s.label || "Sans statut"} · {n}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Accès */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-lg font-extrabold text-gray-900">Ce qu'il voit dans le CRM</h3>
          <p className="text-xs text-gray-500 mb-3">Accès « {m.root ? "Administrateur" : "Membre"} ».</p>
          <div className="space-y-4">
            {acces.map((g) => (
              <div key={g.titre}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">{g.titre}</p>
                <ul className="space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.label} className={`flex items-start gap-2 text-sm ${it.ok ? "text-gray-800" : "text-gray-400"}`}>
                      {it.ok ? <Check size={15} className="text-emerald-600 mt-0.5 shrink-0" /> : <X size={15} className="text-red-400 mt-0.5 shrink-0" />}
                      <span>
                        {it.label}
                        {it.detail && <span className="text-xs text-gray-500"> ({it.detail})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dernières actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-lg font-extrabold text-gray-900 mb-3">Ses dernières actions</h3>
        {!d ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : !d.actions.length ? (
          <p className="text-sm text-gray-400">Aucune action trouvée dans l'historique des fiches.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {d.actions.slice(0, 25).map((a, i) => (
              <li key={i} className="py-2 flex items-start gap-3 text-sm">
                <span className="w-36 shrink-0 text-gray-500">{quand(a.at)}</span>
                <span className="shrink-0">{a.type === "statut" ? "📞" : a.type === "note" ? "📝" : a.type === "message" ? "💬" : "📂"}</span>
                <span className="flex-1 min-w-0">
                  <button
                    disabled={!onOpenLead}
                    onClick={() => onOpenLead?.(a.lead.id)}
                    className="font-semibold text-gray-900 hover:text-[#0073ea] hover:underline disabled:hover:no-underline disabled:hover:text-gray-900"
                  >
                    {a.lead.name || "Fiche sans nom"}
                  </button>
                  <span className="text-gray-600"> — {a.text.length > 140 ? a.text.slice(0, 140) + "…" : a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-400 mt-3">
          D'après l'historique des fiches (changements de statut, notes, SMS / e-mails, rangement). Les appels passés sans rien noter dans la fiche n'apparaissent pas.
        </p>
      </div>
    </div>
  );
}
