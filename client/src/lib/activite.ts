// ─────────────────────────────────────────────────────────────────────────
// Activité de l'équipe (lue seulement par Jonas, page « Activité de l'équipe ») :
// chaque connexion au CRM, et chaque minute passée dessus (onglet visible),
// avec la page affichée. Un document par personne et par jour :
//   crm_activite/<AAAA-MM-JJ>_<email> { email, jour, connexions, ordi, tel, minutes, pages: { page: minutes }, derniere }
// Rien n'est affiché à l'écran ; ne bloque jamais le CRM.
// ─────────────────────────────────────────────────────────────────────────
import { crmFirestore } from "@/lib/crmDb";

let pageActuelle = "leads";
let email = "";

export const activitePage = (p: string) => {
  pageActuelle = String(p || "autre").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "autre";
};

const jour = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function maj(donnees: (m: typeof import("firebase/firestore")) => Record<string, unknown>) {
  try {
    const { m, db } = await crmFirestore();
    const j = jour();
    await m.setDoc(m.doc(db, "crm_activite", `${j}_${email.replace(/[^a-z0-9]/g, "_")}`), { email, jour: j, derniere: m.serverTimestamp(), ...donnees(m) }, { merge: true });
  } catch {
    /* jamais bloquant */
  }
}

export function demarrerActivite(e: string) {
  if (email || !e) return;
  email = e.toLowerCase();
  const mobile = typeof matchMedia !== "undefined" && matchMedia("(max-width: 767px)").matches;
  maj((m) => ({ connexions: m.increment(1), [mobile ? "tel" : "ordi"]: m.increment(1) }));
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const p = pageActuelle;
    maj((m) => ({ minutes: m.increment(1), pages: { [p]: m.increment(1) } }));
  }, 60_000);
}
