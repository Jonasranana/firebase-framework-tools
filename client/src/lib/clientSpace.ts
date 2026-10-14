// ─────────────────────────────────────────────────────────────────────────
// Espace client : ce que le client verra de son dossier. Seules des informations
// sûres sont exposées (jamais les notes internes, ni les autres clients).
// La même logique existe côté serveur (functions/clientSpace.js) : si tu modifies
// les étapes ici, modifie aussi l'autre fichier.
// ─────────────────────────────────────────────────────────────────────────
export type ClientStageState = "done" | "current" | "todo";
export type ClientStage = { key: string; label: string; text: string; state: ClientStageState; date?: string };
export type ClientView = {
  prenom: string;
  stages: ClientStage[];
  currentIndex: number;
  nextStep: string;
  pieces: { label: string; ok: boolean }[];
  conseiller: string;
};

const STAGES = [
  { key: "etude", label: "Étude de votre projet", text: "Nous étudions votre situation et vérifions votre éligibilité aux aides." },
  { key: "dossier", label: "Constitution du dossier", text: "Nous rassemblons vos pièces et préparons vos demandes MaPrimeRénov' et CEE." },
  { key: "visite", label: "Visite technique", text: "Un professionnel vient étudier votre logement et valide la pompe à chaleur adaptée." },
  { key: "pose", label: "Installation", text: "Votre pompe à chaleur est posée par un artisan certifié RGE." },
  { key: "termine", label: "Mise en service", text: "Votre installation est terminée. Nous restons à votre disposition." },
];

const NEXT = [
  "Un conseiller vous contacte pour confirmer votre éligibilité.",
  "Merci de nous transmettre les pièces manquantes pour avancer.",
  "Nous fixons ensemble la date de la visite technique.",
  "Votre installation est planifiée : nous vous confirmons le déroulé.",
  "Votre dossier est terminé. Merci de votre confiance !",
];

const REQUIRED = ["Avis d'imposition", "Pièce d'identité", "Facture énergie"];

type LeadLike = { name: string; fields: Record<string, string>; docCats?: string[] };

export function buildClientView(lead: LeadLike): ClientView {
  const f = lead.fields ?? {};
  const pipe = String(f.pipeline ?? "");
  const cats = lead.docCats ?? [];
  let idx = 0;
  if (cats.length) idx = 1;
  if (pipe === "Docs demandés" || pipe === "Docs reçus") idx = 1;
  if (pipe === "Attente conf. VT" || pipe === "VT programmée") idx = 2;
  if (pipe === "Pose programmée") idx = 3;
  if (pipe === "Installé") idx = 4;
  const stages: ClientStage[] = STAGES.map((s, i) => ({
    ...s,
    state: i < idx ? "done" : i === idx ? "current" : "todo",
    date: i === 2 ? f.dateVt || undefined : i === 3 ? f.datePose || undefined : undefined,
  }));
  const prenom = String(lead.name ?? "").trim().split(/\s+/)[0] ?? "";
  return {
    prenom,
    stages,
    currentIndex: idx,
    nextStep: NEXT[idx],
    pieces: REQUIRED.map((label) => ({ label, ok: cats.includes(label) })),
    conseiller: String(f.commercial ?? "").trim(),
  };
}
