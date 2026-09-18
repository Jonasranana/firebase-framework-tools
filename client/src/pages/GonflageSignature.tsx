import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Loader2, Download, CheckCircle2 } from "lucide-react";
import { LogoIP5 } from "./site-chrome";
import { getEspaceProApp } from "@/lib/espacePro";
import { buildDocumentPdf, buildPredevisCompletPdf, SignaturePad, type DocumentData } from "./GonflageCRM";

// ─────────────────────────────────────────────────────────────────────────
// Page publique (aucune connexion requise) où le client bénéficiaire
// signe électroniquement son pré-devis ou son contrat d'entretien CEE
// (opération TRA-SE-104). Accessible via /gonflage-signature/:token.
//
// Ne lit/écrit QUE la collection gonflage_signatures/{token} — jamais le
// dossier complet (gonflage_dossiers), qui reste protégé par connexion
// Google + liste blanche. Les règles Firestore doivent restreindre
// l'écriture publique aux seuls champs de signature (voir message de
// suivi pour le texte exact des règles).
// ─────────────────────────────────────────────────────────────────────────

type SignatureDoc = DocumentData & {
  type: "predevis" | "contrat";
  statut: "envoye" | "vu" | "signe";
  nom?: string;
  signatureDataUrl?: string;
  signeAt?: string;
};

export default function GonflageSignature() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [doc, setDoc] = useState<SignatureDoc | null>(null);
  const [error, setError] = useState("");
  const [nom, setNom] = useState("");
  const [accepte, setAccepte] = useState(false);
  const [engage, setEngage] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    document.title = "Signature — Pré-devis CEE";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Lien invalide.");
        return;
      }
      try {
        const app = await getEspaceProApp();
        const { getFirestore, doc: fsDoc, getDoc, updateDoc, serverTimestamp } = await import(
          "firebase/firestore"
        );
        const db = getFirestore(app);
        const ref = fsDoc(db, "gonflage_signatures", token);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          if (!cancelled) setError("Ce lien n'est plus valide ou a expiré.");
          return;
        }
        const data = snap.data() as SignatureDoc;
        if (!cancelled) {
          setDoc(data);
          if (data.statut !== "envoye" && data.statut !== "vu" && data.statut !== "signe") return;
        }
        if (data.statut === "envoye") {
          await updateDoc(ref, { statut: "vu", vuAt: serverTimestamp() });
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Impossible de charger ce document. Réessayez.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSign = nom.trim() && accepte && engage && signatureDataUrl;

  const submit = async () => {
    if (!canSign || !doc) return;
    setSaving(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, doc: fsDoc, updateDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const db = getFirestore(app);
      await updateDoc(fsDoc(db, "gonflage_signatures", token), {
        statut: "signe",
        nom: nom.trim(),
        signatureDataUrl,
        signeAt: serverTimestamp(),
      });
      setDoc((d) => (d ? { ...d, statut: "signe", nom: nom.trim(), signatureDataUrl } : d));
    } catch (e) {
      console.error(e);
      alert("Échec de l'enregistrement de la signature. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const telechargerSigne = async () => {
    if (!doc || !doc.signatureDataUrl || !doc.nom) return;
    setDownloading(true);
    try {
      const signature = {
        nom: doc.nom,
        dataUrl: doc.signatureDataUrl,
        date: new Date().toLocaleDateString("fr-FR"),
      };
      const pdf =
        doc.type === "contrat"
          ? await buildDocumentPdf("contrat", doc, signature)
          : await buildPredevisCompletPdf(doc, signature);
      pdf.save(`${doc.type === "contrat" ? "contrat" : "pre-devis"}-signe-${doc.raisonSociale}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <LogoIP5 className="h-9 mx-auto mb-4" />
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={28} />
      </div>
    );
  }

  const primeCEE = doc.primeCEE ?? 0;
  const kwhCumac = doc.kwhCumac ?? 0;
  const isContrat = doc.type === "contrat";

  return (
    <div className="min-h-screen bg-gray-50 pb-16" dir="ltr">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-4">
          <LogoIP5 className="h-9" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-6 space-y-4">
        {doc.statut === "signe" ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="mx-auto text-green-600 mb-3" size={40} />
            <h1 className="text-lg font-bold text-gray-900 mb-1">C'est signé, merci !</h1>
            <p className="text-sm text-gray-500 mb-6">
              Signé par {doc.nom} le {new Date().toLocaleDateString("fr-FR")}. Nous poursuivons le
              montage de votre dossier CEE.
            </p>
            <button
              onClick={telechargerSigne}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-5 py-3 rounded-full disabled:opacity-50"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Télécharger le document signé (PDF)
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h1 className="text-lg font-bold text-gray-900 mb-1">
                {isContrat ? "Contrat d'entretien" : "Pré-devis CEE"} — Station de gonflage des
                pneumatiques
              </h1>
              <p className="text-xs text-gray-400 mb-4">
                Opération standardisée CEE TRA-SE-104{doc.reference ? ` — réf. ${doc.reference}` : ""}
              </p>

              <dl className="text-sm space-y-1 mb-4">
                <div className="flex justify-between">
                  <dt className="text-gray-400">Bénéficiaire</dt>
                  <dd className="font-semibold text-gray-800">{doc.raisonSociale}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">SIREN</dt>
                  <dd className="font-semibold text-gray-800">{doc.siren}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Adresse</dt>
                  <dd className="font-semibold text-gray-800 text-right">
                    {doc.adresse}, {doc.codePostal} {doc.ville}
                  </dd>
                </div>
              </dl>

              {!isContrat && (
                <div className="bg-green-50 rounded-2xl p-4 mb-2">
                  <p className="text-sm font-bold text-green-700 mb-1">Opération intégralement financée</p>
                  <p className="text-xs text-green-800">
                    La station de gonflage et sa pose vous sont offertes. La prime CEE (
                    {primeCEE.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €, pour{" "}
                    {kwhCumac.toLocaleString("fr-FR")} kWh cumac valorisés) couvre intégralement le
                    contrat d'entretien de la station : aucun paiement ne vous est demandé, ni
                    acompte, ni solde.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-900 mb-3">
                Attestation d'engagement — station accessible et gratuite
                {doc.typeStation ? ` (catégorie ${doc.typeStation})` : ""}
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                En signant, vous signez également l'attestation d'engagement jointe au document :
              </p>
              <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
                <li>
                  <b>Espace de manœuvre</b> : je dispose d'un espace permettant à un véhicule de se
                  garer et de stationner en sécurité le temps du gonflage de ses pneumatiques.
                </li>
                <li>
                  <b>Accès à tout public</b> : la station de gonflage sera librement accessible à tout
                  usager, y compris aux personnes qui ne sont pas clientes de mon établissement.
                </li>
                <li>
                  <b>Gratuité</b> : le gonflage des pneumatiques sera entièrement gratuit ; aucun
                  paiement, aucune contrepartie ni aucune obligation d'achat ne sera demandé aux
                  usagers.
                </li>
                <li>
                  <b>Maintien dans le temps</b> : je m'engage à maintenir ces conditions d'accès et de
                  gratuité pendant toute la durée de vie de l'installation, et à laisser la station en
                  état de fonctionnement.
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-600 mb-1">
                  Vos nom et prénom
                </span>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex. Marie Dupont"
                  className="w-full text-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
                />
              </label>

              <label className="flex items-start gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={accepte}
                  onChange={(e) => setAccepte(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#2b5a8f]"
                />
                J'accepte ce {isContrat ? "contrat d'entretien" : "pré-devis"} et j'autorise IP5
                Énergie à poursuivre le montage du dossier CEE.
              </label>

              <label className="flex items-start gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={engage}
                  onChange={(e) => setEngage(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#2b5a8f]"
                />
                Je m'engage sur les conditions de l'attestation ci-dessus (espace de manœuvre, accès à
                tout public, gratuité du gonflage) et je signe cette attestation en même temps que ce
                document.
              </label>

              <div>
                <span className="block text-xs font-semibold text-gray-600 mb-1">
                  Signez dans le cadre ci-dessous
                </span>
                <SignaturePad onChange={setSignatureDataUrl} />
              </div>

              <button
                onClick={submit}
                disabled={!canSign || saving}
                className="w-full py-3 rounded-xl font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300"
              >
                {saving ? "Enregistrement…" : "Valider ma signature"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
