import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Avatar from "@/components/Avatar";
import PhotoCropper from "@/components/PhotoCropper";
import { getEspaceProApp } from "@/lib/espacePro";
import { callTeam, type TeamMember } from "@/lib/crmTeam";

// Fenêtre « Modifier le profil » d'une personne de l'équipe : photo (recadrable),
// nom affiché, poste, téléphone, et réception des e-mails de mise à jour.
const input =
  "w-full text-sm bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f]";

export default function ProfileDialog({
  member,
  open,
  onClose,
}: {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [title, setTitle] = useState(member?.title ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [notify, setNotify] = useState(member?.notify !== false);
  const [photoUrl, setPhotoUrl] = useState(member?.photoUrl ?? "");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Une photo recadrée : envoyée dans le stockage, l'adresse est gardée jusqu'à « Enregistrer ».
  const uploadPhoto = async (blob: Blob) => {
    if (!member) return;
    setCropFile(null);
    setBusy(true);
    setError("");
    try {
      const app = await getEspaceProApp();
      const st = await import("firebase/storage");
      const safe = member.email.replace(/[^a-z0-9]/gi, "_");
      const ref = st.ref(st.getStorage(app), `crm/profiles/${safe}_${Date.now()}.jpg`);
      await st.uploadBytes(ref, blob, { contentType: "image/jpeg" });
      setPhotoUrl(await st.getDownloadURL(ref));
    } catch (e) {
      console.error(e);
      setError("L'envoi de la photo a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!member) return;
    setBusy(true);
    setError("");
    try {
      await callTeam({ action: "update-profile", email: member.email, name, title, phone, notify, photoUrl });
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!member) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white text-gray-900" dir="ltr">
        <DialogHeader>
          <DialogTitle>{cropFile ? "Recadrer la photo" : "Modifier le profil"}</DialogTitle>
          <DialogDescription>{member.email}</DialogDescription>
        </DialogHeader>

        {cropFile ? (
          <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={uploadPhoto} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={name || member.name} photoUrl={photoUrl} size={72} />
              <div className="space-y-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2b5a8f] border-2 border-[#2b5a8f] rounded-lg px-3 py-1.5"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {photoUrl ? "Changer la photo" : "Ajouter une photo"}
                </button>
                {photoUrl && (
                  <button onClick={() => setPhotoUrl("")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
                    <Trash2 size={12} /> Retirer la photo
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setCropFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Nom affiché</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Poste / rôle</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Commercial, Gérant, Assistante…" className={input} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={input} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Recevoir un e-mail à chaque mise à jour écrite sur une fiche
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={onClose} className="text-sm font-semibold text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 px-4 py-2 rounded-lg"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
