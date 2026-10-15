import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, File as FileIcon, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { crmFirestore } from "@/lib/crmDb";
import { getEspaceProApp } from "@/lib/espacePro";
import type { FileRef, Lead } from "@/lib/crm";
import type { LeadColumn } from "@/lib/crmColumns";

// Colonne « Fichiers » (comme Monday) : une cellule contient plusieurs fichiers (PDF, photos, documents),
// affichés en petites icônes (+N), ouverts d'un clic, et on peut en ajouter directement dans la cellule.
const safeName = (n: string) => n.replace(/[^\w.\- ()àâäçéèêëîïôöùûüÿ]/gi, "_").slice(0, 120);
const ext = (f: FileRef) => (f.ext || f.name.split(".").pop() || "").toLowerCase();
const kind = (f: FileRef) => {
  const e = ext(f);
  if (e === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg"].includes(e)) return "img";
  return "doc";
};
const Icon = ({ f, size = 22 }: { f: FileRef; size?: number }) => {
  const k = kind(f);
  const cls = k === "pdf" ? "bg-[#e2445c] text-white" : k === "img" ? "bg-[#579bfc] text-white" : "bg-[#6161ff] text-white";
  const I = k === "pdf" ? FileText : k === "img" ? ImageIcon : FileIcon;
  return (
    <span className={`inline-flex items-center justify-center rounded ${cls}`} style={{ width: size, height: size }} title={f.name}>
      <I size={Math.round(size * 0.6)} />
    </span>
  );
};
const fmtSize = (n?: number) => (n ? (n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1e3))} Ko`) : "");

export default function FileColCell({ lead, col }: { lead: Lead; col: LeadColumn }) {
  const files: FileRef[] = (lead.fileCols?.[col.key] ?? []) as FileRef[];
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[] | null) => {
    if (!list || !list.length) return;
    setErr("");
    try {
      const app = await getEspaceProApp();
      const st = await import("firebase/storage");
      const { m, db } = await crmFirestore();
      for (const file of Array.from(list)) {
        if (file.size > 100 * 1024 * 1024) {
          setErr(`« ${file.name} » dépasse 100 Mo.`);
          continue;
        }
        setBusy(file.name);
        const path = `crm/leads/${lead.id}/${col.key}/${Date.now()}_${safeName(file.name)}`;
        const ref = st.ref(st.getStorage(app), path);
        await st.uploadBytes(ref, file, { contentType: file.type || undefined });
        const meta = await st.getMetadata(ref);
        if (Number(meta.size) !== file.size) throw new Error("Fichier incomplet");
        const url = await st.getDownloadURL(ref);
        const entry: FileRef = { id: `u${Date.now().toString(36)}`, name: file.name, url, path, size: file.size, ext: (file.name.split(".").pop() || "").toLowerCase() };
        await m.updateDoc(m.doc(db, "crm_leads", lead.id), {
          [`fileCols.${col.key}`]: m.arrayUnion(entry),
          updatedAt: m.serverTimestamp(),
        });
      }
    } catch (e) {
      console.error(e);
      setErr("Échec de l'envoi : rien n'a été perdu, réessayez.");
    } finally {
      setBusy("");
    }
  };

  // Retire seulement le lien de la cellule : le fichier lui-même reste dans le stockage.
  const unlink = async (f: FileRef) => {
    if (!confirm(`Retirer « ${f.name} » de cette cellule ? Le fichier reste conservé dans le stockage du CRM.`)) return;
    const { m, db } = await crmFirestore();
    await m.updateDoc(m.doc(db, "crm_leads", lead.id), { [`fileCols.${col.key}`]: m.arrayRemove(f), updatedAt: m.serverTimestamp() });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full h-full px-2 flex items-center gap-1 hover:bg-gray-100 overflow-hidden" title={files.length ? `${files.length} fichier(s)` : "Ajouter des fichiers"}>
          {files.length === 0 && <Plus size={14} className="text-gray-300" />}
          {files.slice(0, 3).map((f) => (
            <Icon key={f.id} f={f} />
          ))}
          {files.length > 3 && <span className="text-[11px] font-semibold text-gray-500 ml-0.5">+{files.length - 3}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2 bg-white text-gray-900 border border-gray-200 shadow-xl">
        <p className="text-xs font-bold text-gray-500 px-1 pb-1">{col.title} · {lead.name}</p>
        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
          {files.length === 0 && <li className="text-xs text-gray-400 py-2 px-1">Aucun fichier.</li>}
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5 px-1">
              <Icon f={f} />
              <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm text-gray-800 hover:text-[#0073ea] truncate" title={f.name}>
                {f.name}
              </a>
              <span className="text-[10px] text-gray-400">{fmtSize(f.size)}</span>
              <a href={f.url} target="_blank" rel="noreferrer" aria-label="Ouvrir" className="text-gray-400 hover:text-[#0073ea]">
                <ExternalLink size={14} />
              </a>
              <button onClick={() => unlink(f).catch(() => setErr("Impossible de retirer ce fichier."))} aria-label="Retirer" className="text-gray-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        {err && <p className="text-xs text-red-600 px-1 pt-1">{err}</p>}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
          className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-2 text-center"
        >
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          <button onClick={() => input.current?.click()} disabled={!!busy} className="text-sm font-bold text-[#0073ea] disabled:opacity-60">
            {busy ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Envoi de {busy.slice(0, 24)}…</span>
            ) : (
              "+ Ajouter des fichiers"
            )}
          </button>
          <p className="text-[11px] text-gray-400">ou glissez-les ici (100 Mo maximum chacun)</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
