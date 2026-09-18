import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Search,
  Plus,
  Loader2,
  X,
  Building2,
  ChevronRight,
  FolderOpen,
  CheckCircle2,
  Clock,
  Check,
  Lock,
  Copy,
  Download,
  Send,
  Upload,
  Trash2,
  Ban,
  FileText,
  Camera,
  Pencil,
} from "lucide-react";
import { LogoIP5 } from "./site-chrome";
import { LOGO_FULL_D, LOGO_FULL_VIEWBOX } from "./ip5-logo";
import { getEspaceProApp } from "@/lib/espacePro";
import { useBrowserBackLevel } from "@/hooks/use-browser-back-level";

// ─────────────────────────────────────────────────────────────────────────
// CRM "Station de gonflage" — suivi des dossiers CEE (fiche TRA-SE-104),
// du questionnaire d'éligibilité jusqu'au paiement de la prime.
//
// Barème officiel (kWh cumac / station / an) :
//   Type A (autoroute, aire de repos)         534 200
//   Type B (zone urbaine, parking public)     148 400
//   Type C (parking privé d'entreprise)        39 600
// Taux de conversion en € : 0,0073 €/kWh cumac (à confirmer/ajuster).
//
// Stocké dans Firestore (collection gonflage_dossiers, protégée comme
// crm_clients — auth Google + liste blanche). La page de signature
// publique (GonflageSignature.tsx) lit/écrit une collection séparée,
// gonflage_signatures/{token}, qui ne contient que le strict nécessaire
// à l'affichage du document à signer — jamais le dossier complet.
// ─────────────────────────────────────────────────────────────────────────

export const CUMAC_PAR_TYPE = { A: 534200, B: 148400, C: 39600 } as const;
export const TARIF_EUR_PAR_KWH_CUMAC = 0.0073; // à confirmer

const ETAPES = [
  { key: "1", label: "Questionnaire d'éligibilité", desc: "Le commercial qualifie le bénéficiaire", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { key: "2", label: "Envoi du pré-devis", desc: "Génération du PDF et envoi du lien de signature", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "3", label: "Attente de signature", desc: "Validation automatique à la signature du client", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "4", label: "Devis CEE à signer", desc: "Contrat d'entretien établi et signé côté client", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { key: "5", label: "Planification installation", desc: "Date, créneau et logistique matériel", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "6", label: "Installation faite", desc: "Pose réalisée sur le terrain", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { key: "7", label: "Documents de fin de chantier", desc: "PV et attestations signés", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "8", label: "Dépôt des documents", desc: "Pièces du dossier déposées et catégorisées", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { key: "9", label: "Dépôt délégataire", desc: "Dossier transmis au délégataire", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { key: "10", label: "Paiement", desc: "Prime versée par le délégataire", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
] as const;

type EtapeKey = (typeof ETAPES)[number]["key"] | "annule";
const stepIndex = (k: EtapeKey) => (k === "annule" ? -1 : Number(k));

const etapeMeta = (key: string) => ETAPES.find((e) => e.key === key);

type Dossier = {
  id: string;
  raisonSociale: string;
  siren: string;
  nomContact: string;
  email: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  adresseTravauxDifferente: boolean;
  adresseTravaux: string;
  codePostalTravaux: string;
  villeTravaux: string;
  reference: string;
  etape: EtapeKey;
  createdAt: string;
  createdBy: string;
  // Étape 1
  typeStation?: "A" | "B" | "C";
  espaceManoeuvre?: boolean;
  conditionAcces?: boolean;
  arriveeElectrique?: boolean;
  // Étape 2
  kwhCumac?: number;
  primeCEE?: number;
  preDevisToken?: string;
  // Étape 4
  contratToken?: string;
  // Étape 5
  dateInstallation?: string;
  creneauInstallation?: string;
  materiel?: string;
  // Étape 9 / 10
  referenceDelegataire?: string;
  datePaiement?: string;
  montantPaiement?: string;
};

const emptyForm = {
  siren: "",
  raisonSociale: "",
  nomContact: "",
  email: "",
  telephone: "",
  adresse: "",
  codePostal: "",
  ville: "",
  adresseTravauxDifferente: false,
  adresseTravaux: "",
  codePostalTravaux: "",
  villeTravaux: "",
};

// ── Recherche SIREN — annuaire public des entreprises (INSEE / api.gouv.fr,
// gratuit, sans clé). ────────────────────────────────────────────────────
async function rechercheSiren(query: string) {
  const res = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=1`,
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;
  const siege = r.siege ?? {};
  return {
    raisonSociale: r.nom_raison_sociale ?? r.nom_complet ?? "",
    siren: r.siren ?? "",
    adresse:
      siege.adresse ??
      [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(" "),
    codePostal: siege.code_postal ?? "",
    ville: siege.libelle_commune ?? "",
  };
}

// ── Logo IP5 rendu en PNG (pour l'insérer dans les PDF générés) ─────────
async function logoDataUrl(color: string, width: number) {
  const [, , vbW, vbH] = LOGO_FULL_VIEWBOX.split(" ").map(Number);
  const scale = width / vbW;
  const height = vbH * scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(LOGO_FULL_D), "evenodd");
  return canvas.toDataURL("image/png");
}

const genToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// ── Génération PDF (pré-devis / attestation / contrat) ──────────────────
// toLocaleString("fr-FR") sépare les milliers par une espace fine
// insécable (U+202F), absente de la police Helvetica standard utilisée
// par jsPDF : elle s'affichait comme un caractère parasite ("/") dans le
// PDF. On la remplace par une espace normale, propre dans cette police.
function pdfNumber(n: number, opts?: Intl.NumberFormatOptions) {
  return n.toLocaleString("fr-FR", opts).replace(/[  ]/g, " ");
}

export type DocumentData = {
  reference: string;
  typeStation?: "A" | "B" | "C";
  raisonSociale: string;
  siren: string;
  adresse: string;
  codePostal: string;
  ville: string;
  nomContact: string;
  telephone: string;
  primeCEE?: number;
  kwhCumac?: number;
};

function drawDocumentPage(
  doc: any,
  kind: "predevis" | "attestation" | "contrat",
  d: DocumentData,
  signature: { nom: string; dataUrl: string; date: string } | undefined,
  logo: string,
) {
  const logoW = 32;
  const logoH = (387 / 865) * logoW;

  const titres: Record<typeof kind, { t: string; s: string }> = {
    predevis: {
      t: `Pré-devis CEE${signature ? " signé" : ""} — Station de gonflage des pneumatiques`,
      s: `Opération standardisée CEE TRA-SE-104 — réf. ${d.reference || "—"}`,
    },
    attestation: {
      t: "ATTESTATION D'ENGAGEMENT",
      s: `Station de gonflage ouverte à tout public et gratuite — catégorie ${d.typeStation ?? ""}`,
    },
    contrat: {
      t: `Contrat d'entretien${signature ? " signé" : ""} — Station de gonflage des pneumatiques`,
      s: `Preuve de réalisation — opération CEE TRA-SE-104 — réf. ${d.reference || "—"}`,
    },
  };
  const { t: titre, s: sousTitre } = titres[kind];

  // En-tête
  doc.setFillColor(15, 43, 74);
  doc.rect(0, 0, 210, 32, "F");
  doc.addImage(logo, "PNG", 15, 6, logoW, logoH);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(titre, 15, 24, { maxWidth: 180 });
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 240);
  doc.text(sousTitre, 15, 29);

  doc.setTextColor(20, 20, 20);
  let y = 44;

  // L'attestation identifie le signataire comme représentant légal, sur
  // une seule ligne d'adresse ; le pré-devis/contrat garde contact + tél.
  // sur deux lignes séparées (adresse, puis code postal/ville).
  const beneficiaire =
    kind === "attestation"
      ? [
          d.raisonSociale,
          `SIREN : ${d.siren}`,
          `${d.adresse} ${d.codePostal} ${d.ville}`.trim(),
          d.nomContact ? `Représentant légal : ${d.nomContact}` : "",
        ].filter(Boolean)
      : [
          d.raisonSociale,
          `SIREN : ${d.siren}`,
          d.adresse,
          `${d.codePostal} ${d.ville}`,
          d.nomContact ? `Contact : ${d.nomContact}` : "",
          d.telephone ? `Tél. : ${d.telephone}` : "",
        ].filter(Boolean);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(kind === "attestation" ? "Le bénéficiaire" : "Bénéficiaire", 15, y);
  if (kind === "predevis") {
    doc.text(`Référence dossier : ${d.reference || "—"}`, 195, y, { align: "right" });
  }
  doc.setFont("helvetica", "normal");
  if (kind === "predevis" && d.typeStation) {
    doc.text(`Station type ${d.typeStation}`, 195, y + 6, { align: "right" });
  }
  y += 6;
  for (const line of beneficiaire) {
    doc.text(line, 15, y);
    y += 5;
  }

  if (kind === "predevis") {
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, 195, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Prestation", 15, y);
    doc.text("Montant", 180, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;
    const rows: [string, string][] = [
      ["Station de gonflage des pneumatiques", "Offerte"],
      ["Pose et installation", "Offerte"],
      [
        "Contrat d'entretien de la station de gonflage",
        `${pdfNumber(d.primeCEE ?? 0, { minimumFractionDigits: 2 })} €`,
      ],
      [
        "Déduction Prime CEE — opération TRA-SE-104",
        `- ${pdfNumber(d.primeCEE ?? 0, { minimumFractionDigits: 2 })} €`,
      ],
    ];
    for (const [k, v] of rows) {
      doc.text(k, 15, y);
      doc.text(v, 180, y, { align: "right" });
      y += 6;
    }
    y += 2;
    doc.setFillColor(15, 43, 74);
    doc.rect(15, y - 5, 180, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("RESTE À PAYER", 18, y + 1);
    doc.text("0,00 €", 177, y + 1, { align: "right" });
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    y += 12;
    doc.setFontSize(9);
    doc.text(
      `Volume CEE valorisé : ${pdfNumber(d.kwhCumac ?? 0)} kWh cumac (${pdfNumber((d.kwhCumac ?? 0) / 1000)} MWh cumac).`,
      15,
      y,
    );
    y += 5;
    doc.text("La station est ouverte au public : tout usager peut venir gonfler ses pneus gratuitement.", 15, y, { maxWidth: 180 });
    y += 10;
  }

  if (kind === "attestation" || kind === "contrat") {
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const intro =
      kind === "attestation"
        ? `Je soussigné(e) ${signature?.nom ?? "___________________"}, représentant légal de ${d.raisonSociale}, atteste que l'installation de la station de gonflage des pneumatiques répond aux conditions de la catégorie ${d.typeStation ?? ""} de l'opération TRA-SE-104 et m'engage sur les points suivants :`
        : "Le présent contrat a pour objet l'entretien de la station de gonflage des pneumatiques installée gratuitement par IP5 Énergie au titre de l'opération CEE TRA-SE-104, dans les conditions suivantes :";
    y = writeParagraph(doc, intro, 15, y, 180);
    y += 3;
    const points = [
      "Espace de manœuvre : le bénéficiaire dispose d'un espace permettant à un véhicule de se garer et de stationner en sécurité le temps du gonflage de ses pneumatiques.",
      "Accès à tout public : la station de gonflage est librement accessible à tout usager, y compris aux personnes qui ne sont pas clientes de l'établissement.",
      "Gratuité : le gonflage des pneumatiques est entièrement gratuit ; aucun paiement, aucune contrepartie ni aucune obligation d'achat n'est demandé aux usagers.",
      "Maintien dans le temps : le remplacement des organes défectueux est garanti dans un délai maximal de 15 jours, conformément au cahier des charges TNPF.",
    ];
    for (const p of points) {
      doc.text("•", 15, y);
      y = writeParagraph(doc, p, 20, y, 175) + 2;
    }
    y += 3;
    doc.text(
      "Le non-respect de ces engagements peut entraîner l'annulation de la valorisation CEE du dossier et la restitution de la prime correspondante.",
      15,
      y,
      { maxWidth: 180 },
    );
    y += 12;
  }

  if (signature) {
    doc.setFont("helvetica", "bold");
    doc.text("Signature du bénéficiaire", 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`Signé le ${signature.date} par ${signature.nom}`, 15, y);
    y += 4;
    doc.addImage(signature.dataUrl, "PNG", 15, y, 50, 25);
  }
}

export async function buildDocumentPdf(
  kind: "predevis" | "attestation" | "contrat",
  d: DocumentData,
  signature?: { nom: string; dataUrl: string; date: string },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await logoDataUrl("#ffffff", 400);
  drawDocumentPage(doc, kind, d, signature, logo);
  return doc;
}

// Pré-devis + attestation d'engagement réunis dans un seul PDF de 2 pages
// (le client ne signe qu'une fois, mais s'engage sur les deux documents).
export async function buildPredevisCompletPdf(
  d: DocumentData,
  signature?: { nom: string; dataUrl: string; date: string },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await logoDataUrl("#ffffff", 400);
  drawDocumentPage(doc, "predevis", d, signature, logo);
  doc.addPage();
  drawDocumentPage(doc, "attestation", d, signature, logo);
  return doc;
}

function writeParagraph(doc: any, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

// ── Pad de signature (canvas) ────────────────────────────────────────────
export const SignaturePad = ({ onChange }: { onChange: (dataUrl: string | null) => void }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const empty = useRef(true);

  const pos = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f2937";
    ctx.lineTo(x, y);
    ctx.stroke();
    empty.current = false;
  };
  const end = () => {
    drawing.current = false;
    onChange(empty.current ? null : ref.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    empty.current = true;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={500}
        height={160}
        className="w-full h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs font-bold text-gray-400 hover:text-gray-600"
      >
        Effacer
      </button>
    </div>
  );
};

// ── Formulaire "Nouveau dossier" ────────────────────────────────────────
const NewDossierModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [form, setForm] = useState(emptyForm);
  const [sirenQuery, setSirenQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof emptyForm, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const searchSiren = async () => {
    if (!sirenQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const r = await rechercheSiren(sirenQuery.trim());
      if (!r) {
        setSearchError("Aucune entreprise trouvée pour cette recherche.");
        return;
      }
      setForm((f) => ({
        ...f,
        raisonSociale: r.raisonSociale || f.raisonSociale,
        siren: r.siren || f.siren,
        adresse: r.adresse || f.adresse,
        codePostal: r.codePostal || f.codePostal,
        ville: r.ville || f.ville,
      }));
    } catch (e) {
      console.error(e);
      setSearchError("Recherche impossible pour le moment. Réessayez ou remplissez à la main.");
    } finally {
      setSearching(false);
    }
  };

  const canSubmit = form.raisonSociale.trim() && form.siren.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      const { getAuth } = await import("firebase/auth");
      const db = getFirestore(app);
      const auth = getAuth(app);
      await addDoc(collection(db, "gonflage_dossiers"), {
        ...form,
        reference: "",
        etape: "1",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email ?? "",
      });
      onCreated();
    } catch (e) {
      console.error(e);
      alert("Échec de la création du dossier. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Nouveau dossier" subtitle="Étape 1 du pipeline : identifier le client bénéficiaire.">
      <div className="p-6 space-y-5">
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
            <Building2 size={15} /> Auto-remplissage depuis le SIREN
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Données issues de l'annuaire public des entreprises (INSEE / API gratuite).
          </p>
          <div className="flex gap-2">
            <input
              value={sirenQuery}
              onChange={(e) => setSirenQuery(e.target.value)}
              placeholder="SIREN ou raison sociale…"
              className="flex-1 text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
            />
            <button
              onClick={searchSiren}
              disabled={searching}
              className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50"
            >
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Rechercher
            </button>
          </div>
          {searchError && <p className="text-xs text-red-600 mt-2">{searchError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Raison sociale *" value={form.raisonSociale} onChange={(v) => set("raisonSociale", v)} full />
          <Field label="SIREN *" value={form.siren} onChange={(v) => set("siren", v)} />
          <Field label="Nom du contact" value={form.nomContact} onChange={(v) => set("nomContact", v)} />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
          <Field label="Téléphone" value={form.telephone} onChange={(v) => set("telephone", v)} />
          <Field label="Adresse" value={form.adresse} onChange={(v) => set("adresse", v)} full />
          <Field label="Code postal" value={form.codePostal} onChange={(v) => set("codePostal", v)} />
          <Field label="Ville" value={form.ville} onChange={(v) => set("ville", v)} />
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={form.adresseTravauxDifferente}
            onChange={(e) => set("adresseTravauxDifferente", e.target.checked)}
            className="w-4 h-4 accent-[#2b5a8f]"
          />
          Adresse des travaux différente
        </label>

        {form.adresseTravauxDifferente && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adresse des travaux" value={form.adresseTravaux} onChange={(v) => set("adresseTravaux", v)} full />
            <Field label="Code postal" value={form.codePostalTravaux} onChange={(v) => set("codePostalTravaux", v)} />
            <Field label="Ville" value={form.villeTravaux} onChange={(v) => set("villeTravaux", v)} />
          </div>
        )}
      </div>

      <ModalFooter>
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-500 rounded-xl hover:bg-gray-50">
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Créer le dossier
        </button>
      </ModalFooter>
    </Modal>
  );
};

const Modal = ({
  onClose,
  title,
  subtitle,
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <div dir="ltr" className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
    <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-2">
    {children}
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  full?: boolean;
}) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
    />
  </label>
);

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3 cursor-pointer">
    <span className="text-sm font-semibold text-gray-700">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#2b5a8f]/40 focus-visible:ring-offset-2 ${checked ? "bg-[#2b5a8f]" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  </label>
);

// ── Détail d'un dossier — parcours en cartes ────────────────────────────
const DossierDetail = ({
  dossier: initial,
  onClose,
  onUpdated,
  onDeleted,
}: {
  dossier: Dossier;
  onClose: () => void;
  onUpdated: (patch: Partial<Dossier>) => void;
  onDeleted: () => void;
}) => {
  const [d, setD] = useState(initial);
  const [activeStep, setActiveStep] = useState<string>(
    d.etape === "annule" ? "1" : d.etape,
  );
  const [deleting, setDeleting] = useState(false);

  const patch = async (fields: Partial<Dossier>) => {
    setD((prev) => ({ ...prev, ...fields }));
    onUpdated(fields);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
      const db = getFirestore(app);
      await updateDoc(doc(db, "gonflage_dossiers", d.id), fields as any);
    } catch (e) {
      console.error(e);
      alert("Échec de l'enregistrement. Réessayez.");
    }
  };

  const advance = (next: EtapeKey) => {
    patch({ etape: next });
    if (next !== "annule") setActiveStep(next);
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement le dossier "${d.raisonSociale}" ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
      const db = getFirestore(app);
      await deleteDoc(doc(db, "gonflage_dossiers", d.id));
      if (d.preDevisToken) await deleteDoc(doc(db, "gonflage_signatures", d.preDevisToken)).catch(() => {});
      if (d.contratToken) await deleteDoc(doc(db, "gonflage_signatures", d.contratToken)).catch(() => {});
      onDeleted();
    } catch (e) {
      console.error(e);
      alert("Échec de la suppression. Réessayez.");
      setDeleting(false);
    }
  };

  const currentIdx = stepIndex(d.etape);

  return (
    <div dir="ltr" className="fixed inset-0 z-30 bg-black/40 overflow-y-auto py-4 sm:py-8">
      <div className="bg-white max-w-4xl mx-auto rounded-3xl overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 mb-1">
              <ArrowLeft size={13} /> Dossiers
            </button>
            <h2 className="text-lg font-bold text-gray-900">{d.raisonSociale}</h2>
            <p className="text-xs text-gray-400">
              SIREN {d.siren} — {d.ville}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {d.etape !== "annule" && (
              <span className="text-xs font-bold text-gray-500">
                Étape {currentIdx} / 10 — {etapeMeta(d.etape)?.label}
              </span>
            )}
            <button
              onClick={() => {
                if (confirm("Marquer ce dossier comme annulé / pas intéressé ?")) advance("annule");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-full"
            >
              <Ban size={13} /> Annulé / Pas intéressé
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 px-3 py-2 rounded-full disabled:opacity-50"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Supprimer
            </button>
          </div>
        </div>

        {d.etape === "annule" && (
          <div className="mx-6 mt-4 bg-gray-100 text-gray-600 text-sm font-semibold rounded-2xl px-4 py-3">
            Ce dossier a été marqué comme annulé / pas intéressé.
          </div>
        )}

        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
            {ETAPES.map((e) => {
              const idx = Number(e.key);
              const done = idx < currentIdx || (idx === currentIdx && false);
              const isDone = idx < currentIdx;
              const isCurrent = e.key === activeStep && d.etape !== "annule";
              const locked = idx > currentIdx;
              return (
                <button
                  key={e.key}
                  disabled={locked}
                  onClick={() => setActiveStep(e.key)}
                  className={`text-left rounded-2xl border-2 p-3 transition-colors ${
                    isCurrent
                      ? "border-amber-300 bg-amber-50"
                      : isDone
                        ? "border-green-200 bg-green-50"
                        : locked
                          ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                          : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isDone ? (
                      <CheckCircle2 size={15} className="text-green-600" />
                    ) : locked ? (
                      <Lock size={13} className="text-gray-400" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center">
                        {e.key}
                      </span>
                    )}
                    <span className="text-xs font-bold text-gray-800 leading-tight">{e.key}. {e.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug">{e.desc}</p>
                  {isCurrent && (
                    <p className="text-[10px] font-bold text-amber-600 mt-1">Étape en cours</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-[1fr,280px] gap-4">
            <div className="bg-gray-50 rounded-3xl p-5">
              <StepContent
                dossier={d}
                stepKey={activeStep}
                onPatch={patch}
                onAdvance={advance}
              />
            </div>

            <div className="space-y-4">
              <BeneficiaireCard dossier={d} onPatch={patch} />
              <div className="bg-white rounded-3xl border border-gray-100 p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Historique</p>
                <p className="text-xs text-gray-600">
                  <span className="font-bold">Dossier créé</span>
                  <br />
                  {d.createdBy} — {formatDateTime(d.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatDateTime(iso: string) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleString("fr-FR");
}

// Firestore renvoie un objet Timestamp (pas une string) pour les champs
// écrits avec serverTimestamp() — on le convertit ici pour que le reste
// du code (typé en string, affiché tel quel) ne plante pas au rendu.
function tsToIso(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

const beneficiaireFormFromDossier = (d: Dossier) => ({
  raisonSociale: d.raisonSociale,
  siren: d.siren,
  nomContact: d.nomContact,
  email: d.email,
  telephone: d.telephone,
  adresse: d.adresse,
  codePostal: d.codePostal,
  ville: d.ville,
  adresseTravauxDifferente: d.adresseTravauxDifferente,
  adresseTravaux: d.adresseTravaux,
  codePostalTravaux: d.codePostalTravaux,
  villeTravaux: d.villeTravaux,
});

const BeneficiaireCard = ({
  dossier: d,
  onPatch,
}: {
  dossier: Dossier;
  onPatch: (f: Partial<Dossier>) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(beneficiaireFormFromDossier(d));

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const startEditing = () => {
    setForm(beneficiaireFormFromDossier(d));
    setEditing(true);
  };

  const save = () => {
    onPatch(form);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-900">Bénéficiaire</p>
        <button
          onClick={() => (editing ? setEditing(false) : startEditing())}
          className="text-gray-400 hover:text-[#2b5a8f]"
          aria-label="Modifier le bénéficiaire"
        >
          <Pencil size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">Coordonnées du client bénéficiaire.</p>

      {!editing ? (
        <dl className="space-y-1.5 text-xs">
          <DL k="Raison sociale" v={d.raisonSociale} />
          <DL k="SIREN" v={d.siren} />
          <DL k="Contact" v={d.nomContact} />
          <DL k="Email" v={d.email} />
          <DL k="Téléphone" v={d.telephone} />
          <DL k="Adresse" v={`${d.adresse}, ${d.codePostal} ${d.ville}`} />
          {d.adresseTravauxDifferente && (
            <DL k="Adresse des travaux" v={`${d.adresseTravaux}, ${d.codePostalTravaux} ${d.villeTravaux}`} />
          )}
          <DL k="Type de station" v={d.typeStation ?? "—"} />
        </dl>
      ) : (
        <div className="space-y-3">
          <Field label="Raison sociale" value={form.raisonSociale} onChange={(v) => set("raisonSociale", v)} full />
          <div className="grid grid-cols-2 gap-3">
            <Field label="SIREN" value={form.siren} onChange={(v) => set("siren", v)} />
            <Field label="Contact (nom / prénom)" value={form.nomContact} onChange={(v) => set("nomContact", v)} />
          </div>
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" full />
          <Field label="Téléphone" value={form.telephone} onChange={(v) => set("telephone", v)} full />
          <Field label="Adresse" value={form.adresse} onChange={(v) => set("adresse", v)} full />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal" value={form.codePostal} onChange={(v) => set("codePostal", v)} />
            <Field label="Ville" value={form.ville} onChange={(v) => set("ville", v)} />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.adresseTravauxDifferente}
              onChange={(e) => set("adresseTravauxDifferente", e.target.checked)}
              className="w-4 h-4 accent-[#2b5a8f]"
            />
            Adresse des travaux différente
          </label>
          {form.adresseTravauxDifferente && (
            <>
              <Field label="Adresse des travaux" value={form.adresseTravaux} onChange={(v) => set("adresseTravaux", v)} full />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code postal des travaux" value={form.codePostalTravaux} onChange={(v) => set("codePostalTravaux", v)} />
                <Field label="Ville des travaux" value={form.villeTravaux} onChange={(v) => set("villeTravaux", v)} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs font-bold text-gray-500 rounded-xl hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={save} className="px-4 py-2 text-xs font-bold text-white bg-[#2b5a8f] rounded-xl">
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DL = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-gray-400 shrink-0">{k}</dt>
    <dd className="font-semibold text-gray-800 text-right">{v || "—"}</dd>
  </div>
);

// ── Contenu de chaque étape ──────────────────────────────────────────────
const StepContent = ({
  dossier: d,
  stepKey,
  onPatch,
  onAdvance,
}: {
  dossier: Dossier;
  stepKey: string;
  onPatch: (f: Partial<Dossier>) => void;
  onAdvance: (next: EtapeKey) => void;
}) => {
  if (stepKey === "1") return <Step1 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  if (stepKey === "2") return <Step2 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  if (stepKey === "3") return <StepSignature dossier={d} tokenField="preDevisToken" title="Attente de signature" desc="Validation automatique : en attente de la signature du client." docKind="predevis" onAdvance={() => onAdvance("4")} />;
  if (stepKey === "4") return <Step4 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  if (stepKey === "5") return <Step5 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  if (stepKey === "6") return <Step6 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  if (stepKey === "7") return <Step7Documents dossier={d} onAdvance={onAdvance} />;
  if (stepKey === "8") return <Step8 dossier={d} onAdvance={onAdvance} />;
  if (stepKey === "9") return <Step9 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  if (stepKey === "10") return <Step10 dossier={d} onPatch={onPatch} onAdvance={onAdvance} />;
  return null;
};

const StepHeader = ({ n, title, desc }: { n: string; title: string; desc: string }) => (
  <div className="mb-4">
    <h3 className="font-bold text-gray-900">
      Étape {n} — {title}
    </h3>
    <p className="text-xs text-gray-500">{desc}</p>
  </div>
);

// Étape 1 — Questionnaire d'éligibilité
// Types de pièces déposables via la carte "Documents" — même liste que la
// checklist de l'étape 8 (moins les photos, qui ont leur propre carte).
const DOCUMENT_TYPES = [
  "Contrat d'entretien signé",
  "Attestation d'engagement signée",
  "PV de réception",
  "État récapitulatif",
  "Autre",
];

// Dépôt de pièces et de photos de chantier, consultable dès l'étape 1 (en
// plus du dépôt dédié de l'étape 7) : utile quand le commercial récupère
// déjà des documents ou des photos sur le terrain au moment de qualifier
// le bénéficiaire, sans attendre la fin du chantier.
const DocumentsChantierCards = ({ dossier: d }: { dossier: Dossier }) => {
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [docs, setDocs] = useState<{ name: string; url: string }[] | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [photos, setPhotos] = useState<{ name: string; url: string }[] | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadDocs = async () => {
    const app = await getEspaceProApp();
    const { getStorage, ref, listAll, getDownloadURL } = await import("firebase/storage");
    const storage = getStorage(app);
    const res = await listAll(ref(storage, `gonflage/${d.id}/documents`));
    setDocs(await Promise.all(res.items.map(async (i) => ({ name: i.name, url: await getDownloadURL(i) }))));
  };
  const loadPhotos = async () => {
    const app = await getEspaceProApp();
    const { getStorage, ref, listAll, getDownloadURL } = await import("firebase/storage");
    const storage = getStorage(app);
    const res = await listAll(ref(storage, `gonflage/${d.id}/photos-chantier`));
    setPhotos(await Promise.all(res.items.map(async (i) => ({ name: i.name, url: await getDownloadURL(i) }))));
  };

  useEffect(() => {
    loadDocs();
    loadPhotos();
  }, []);

  const uploadDoc = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setUploadingDoc(true);
    try {
      const app = await getEspaceProApp();
      const { getStorage, ref, uploadBytes } = await import("firebase/storage");
      const storage = getStorage(app);
      for (const f of Array.from(fl)) {
        await uploadBytes(ref(storage, `gonflage/${d.id}/documents/${f.name}`), f, {
          customMetadata: { type: docType },
        });
      }
      await loadDocs();
    } finally {
      setUploadingDoc(false);
    }
  };

  const uploadPhotos = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setUploadingPhotos(true);
    try {
      const app = await getEspaceProApp();
      const { getStorage, ref, uploadBytes } = await import("firebase/storage");
      const storage = getStorage(app);
      for (const f of Array.from(fl)) {
        await uploadBytes(ref(storage, `gonflage/${d.id}/photos-chantier/${f.name}`), f);
      }
      await loadPhotos();
    } finally {
      setUploadingPhotos(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4">
        <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-1">
          <FileText size={15} /> Documents
        </p>
        <p className="text-xs text-gray-400 mb-3">Pièces justificatives du dossier CEE.</p>
        <span className="block text-xs font-semibold text-gray-600 mb-1">Type de document</span>
        <div className="flex gap-2 mb-3">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="flex-1 text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer whitespace-nowrap">
            {uploadingDoc ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Ajouter un fichier
            <input type="file" multiple className="hidden" disabled={uploadingDoc} onChange={(e) => uploadDoc(e.target.files)} />
          </label>
        </div>
        <div className="border-2 border-gray-100 rounded-xl px-3 py-3">
          {docs === null && <Loader2 className="animate-spin text-gray-300" size={16} />}
          {docs && docs.length === 0 && <p className="text-xs text-gray-400">Aucun document déposé.</p>}
          {docs && docs.length > 0 && (
            <ul className="space-y-1">
              {docs.map((f) => (
                <li key={f.name}>
                  <a href={f.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#2b5a8f]">
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4">
        <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-1">
          <Camera size={15} /> Photos du chantier
        </p>
        <p className="text-xs text-gray-400 mb-3">Prises de vue avant / après installation, horodatées automatiquement.</p>
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full ${
              photos && photos.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {photos && photos.length > 0 ? <CheckCircle2 size={13} /> : <Clock size={13} />}
            {photos && photos.length > 0
              ? `${photos.length} photo${photos.length > 1 ? "s" : ""} reçue${photos.length > 1 ? "s" : ""}`
              : "Attente photo"}
          </span>
          <label className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer whitespace-nowrap">
            {uploadingPhotos ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Ajouter des photos
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              disabled={uploadingPhotos}
              onChange={(e) => uploadPhotos(e.target.files)}
            />
          </label>
        </div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            uploadPhotos(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-[#2b5a8f] bg-blue-50" : "border-gray-200"
          }`}
        >
          <Upload size={18} className="text-gray-400 mb-1" />
          <span className="text-xs font-semibold text-gray-600">Glissez-déposez vos photos ici</span>
          <span className="text-[11px] text-gray-400">JPG, PNG — 20 Mo maximum par photo</span>
          <input
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="hidden"
            disabled={uploadingPhotos}
            onChange={(e) => uploadPhotos(e.target.files)}
          />
        </label>
        {photos && photos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {photos.map((f) => (
              <li key={f.name}>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#2b5a8f]">
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const Step1 = ({
  dossier: d,
  onPatch,
  onAdvance,
}: {
  dossier: Dossier;
  onPatch: (f: Partial<Dossier>) => void;
  onAdvance: (n: EtapeKey) => void;
}) => {
  const [typeStation, setTypeStation] = useState<"A" | "B" | "C">(d.typeStation ?? "B");
  const [espaceManoeuvre, setEspaceManoeuvre] = useState(d.espaceManoeuvre ?? false);
  const [conditionAcces, setConditionAcces] = useState(d.conditionAcces ?? false);
  const [arriveeElectrique, setArriveeElectrique] = useState(d.arriveeElectrique ?? false);

  const eligible = espaceManoeuvre && conditionAcces;
  const conditionLabel =
    typeStation === "B"
      ? "Site ouvert au public avec gonflage gratuit (catégorie B)"
      : typeStation === "C"
        ? "Réservé à la flotte professionnelle de l'entreprise (catégorie C)"
        : "Implantée sur autoroute / voie de grande circulation avec aire de stationnement (catégorie A)";

  const valider = () => {
    onPatch({ typeStation, espaceManoeuvre, conditionAcces, arriveeElectrique });
    if (eligible) onAdvance("2");
  };

  return (
    <div>
      <StepHeader n="1" title="Questionnaire d'éligibilité" desc="Le commercial qualifie le bénéficiaire" />

      <label className="block mb-4">
        <span className="block text-xs font-semibold text-gray-600 mb-1">Type de station</span>
        <select
          value={typeStation}
          onChange={(e) => setTypeStation(e.target.value as any)}
          className="w-full text-sm font-bold bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
        >
          <option value="A">A — Autoroute / aire de repos (534 200 kWh cumac)</option>
          <option value="B">B — Zone urbaine / parking public (148 400 kWh cumac)</option>
          <option value="C">C — Parking privé d'entreprise (39 600 kWh cumac)</option>
        </select>
      </label>

      <div className="space-y-2 mb-4">
        <Toggle label="Espace de manœuvre suffisant pour la station" checked={espaceManoeuvre} onChange={setEspaceManoeuvre} />
        <Toggle label={conditionLabel} checked={conditionAcces} onChange={setConditionAcces} />
        <Toggle label="Arrivée électrique disponible à moins de 20 m (information seulement)" checked={arriveeElectrique} onChange={setArriveeElectrique} />
      </div>

      <div className={`rounded-2xl p-4 mb-4 ${eligible ? "bg-green-50" : "bg-red-50"}`}>
        <p className={`text-sm font-bold ${eligible ? "text-green-700" : "text-red-700"}`}>
          Résultat : {eligible ? "Éligible" : "Non éligible en l'état (espace de manœuvre et conditions d'accès requis)"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          L'arrivée électrique est purement informative et n'influe pas sur l'éligibilité.
        </p>
      </div>

      <button
        onClick={valider}
        disabled={!eligible}
        className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300"
      >
        Valider l'éligibilité
      </button>

      <div className="mt-6">
        <DocumentsChantierCards dossier={d} />
      </div>
    </div>
  );
};

// Étape 2 — Envoi du pré-devis
const Step2 = ({
  dossier: d,
  onPatch,
  onAdvance,
}: {
  dossier: Dossier;
  onPatch: (f: Partial<Dossier>) => void;
  onAdvance: (n: EtapeKey) => void;
}) => {
  const [sending, setSending] = useState(false);
  const kwhCumac = d.kwhCumac ?? (d.typeStation ? CUMAC_PAR_TYPE[d.typeStation] : 0);
  const primeCEE = d.primeCEE ?? kwhCumac * TARIF_EUR_PAR_KWH_CUMAC;

  const telecharger = async () => {
    const pdf = await buildPredevisCompletPdf({ ...d, kwhCumac, primeCEE });
    pdf.save(`pre-devis-${d.raisonSociale}.pdf`);
  };

  const envoyer = async () => {
    setSending(true);
    try {
      const token = genToken();
      const app = await getEspaceProApp();
      const { getFirestore, doc, setDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const db = getFirestore(app);
      await setDoc(doc(db, "gonflage_signatures", token), {
        dossierId: d.id,
        type: "predevis",
        raisonSociale: d.raisonSociale,
        siren: d.siren,
        adresse: d.adresse,
        codePostal: d.codePostal,
        ville: d.ville,
        nomContact: d.nomContact,
        telephone: d.telephone,
        email: d.email,
        typeStation: d.typeStation,
        kwhCumac,
        primeCEE,
        reference: d.reference,
        statut: "envoye",
        envoyeAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "gonflage_dossiers", d.id), {
        kwhCumac,
        primeCEE,
        preDevisToken: token,
        etape: "3",
      });
      onPatch({ kwhCumac, primeCEE, preDevisToken: token, etape: "3" });
      onAdvance("3");
    } catch (e) {
      console.error(e);
      alert("Échec de l'envoi. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <StepHeader n="2" title="Envoi du pré-devis" desc="Génération du PDF et envoi du lien de signature" />
      <div className="bg-white rounded-2xl p-4 mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">kWh cumac</span>
        <span className="text-lg font-black text-gray-900">{kwhCumac.toLocaleString("fr-FR")}</span>
      </div>
      <div className="bg-white rounded-2xl p-4 mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">Prime CEE</span>
        <span className="text-lg font-black text-[#2b5a8f]">
          {primeCEE.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={telecharger}
          className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-gray-700 bg-white border-2 border-gray-200"
        >
          <Download size={15} /> Télécharger le pré-devis + attestation (PDF)
        </button>
        <button
          onClick={envoyer}
          disabled={sending || !d.email}
          className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Envoyer pour signature et figer le barème
        </button>
        {!d.email && (
          <p className="text-xs text-red-600">
            Ajoute un e-mail au bénéficiaire (carte "Bénéficiaire") avant d'envoyer.
          </p>
        )}
      </div>
    </div>
  );
};

// Étape 3 et 4 partagent la même mécanique de signature (pré-devis / contrat)
const StepSignature = ({
  dossier: d,
  tokenField,
  title,
  desc,
  docKind,
  onAdvance,
}: {
  dossier: Dossier;
  tokenField: "preDevisToken" | "contratToken";
  title: string;
  desc: string;
  docKind: "predevis" | "contrat";
  onAdvance: () => void;
}) => {
  const [sig, setSig] = useState<{ statut: string; nom?: string; signatureDataUrl?: string; signeAt?: string; validUntil?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const token = d[tokenField];
  // Cette carte reste consultable après coup (ex. revenir sur "Attente de
  // signature" une fois le dossier à l'étape 4) : ne déclenche l'avancée
  // automatique que si ce document est encore l'étape en cours du dossier,
  // sinon la revisite renverrait aussitôt à l'étape suivante.
  const expectedStep = docKind === "predevis" ? "3" : "4";
  const isCurrentStep = d.etape === expectedStep;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      const app = await getEspaceProApp();
      const { getFirestore, doc, getDoc } = await import("firebase/firestore");
      const db = getFirestore(app);
      const snap = await getDoc(doc(db, "gonflage_signatures", token));
      if (!cancelled && snap.exists()) {
        const data = snap.data() as any;
        setSig({ ...data, signeAt: tsToIso(data.signeAt) });
      }
      setLoading(false);
      if (!cancelled && isCurrentStep && snap.exists() && (snap.data() as any).statut === "signe") onAdvance();
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const telechargerSigne = async () => {
    if (!sig || !sig.signatureDataUrl || !sig.nom) return;
    setDownloading(true);
    try {
      const signature = {
        nom: sig.nom,
        dataUrl: sig.signatureDataUrl,
        date: formatDateTime(sig.signeAt ?? "") || new Date().toLocaleDateString("fr-FR"),
      };
      const pdf =
        docKind === "contrat"
          ? await buildDocumentPdf("contrat", d, signature)
          : await buildPredevisCompletPdf(d, signature);
      pdf.save(`${docKind === "contrat" ? "contrat" : "pre-devis"}-signe-${d.raisonSociale}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-gray-400">
        <Loader2 className="animate-spin mx-auto" size={22} />
      </div>
    );
  }

  const link = token ? `${window.location.origin}/gonflage-signature/${token}` : "";

  return (
    <div>
      <StepHeader n={docKind === "predevis" ? "3" : "4"} title={title} desc={desc} />

      {sig && (
        <div className="bg-white rounded-2xl p-4 mb-4">
          <span
            className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${
              sig.statut === "signe"
                ? "bg-green-100 text-green-700"
                : sig.statut === "vu"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {sig.statut === "signe" ? "Signé" : sig.statut === "vu" ? "Vu par le client" : "Envoyé"}
          </span>
          <p className="text-xs text-gray-500">Demande envoyée à {d.email}</p>
          {sig.statut === "signe" && (
            <>
              <p className="text-xs font-semibold text-green-700 mt-1">
                Signé par {sig.nom} le {formatDateTime(sig.signeAt ?? "")}
              </p>
              <button
                onClick={telechargerSigne}
                disabled={downloading}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#2b5a8f] px-3 py-2 rounded-full disabled:opacity-50"
              >
                {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Télécharger le document signé (PDF)
              </button>
            </>
          )}
        </div>
      )}

      {link && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Lien de signature à transmettre au client</label>
          <div className="flex gap-2">
            <input readOnly value={link} className="flex-1 text-xs bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 truncate" />
            <button
              onClick={() => navigator.clipboard.writeText(link)}
              className="px-3 py-2.5 bg-white border-2 border-gray-200 rounded-xl"
              aria-label="Copier le lien"
            >
              <Copy size={15} className="text-gray-500" />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Un e-mail contenant ce lien a été envoyé automatiquement à {d.email}. Tu peux aussi copier
            le lien ci-dessus pour le transmettre toi-même (SMS, WhatsApp...).
          </p>
        </div>
      )}

      <div className="bg-gray-100 rounded-2xl p-3 text-xs text-gray-500 flex items-center gap-2">
        <Lock size={13} /> Cette étape se valide automatiquement dès que le client signe électroniquement.
      </div>
    </div>
  );
};

// Étape 4 — génère + envoie le contrat d'entretien (même mécanique que 2/3)
const Step4 = ({
  dossier: d,
  onPatch,
  onAdvance,
}: {
  dossier: Dossier;
  onPatch: (f: Partial<Dossier>) => void;
  onAdvance: (n: EtapeKey) => void;
}) => {
  const [sending, setSending] = useState(false);

  if (d.contratToken) {
    return (
      <StepSignature
        dossier={d}
        tokenField="contratToken"
        title="Devis CEE à signer"
        desc="Contrat d'entretien établi et signé côté client"
        docKind="contrat"
        onAdvance={() => onAdvance("5")}
      />
    );
  }

  const telecharger = async () => {
    const pdf = await buildDocumentPdf("contrat", d);
    pdf.save(`contrat-entretien-${d.raisonSociale}.pdf`);
  };

  const envoyer = async () => {
    setSending(true);
    try {
      const token = genToken();
      const app = await getEspaceProApp();
      const { getFirestore, doc, setDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const db = getFirestore(app);
      await setDoc(doc(db, "gonflage_signatures", token), {
        dossierId: d.id,
        type: "contrat",
        raisonSociale: d.raisonSociale,
        siren: d.siren,
        adresse: d.adresse,
        codePostal: d.codePostal,
        ville: d.ville,
        nomContact: d.nomContact,
        telephone: d.telephone,
        email: d.email,
        typeStation: d.typeStation,
        kwhCumac: d.kwhCumac,
        primeCEE: d.primeCEE,
        reference: d.reference,
        statut: "envoye",
        envoyeAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "gonflage_dossiers", d.id), { contratToken: token });
      onPatch({ contratToken: token });
    } catch (e) {
      console.error(e);
      alert("Échec de l'envoi. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <StepHeader n="4" title="Devis CEE à signer" desc="Génération et envoi du contrat d'entretien (preuve CEE)" />
      <div className="flex flex-col gap-2">
        <button onClick={telecharger} className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-gray-700 bg-white border-2 border-gray-200">
          <Download size={15} /> Télécharger le contrat d'entretien (PDF)
        </button>
        <button
          onClick={envoyer}
          disabled={sending || !d.email}
          className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Envoyer pour signature
        </button>
      </div>
    </div>
  );
};

// Étape 5 — Planification installation
const Step5 = ({ dossier: d, onPatch, onAdvance }: { dossier: Dossier; onPatch: (f: Partial<Dossier>) => void; onAdvance: (n: EtapeKey) => void }) => {
  const [date, setDate] = useState(d.dateInstallation ?? "");
  const [creneau, setCreneau] = useState(d.creneauInstallation ?? "");
  const [materiel, setMateriel] = useState(d.materiel ?? "");
  return (
    <div>
      <StepHeader n="5" title="Planification installation" desc="Date, créneau et logistique matériel" />
      <div className="space-y-3 mb-4">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Date d'installation prévue</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Créneau</span>
          <select value={creneau} onChange={(e) => setCreneau(e.target.value)} className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5">
            <option value="">—</option>
            <option value="matin">Matin</option>
            <option value="apres-midi">Après-midi</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Matériel / logistique</span>
          <textarea value={materiel} onChange={(e) => setMateriel(e.target.value)} rows={2} className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 resize-none" />
        </label>
      </div>
      <button
        onClick={() => {
          onPatch({ dateInstallation: date, creneauInstallation: creneau, materiel });
          onAdvance("6");
        }}
        disabled={!date}
        className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300"
      >
        Confirmer la planification
      </button>
    </div>
  );
};

// Étape 6 — Installation faite
const Step6 = ({ dossier: d, onPatch, onAdvance }: { dossier: Dossier; onPatch: (f: Partial<Dossier>) => void; onAdvance: (n: EtapeKey) => void }) => (
  <div>
    <StepHeader n="6" title="Installation faite" desc="Pose réalisée sur le terrain" />
    <p className="text-sm text-gray-600 mb-4">
      Date prévue : {d.dateInstallation || "—"} ({d.creneauInstallation || "—"})
    </p>
    <button
      onClick={() => {
        onPatch({});
        onAdvance("7");
      }}
      className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f]"
    >
      Marquer comme installé
    </button>
  </div>
);

// Étape 7 — Documents de fin de chantier (upload)
const Step7Documents = ({ dossier: d, onAdvance }: { dossier: Dossier; onAdvance: (n: EtapeKey) => void }) => {
  const [files, setFiles] = useState<{ name: string; url: string }[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const app = await getEspaceProApp();
    const { getStorage, ref, listAll, getDownloadURL } = await import("firebase/storage");
    const storage = getStorage(app);
    const res = await listAll(ref(storage, `gonflage/${d.id}`));
    const list = await Promise.all(res.items.map(async (i) => ({ name: i.name, url: await getDownloadURL(i) })));
    setFiles(list);
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setUploading(true);
    try {
      const app = await getEspaceProApp();
      const { getStorage, ref, uploadBytes } = await import("firebase/storage");
      const storage = getStorage(app);
      for (const f of Array.from(fl)) {
        await uploadBytes(ref(storage, `gonflage/${d.id}/${f.name}`), f);
      }
      await load();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <StepHeader n="7" title="Documents de fin de chantier" desc="PV et attestations signés" />
      <div className="bg-white rounded-2xl p-4 mb-4">
        {files === null && <Loader2 className="animate-spin text-gray-300" size={18} />}
        {files && files.length === 0 && <p className="text-xs text-gray-400">Aucun document déposé.</p>}
        {files && files.length > 0 && (
          <ul className="space-y-1 mb-2">
            {files.map((f) => (
              <li key={f.name}>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#2b5a8f]">
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2b5a8f] cursor-pointer mt-2">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Ajouter un fichier
          <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      <button onClick={() => onAdvance("8")} className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f]">
        Continuer
      </button>
    </div>
  );
};

// Étape 8 — Dépôt des documents (checklist)
const Step8 = ({ dossier: d, onAdvance }: { dossier: Dossier; onAdvance: (n: EtapeKey) => void }) => {
  const items = ["Contrat d'entretien signé", "Attestation d'engagement signée", "PV de réception", "Photos avant/après", "État récapitulatif"];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = items.every((i) => checked[i]);
  return (
    <div>
      <StepHeader n="8" title="Dépôt des documents" desc="Pièces du dossier déposées et catégorisées" />
      <div className="space-y-2 mb-4">
        {items.map((i) => (
          <Toggle key={i} label={i} checked={!!checked[i]} onChange={(v) => setChecked((c) => ({ ...c, [i]: v }))} />
        ))}
      </div>
      <button
        onClick={() => onAdvance("9")}
        disabled={!allChecked}
        className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300"
      >
        Marquer le dossier comme complet
      </button>
    </div>
  );
};

// Étape 9 — Dépôt délégataire
const Step9 = ({ dossier: d, onPatch, onAdvance }: { dossier: Dossier; onPatch: (f: Partial<Dossier>) => void; onAdvance: (n: EtapeKey) => void }) => {
  const [ref, setRef] = useState(d.referenceDelegataire ?? "");
  return (
    <div>
      <StepHeader n="9" title="Dépôt délégataire" desc="Dossier transmis au délégataire" />
      <label className="block mb-4">
        <span className="block text-xs font-semibold text-gray-600 mb-1">Référence délégataire</span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5" />
      </label>
      <button
        onClick={() => {
          onPatch({ referenceDelegataire: ref });
          onAdvance("10");
        }}
        className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f]"
      >
        Marquer comme déposé au délégataire
      </button>
    </div>
  );
};

// Étape 10 — Paiement
const Step10 = ({ dossier: d, onPatch, onAdvance }: { dossier: Dossier; onPatch: (f: Partial<Dossier>) => void; onAdvance: (n: EtapeKey) => void }) => {
  const [date, setDate] = useState(d.datePaiement ?? "");
  const [montant, setMontant] = useState(d.montantPaiement ?? String(d.primeCEE ?? ""));
  return (
    <div>
      <StepHeader n="10" title="Paiement" desc="Prime versée par le délégataire" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Date de paiement</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Montant (€)</span>
          <input value={montant} onChange={(e) => setMontant(e.target.value)} className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5" />
        </label>
      </div>
      <button
        onClick={() => onPatch({ datePaiement: date, montantPaiement: montant })}
        className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f]"
      >
        Marquer comme payé — dossier terminé
      </button>
    </div>
  );
};

// ── Page principale (liste + tableau de bord) ────────────────────────────
export default function GonflageCRM({ email, onBack }: { email: string; onBack: () => void }) {
  const [view, setView] = useState<"tableau" | "dossiers">("tableau");
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"tous" | string>("tous");
  const [showNew, setShowNew] = useState(false);
  const [openDossier, setOpenDossier] = useState<Dossier | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const load = async () => {
    setLoading(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, collection, getDocs } = await import("firebase/firestore");
      const db = getFirestore(app);
      const snap = await getDocs(collection(db, "gonflage_dossiers"));
      const list = snap.docs.map((d) => {
        const data = d.data() as Omit<Dossier, "id">;
        return { id: d.id, ...data, createdAt: tsToIso(data.createdAt) };
      });
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setDossiers(list);
    } catch (e) {
      console.error(e);
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Le bouton "précédent" du navigateur referme un niveau (onglet Dossiers,
  // modale de création, fiche détail) au lieu de quitter la page.
  useBrowserBackLevel(view === "dossiers", () => setView("tableau"));
  useBrowserBackLevel(showNew, () => setShowNew(false));
  useBrowserBackLevel(!!openDossier, () => {
    setOpenDossier(null);
    load();
  });

  const filtered = useMemo(() => {
    if (!dossiers) return [];
    let list = dossiers;
    if (stageFilter !== "tous") list = list.filter((d) => d.etape === stageFilter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((d) => [d.raisonSociale, d.siren, d.reference, d.ville].join(" ").toLowerCase().includes(q));
    return list;
  }, [dossiers, stageFilter, query]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of ETAPES) counts[e.key] = 0;
    counts["annule"] = 0;
    for (const d of dossiers ?? []) counts[d.etape] = (counts[d.etape] ?? 0) + 1;
    return counts;
  }, [dossiers]);

  const signes = (dossiers ?? []).filter((d) => stepIndex(d.etape) >= 5).length;
  const enAttente = (stageCounts["3"] ?? 0) + (stageCounts["4"] ?? 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-16" dir="ltr">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} aria-label="Retour aux métiers" className="p-1.5 -ml-1.5 text-gray-400 hover:text-gray-700">
              <ArrowLeft size={20} />
            </button>
            <LogoIP5 className="h-9" />
          </div>
          <span className="text-xs text-gray-400">{email}</span>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-2 flex gap-2">
          <button onClick={() => setView("tableau")} className={`flex-1 text-sm font-bold px-3 py-2 rounded-full transition-colors ${view === "tableau" ? "bg-[#2b5a8f] text-white" : "bg-gray-100 text-gray-500"}`}>
            Tableau de bord
          </button>
          <button onClick={() => setView("dossiers")} className={`flex-1 text-sm font-bold px-3 py-2 rounded-full transition-colors ${view === "dossiers" ? "bg-[#2b5a8f] text-white" : "bg-gray-100 text-gray-500"}`}>
            Dossiers
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {loading && (
          <div className="py-20 text-center text-gray-400">
            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
            Chargement…
          </div>
        )}

        {!loading && view === "tableau" && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Bonjour 👋</h1>
            <p className="text-sm text-gray-400 mb-6">Vos dossiers CEE stations de gonflage.</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard icon={FolderOpen} label="Mes dossiers" value={dossiers?.length ?? 0} color="text-[#2b5a8f]" />
              <StatCard icon={CheckCircle2} label="Dossiers signés" value={signes} color="text-green-600" />
              <StatCard icon={Clock} label="En attente de signature" value={enAttente} color="text-amber-500" />
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900">Dossiers récents</h2>
                <button onClick={() => setView("dossiers")} className="text-sm font-bold text-[#2b5a8f] inline-flex items-center gap-1">
                  Tout voir <ChevronRight size={15} />
                </button>
              </div>
              <div className="space-y-2">
                {(dossiers ?? []).slice(0, 5).map((d) => (
                  <button key={d.id} onClick={() => setOpenDossier(d)} className="w-full flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3 text-left hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{d.raisonSociale}</p>
                      <p className="text-xs text-gray-400">{d.ville}</p>
                    </div>
                    <StageBadge etape={d.etape} />
                  </button>
                ))}
                {dossiers && dossiers.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Aucun dossier pour l'instant.</p>}
              </div>
            </div>
          </>
        )}

        {!loading && view === "dossiers" && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-bold text-gray-900">Dossiers</h1>
              <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-4 py-2.5 rounded-full">
                <Plus size={16} /> Nouveau dossier
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Vos dossiers CEE stations de gonflage.</p>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher une raison sociale, un SIREN, une référence…"
                className="w-full text-sm bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-3 outline-none focus:border-[#2b5a8f]"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
              <button
                onClick={() => {
                  setStageFilter("tous");
                  setPage(1);
                }}
                className={`shrink-0 text-xs font-bold px-3 py-2 rounded-full border ${stageFilter === "tous" ? "bg-[#2b5a8f] text-white border-[#2b5a8f]" : "bg-white text-gray-600 border-gray-200"}`}
              >
                Tous les dossiers {dossiers?.length ?? 0}
              </button>
              {[...ETAPES, { key: "annule", label: "Annulé / Pas intéressé", desc: "", color: "bg-gray-200 text-gray-600 border-gray-300" }].map((e) => (
                <button
                  key={e.key}
                  onClick={() => {
                    setStageFilter(e.key);
                    setPage(1);
                  }}
                  className={`shrink-0 text-xs font-bold px-3 py-2 rounded-full border whitespace-nowrap ${stageFilter === e.key ? "bg-[#2b5a8f] text-white border-[#2b5a8f]" : e.color}`}
                >
                  {e.key !== "annule" ? `${e.key}. ` : ""}
                  {e.label} {stageCounts[e.key] ?? 0}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {paged.map((d) => (
                  <button key={d.id} onClick={() => setOpenDossier(d)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{d.raisonSociale}</p>
                      <p className="text-xs text-gray-400">{d.ville}</p>
                    </div>
                    <StageBadge etape={d.etape} />
                  </button>
                ))}
                {paged.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Aucun dossier ne correspond.</p>}
              </div>
            </div>

            {filtered.length > perPage && (
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>
                  {(page - 1) * perPage + 1} – {Math.min(page * perPage, filtered.length)} sur {filtered.length} dossier{filtered.length > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 font-bold disabled:opacity-40">
                    Précédent
                  </button>
                  <span className="font-bold text-gray-700">{page}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 font-bold disabled:opacity-40">
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showNew && (
        <NewDossierModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {openDossier && (
        <DossierDetail
          dossier={openDossier}
          onClose={() => {
            setOpenDossier(null);
            load();
          }}
          onUpdated={(patch) => {
            setOpenDossier((d) => (d ? { ...d, ...patch } : d));
            setDossiers((list) => (list ? list.map((d) => (d.id === openDossier.id ? { ...d, ...patch } : d)) : list));
          }}
          onDeleted={() => {
            setOpenDossier(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const StageBadge = ({ etape }: { etape: EtapeKey }) => {
  if (etape === "annule") {
    return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-gray-200 text-gray-600 border-gray-300">Annulé / Pas intéressé</span>;
  }
  const meta = etapeMeta(etape);
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${meta?.color}`}>
      {etape}. {meta?.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: typeof FolderOpen; label: string; value: number; color: string }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">
      <Icon size={13} /> {label}
    </div>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
  </div>
);
