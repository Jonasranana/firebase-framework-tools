import { useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { getEspaceProApp } from "@/lib/espacePro";
import { initials, isRootAdmin, type TeamMember } from "@/lib/crmTeam";

// Page « Équipe » : qui a accès au CRM. Les trois administrateurs d'origine
// peuvent ajouter ou retirer des personnes (e-mail Google). Une personne
// ajoutée se connecte ensuite avec son compte Google sur /admin.
async function callTeam(data: Record<string, unknown>): Promise<TeamMember[]> {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const r = await httpsCallable(getFunctions(app, "europe-west9"), "manageTeam")(data);
  return (r.data as { members: TeamMember[] }).members;
}

export default function TeamPage({ email }: { email: string }) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const admin = isRootAdmin(email);

  useEffect(() => {
    callTeam({ action: "list" })
      .then(setMembers)
      .catch((e) => {
        console.error(e);
        setError("Impossible de charger l'équipe (fonction non déployée ?).");
      });
  }, []);

  const run = async (data: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      setMembers(await callTeam(data));
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
        {!admin && " Seuls les administrateurs peuvent ajouter ou retirer quelqu'un."}
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!members && !error && (
        <div className="py-8 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto" size={22} />
        </div>
      )}

      {members && (
        <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 mb-6">
          {members.map((m) => (
            <li key={m.email} className="flex items-center gap-3 px-4 py-3">
              <span className="w-9 h-9 rounded-full bg-[#2b5a8f] text-white text-sm font-bold flex items-center justify-center shrink-0">
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 truncate">{m.name}</p>
                <p className="text-xs text-gray-500 truncate">{m.email}</p>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  m.root ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {m.root ? "Administrateur" : "Membre"}
              </span>
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
          ))}
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
    </div>
  );
}
