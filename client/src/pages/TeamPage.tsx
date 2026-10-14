import { useState } from "react";
import { BellOff, Loader2, Pencil, Phone, Trash2, UserPlus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { callTeam, isRootAdmin, useTeam, type TeamMember } from "@/lib/crmTeam";
import ProfileDialog from "./ProfileDialog";

// Page « Équipe » : qui a accès au CRM, avec la fiche de chaque personne
// (photo, poste, téléphone, e-mails de mise à jour). Chacun modifie son
// propre profil ; les trois administrateurs modifient tous les profils,
// ajoutent et retirent des personnes (e-mail Google).
export default function TeamPage({ email }: { email: string }) {
  const members = useTeam();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null);
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

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Les personnes ci-dessous peuvent se connecter à ce CRM avec leur compte Google.
        {!admin && " Vous pouvez modifier votre profil ; seuls les administrateurs ajoutent ou retirent quelqu'un."}
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!members && (
        <div className="py-8 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto" size={22} />
        </div>
      )}

      {members && (
        <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 mb-6">
          {members.map((m) => {
            const canEdit = admin || m.email === email.toLowerCase();
            return (
              <li key={m.email} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} photoUrl={m.photoUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">
                    {m.name}
                    {m.email === email.toLowerCase() && <span className="ml-1.5 text-[11px] font-semibold text-gray-400">(vous)</span>}
                  </p>
                  {m.title && <p className="text-xs text-gray-600 truncate">{m.title}</p>}
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
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
                <span
                  className={`hidden sm:inline text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    m.root ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {m.root ? "Administrateur" : "Membre"}
                </span>
                {canEdit && (
                  <button
                    onClick={() => setEditing(m)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2b5a8f] border border-[#2b5a8f]/40 rounded-lg px-2.5 py-1.5 hover:bg-blue-50"
                  >
                    <Pencil size={12} /> Modifier
                  </button>
                )}
                {admin && !m.root && (
                  <button
                    disabled={busy}
                    onClick={() => confirm(`Retirer l'accès de ${m.name} ?`) && run({ action: "remove", email: m.email })}
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
      )}

      {admin && (
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
            La personne se connecte ensuite sur ip5energie.fr/admin avec ce compte Google. Elle recevra aussi les
            e-mails de mise à jour des fiches.
          </p>
        </div>
      )}

      {editing && <ProfileDialog key={editing.email} member={editing} open onClose={() => setEditing(null)} />}
    </div>
  );
}
