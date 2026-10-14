import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";

// Bandeau « santé des données » : dernière sauvegarde de la nuit et dernière vérification
// des documents (écrits chaque nuit par .github/workflows/sauvegarde-crm.yml).
type Backup = { lastBackup?: any; documents?: number; day?: string };
type Check = { at?: any; documents?: number; filesInStorage?: number; missingFiles?: number; orphanFiles?: number; ok?: boolean };

const when = (t: any) => {
  try {
    const d: Date = t?.toDate ? t.toDate() : new Date(t);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function DataHealth() {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsubs.push(m.onSnapshot(m.doc(db, "crm_boards", "backup_status"), (s: any) => setBackup(s.data() ?? null), () => {}));
        unsubs.push(m.onSnapshot(m.doc(db, "crm_boards", "integrity"), (s: any) => setCheck(s.data() ?? null), () => {}));
      } catch {
        /* non essentiel */
      }
    })();
    return () => unsubs.forEach((u) => u());
  }, []);

  const recent = (t: any) => {
    try {
      const d: Date = t?.toDate ? t.toDate() : new Date(t);
      return Date.now() - d.getTime() < 36 * 3600 * 1000;
    } catch {
      return false;
    }
  };
  const good = !!backup?.lastBackup && recent(backup.lastBackup) && !!check && check.ok !== false;
  const nothing = !backup && !check;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 mb-4 ${good ? "bg-green-50 border-green-200" : nothing ? "bg-gray-50 border-gray-200" : "bg-amber-50 border-amber-300"}`}
    >
      {good ? <ShieldCheck className="text-green-600 shrink-0" size={22} /> : <ShieldAlert className={nothing ? "text-gray-400 shrink-0" : "text-amber-600 shrink-0"} size={22} />}
      <div className="text-sm text-gray-800">
        <div className="font-bold">{good ? "Données protégées" : nothing ? "Sauvegarde automatique : pas encore lancée" : "Attention : sauvegarde ou vérification à contrôler"}</div>
        <div className="text-xs text-gray-600 mt-0.5 space-y-0.5">
          <div>
            Dernière sauvegarde : {backup?.lastBackup ? `${when(backup.lastBackup)} (${backup.documents ?? 0} éléments, 30 jours conservés)` : "—"}
          </div>
          <div>
            Dernière vérification : {check?.at ? `${when(check.at)} — ${check.filesInStorage ?? 0} fichiers, ${check.missingFiles ?? 0} manquant${(check.missingFiles ?? 0) > 1 ? "s" : ""}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
