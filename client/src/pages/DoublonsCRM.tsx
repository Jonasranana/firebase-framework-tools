import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLeads } from "@/lib/crmStore";
import { CRM_LEADS_COLLECTION, formatPhone, phoneDigitsIntl, statusInfo, type Lead } from "@/lib/crm";
import { CRM_DOCUMENTS_COLLECTION } from "@/lib/crmDocs";
import { crmFirestore } from "@/lib/crmDb";

// ─────────────────────────────────────────────────────────────────────────
// Doublons : fiches qui partagent le même téléphone ou le même e-mail.
// RIEN n'est jamais fusionné ni supprimé automatiquement : chaque fusion est
// décidée par une personne de l'équipe, fiche par fiche. La fiche gardée
// reçoit les informations, notes et documents des autres, qui vont à la
// corbeille (30 jours) et restent restaurables.
// ─────────────────────────────────────────────────────────────────────────
const IGNORED_DOC = ["crm_boards", "duplicates_ignored"] as const;

const phoneKey = (p: string) => {
  const d = phoneDigitsIntl(p);
  return d.length >= 9 ? d.slice(-9) : "";
};
const emailKey = (e: string) => (/.+@.+\..+/.test(e.trim()) ? e.trim().toLowerCase() : "");

function clusters(leads: Lead[]): Lead[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  leads.forEach((l) => parent.set(l.id, l.id));
  const seen = new Map<string, string>();
  for (const l of leads) {
    for (const k of [phoneKey(l.phone) && `p${phoneKey(l.phone)}`, emailKey(l.email) && `e${emailKey(l.email)}`]) {
      if (!k) continue;
      const other = seen.get(k);
      if (other) union(l.id, other);
      else seen.set(k, l.id);
    }
  }
  const groups = new Map<string, Lead[]>();
  for (const l of leads) {
    const r = find(l.id);
    groups.set(r, [...(groups.get(r) ?? []), l]);
  }
  return Array.from(groups.values())
    .filter((g) => g.length > 1)
    .sort((a, b) => b.length - a.length);
}

const richness = (l: Lead) =>
  l.notes.length * 3 + l.docCount * 3 + Object.values(l.fields).filter(Boolean).length + (l.status !== "vide" ? 2 : 0);

const clusterKey = (g: Lead[]) => g.map((l) => l.id).sort().join("|");

async function merge(group: Lead[], mainId: string, email: string) {
  const { m, db } = await crmFirestore();
  const main = group.find((l) => l.id === mainId)!;
  const others = group.filter((l) => l.id !== mainId);
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "phone", "email", "postalCode", "city", "source", "projet", "rappelLe", "group"] as const) {
    if (!main[k]) {
      const v = others.map((o) => o[k]).find(Boolean);
      if (v) patch[k] = v;
    }
  }
  if (main.status === "vide") {
    const s = others.map((o) => o.status).find((x) => x !== "vide");
    if (s) patch.status = s;
  }
  const fields: Record<string, string> = { ...main.fields };
  const details: Record<string, string> = { ...main.details };
  for (const o of others) {
    for (const [k, v] of Object.entries(o.fields)) if (v && !fields[k]) fields[k] = v;
    for (const [k, v] of Object.entries(o.details)) if (v && !details[k]) details[k] = v;
  }
  const notes = new Map(main.notes.map((n) => [n.id, n]));
  for (const o of others) for (const n of o.notes) if (!notes.has(n.id)) notes.set(n.id, n);
  const trace = {
    id: Math.random().toString(36).slice(2, 10),
    text: `Fusion de ${others.length} doublon${others.length > 1 ? "s" : ""} : ${others.map((o) => o.name || o.id).join(", ")} (restaurables 30 jours dans la corbeille)`,
    by: email,
    at: new Date().toISOString(),
    kind: "statut" as const,
  };
  const mergedNotes = [...Array.from(notes.values()), trace].sort((a, b) => a.at.localeCompare(b.at));

  // Documents des autres fiches → fiche gardée (les fichiers ne bougent pas).
  let moved = 0;
  const cats = new Set(main.docCats);
  for (const o of others) {
    const snap = await m.getDocs(m.query(m.collection(db, CRM_DOCUMENTS_COLLECTION), m.where("ownerId", "==", o.id)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = m.writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d: any) => b.update(d.ref, { ownerId: main.id, ownerName: (patch.name as string) || main.name }));
      await b.commit();
    }
    moved += snap.size;
    o.docCats.forEach((c) => cats.add(c));
  }

  const batch = m.writeBatch(db);
  batch.update(m.doc(db, CRM_LEADS_COLLECTION, main.id), {
    ...patch,
    fields,
    details,
    notes: mergedNotes,
    docCount: main.docCount + moved,
    docCats: Array.from(cats),
    mailNonLu: group.some((l) => l.mailNonLu),
    updatedAt: m.serverTimestamp(),
    updatedBy: email,
  });
  for (const o of others) {
    batch.update(m.doc(db, CRM_LEADS_COLLECTION, o.id), {
      deletedAt: new Date(),
      deletedBy: email,
      mergedInto: main.id,
      updatedAt: m.serverTimestamp(),
    });
  }
  await batch.commit();
}

export default function DoublonsCRM({ email, onOpenLead }: { email: string; onOpenLead: (id: string) => void }) {
  const { data: leads, error } = useLeads();
  const [ignored, setIgnored] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(m.doc(db, ...IGNORED_DOC), (s: any) => setIgnored(Array.isArray(s.data()?.keys) ? s.data().keys : []), console.error);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => unsub?.();
  }, []);

  const groups = useMemo(() => (leads ? clusters(leads).filter((g) => !ignored.includes(clusterKey(g))) : []), [leads, ignored]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!leads) return <Loader2 className="animate-spin text-gray-400 mx-auto my-10" />;

  const bestOf = (g: Lead[]) => [...g].sort((a, b) => richness(b) - richness(a))[0].id;

  const doMerge = async (g: Lead[]) => {
    const mainId = picked[clusterKey(g)] ?? bestOf(g);
    const main = g.find((l) => l.id === mainId)!;
    if (
      !window.confirm(
        `Fusionner ${g.length} fiches en une seule ?\n\nFiche gardée : ${main.name || main.id}\nLes ${g.length - 1} autre(s) iront à la corbeille pendant 30 jours (restaurables), après avoir transmis leurs informations, notes et documents.`,
      )
    )
      return;
    setBusy(clusterKey(g));
    try {
      await merge(g, mainId, email);
    } catch (e) {
      console.error(e);
      window.alert("La fusion a échoué, rien n'a été supprimé. Réessayez.");
    } finally {
      setBusy("");
    }
  };

  const ignore = async (g: Lead[]) => {
    const { m, db } = await crmFirestore();
    await m.setDoc(m.doc(db, ...IGNORED_DOC), { keys: [...ignored, clusterKey(g)] }, { merge: true });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-extrabold text-gray-900">👥 Doublons</h2>
      <p className="text-sm text-gray-500">
        Fiches avec le même téléphone ou le même e-mail. <b>Rien n'est fusionné sans votre clic.</b> Les fiches fusionnées vont à la corbeille 30 jours.
      </p>
      {groups.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">Aucun doublon détecté 🎉</p>}
      {groups.slice(0, 50).map((g) => {
        const key = clusterKey(g);
        const main = picked[key] ?? bestOf(g);
        return (
          <section key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            {g.map((l) => (
              <label key={l.id} className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer ${main === l.id ? "border-[#0073ea] bg-blue-50" : "border-gray-200"}`}>
                <input type="radio" name={key} checked={main === l.id} onChange={() => setPicked({ ...picked, [key]: l.id })} className="mt-1" />
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-semibold text-gray-900">
                    {l.name || "Sans nom"}{" "}
                    <span className="text-[11px] font-semibold text-white rounded px-1.5 py-0.5 align-middle" style={{ background: statusInfo(l.status).hex }}>
                      {statusInfo(l.status).label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{[formatPhone(l.phone), l.email, l.postalCode].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-gray-400">
                    {l.notes.length} note{l.notes.length > 1 ? "s" : ""} · {l.docCount} document{l.docCount > 1 ? "s" : ""} · créée le {l.createdAt.slice(0, 10)}
                    {l.source ? ` · ${l.source}` : ""}
                  </div>
                </div>
                <button type="button" onClick={(e) => (e.preventDefault(), onOpenLead(l.id))} className="text-xs font-semibold text-[#0073ea]">
                  Ouvrir
                </button>
              </label>
            ))}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => ignore(g)} className="text-sm px-3 py-1.5 rounded-md hover:bg-gray-100 text-gray-600">
                Ce ne sont pas des doublons
              </button>
              <button
                disabled={busy === key}
                onClick={() => doMerge(g)}
                className="text-sm font-semibold text-white bg-[#0073ea] hover:bg-[#0060c2] rounded-md px-4 py-1.5 disabled:opacity-50"
              >
                {busy === key ? "Fusion…" : "Fusionner (garder la fiche cochée)"}
              </button>
            </div>
          </section>
        );
      })}
      {groups.length > 50 && <p className="text-xs text-gray-400">Les 50 premiers groupes sont affichés ; les suivants apparaissent après traitement.</p>}
    </div>
  );
}
