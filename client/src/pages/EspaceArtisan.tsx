import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  Loader2,
  MapPin,
  Package,
  Truck,
  Wrench,
} from "lucide-react";
import { LogoIP5 } from "./site-chrome";
import {
  ARTISAN_GRID_SECTIONS,
  SUPPLIED_MATERIAL,
  TRAVEL_FIELDS,
} from "@/lib/artisanGrid";

type Status = "ready" | "done";

const DRAFT_KEY = "ip5_artisan_grid_draft";
const SUBMIT_ENDPOINT =
  "https://europe-west9-kachoto-7554c.cloudfunctions.net/submitArtisanGrid";

type Identity = { prenom: string; nom: string; siret: string; ville: string; email: string; telephone: string };
const EMPTY_IDENTITY: Identity = { prenom: "", nom: "", siret: "", ville: "", email: "", telephone: "" };

const IDENTITY_FIELDS: { id: keyof Identity; label: string; type?: string; required: boolean }[] = [
  { id: "prenom", label: "Prénom", required: true },
  { id: "nom", label: "Nom", required: true },
  { id: "siret", label: "SIRET", required: true },
  { id: "ville", label: "Ville", required: true },
  { id: "email", label: "E-mail", type: "email", required: true },
  { id: "telephone", label: "Téléphone (facultatif)", type: "tel", required: false },
];

const input =
  "w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-[#2b5a8f] outline-none text-base";

function loadDraft(): { identity: Identity; travel: Record<string, string>; prices: Record<string, string>; comment: string } {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    if (d) return { identity: { ...EMPTY_IDENTITY, ...d.identity }, travel: d.travel ?? {}, prices: d.prices ?? {}, comment: d.comment ?? "" };
  } catch {
    /* brouillon illisible : on repart de zéro */
  }
  return { identity: EMPTY_IDENTITY, travel: {}, prices: {}, comment: "" };
}

// ─────────────────────────────────────────────────────────────────────────
// ESPACE ARTISANS PARTENAIRES — route /espace-pro.
// Pas de création de compte : l'artisan lit la présentation, remplit ses
// coordonnées (prénom, nom, SIRET, e-mail) et sa grille, puis « J'ai
// terminé ». La Cloud Function submitArtisanGrid enregistre la grille, met
// l'artisan dans le groupe « ✅ Grilles remplies » du tableau Monday de
// recrutement et envoie le PDF à IP5 et à l'artisan. Le brouillon est gardé
// dans le navigateur (localStorage) en attendant l'envoi.
// Aucun tarif IP5 n'est affiché ici.
// ─────────────────────────────────────────────────────────────────────────
export default function EspaceArtisan() {
  const initial = useMemo(loadDraft, []);
  const [status, setStatus] = useState<Status>("ready");
  const [identity, setIdentity] = useState<Identity>(initial.identity);
  const [travel, setTravel] = useState<Record<string, string>>(initial.travel);
  const [prices, setPrices] = useState<Record<string, string>>(initial.prices);
  const [comment, setComment] = useState(initial.comment);
  const [company, setCompany] = useState(""); // champ piège anti-robot
  const [open, setOpen] = useState<string>("pose_mono");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Espace artisans partenaires — IP5 Énergie";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ identity, travel, prices, comment }));
    } catch {
      /* stockage indisponible : sans effet sur l'envoi */
    }
  }, [identity, travel, prices, comment]);

  const filledPrices = useMemo(
    () => Object.values(prices).filter((v) => String(v ?? "").trim() !== "").length,
    [prices],
  );

  const finish = async () => {
    const errs: string[] = [];
    const missing = IDENTITY_FIELDS.filter((f) => f.required && !identity[f.id].trim()).map((f) => f.label);
    if (missing.length) errs.push(`À compléter : ${missing.join(", ")}.`);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identity.email.trim())) errs.push("Adresse e-mail invalide.");
    if (identity.siret.trim() && identity.siret.replace(/\s/g, "").length !== 14)
      errs.push("Le SIRET doit contenir 14 chiffres.");
    if (filledPrices === 0) errs.push("Indiquez au moins un prix de pose.");
    setErrors(errs);
    if (errs.length) {
      if (missing.length) document.getElementById("coordonnees")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, travel, prices, comment, company }),
      });
      if (!res.ok) throw new Error(String(res.status));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* rien */
      }
      setStatus("done");
      window.scrollTo({ top: 0 });
    } catch {
      setErrors(["L'envoi a échoué. Réessayez dans un instant ou appelez-nous au 07 49 52 52 67."]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#eef4fb] to-[#dce9f7]" dir="ltr" style={{ colorScheme: "light" }}>
      <header className="bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <a href="/">
            <LogoIP5 className="h-9 !text-[#f28c28]" />
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {status === "done" ? (
          <div className="max-w-xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={48} />
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Merci {identity.prenom.trim()}, c'est bien reçu !</h1>
            <p className="text-gray-600 mb-2">
              Votre grille a été transmise à IP5 Énergie. Une copie en PDF vous est envoyée par e-mail.
            </p>
            <p className="text-gray-600">Nous revenons vers vous très rapidement.</p>
          </div>
        ) : (
          <>
            <Presentation />

            <div id="grille" className="scroll-mt-6 max-w-3xl mx-auto mt-12">
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#0f2b4a]">Votre grille de tarifs</h2>
              <p className="text-gray-600 mt-2">
                Indiquez vos prix <b>hors taxes</b> pour la pose. Laissez vide ce que vous ne faites pas. Pas besoin
                de créer de compte : vos réponses sont gardées sur cet appareil jusqu'à l'envoi.
              </p>

              <section id="coordonnees" className="scroll-mt-6 mt-6 bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900">Vos coordonnées</h3>
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {IDENTITY_FIELDS.map((f) => (
                    <label key={f.id} className={`block ${f.id === "email" ? "sm:col-span-2" : ""}`}>
                      <span className="text-xs font-semibold text-gray-600">
                        {f.label}
                        {f.required && " *"}
                      </span>
                      <input
                        type={f.type ?? "text"}
                        inputMode={f.id === "siret" ? "numeric" : undefined}
                        autoComplete={f.id === "prenom" ? "given-name" : f.id === "nom" ? "family-name" : f.id === "email" ? "email" : f.id === "telephone" ? "tel" : f.id === "ville" ? "address-level2" : "off"}
                        className={input}
                        maxLength={f.id === "siret" ? 17 : 120}
                        value={identity[f.id]}
                        onChange={(e) => setIdentity((v) => ({ ...v, [f.id]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
              </section>

              <section className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Package size={18} className="text-[#2b5a8f]" /> Matériel fourni et livré par IP5
                </h3>
                <p className="text-sm text-gray-600 mt-1">Vous n'achetez pas le matériel : vos prix concernent la pose.</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {SUPPLIED_MATERIAL.map((m) => (
                    <div key={m.brand} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                      {m.image ? (
                        <img src={m.image} alt={`${m.brand} ${m.model}`} className="w-16 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                          {m.brand}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{m.brand}</div>
                        <div className="text-xs text-gray-500">{m.model}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-4 space-y-3">
                {ARTISAN_GRID_SECTIONS.map((s) => (
                  <Panel key={s.id} id={s.id} title={s.title} open={open} setOpen={setOpen}>
                    {s.hint && <p className="text-xs text-gray-500 mb-3">{s.hint}</p>}
                    <div className="space-y-3">
                      {s.lines.map((l) => (
                        <PriceRow
                          key={l.id}
                          label={l.label}
                          unit={l.unit}
                          value={prices[l.id] ?? ""}
                          onChange={(v) => setPrices((p) => ({ ...p, [l.id]: v }))}
                        />
                      ))}
                    </div>
                  </Panel>
                ))}

                <Panel id="travel" title="Déplacements" icon={<Truck size={18} />} open={open} setOpen={setOpen}>
                  <div className="space-y-3">
                    {TRAVEL_FIELDS.map((f) => (
                      <PriceRow
                        key={f.id}
                        label={f.label}
                        unit={f.unit}
                        value={travel[f.id] ?? ""}
                        onChange={(v) => setTravel((t) => ({ ...t, [f.id]: v }))}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel id="comment" title="Commentaire (facultatif)" open={open} setOpen={setOpen}>
                  <textarea
                    className={`${input} min-h-[100px]`}
                    maxLength={2000}
                    placeholder="Conditions particulières, délais, disponibilités…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </Panel>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                En envoyant votre grille, vous acceptez qu'IP5 Énergie utilise ces informations pour vous recontacter
                au sujet d'un partenariat. Voir notre{" "}
                <a href="/confidentialite" className="underline">politique de confidentialité</a>.
              </p>

              <div className="sticky bottom-0 mt-4 -mx-4 px-4 py-4 bg-white/95 backdrop-blur border-t border-gray-200">
                {errors.map((e) => (
                  <p key={e} className="text-sm text-red-600 mb-2">
                    {e}
                  </p>
                ))}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 flex-1">
                    {filledPrices} prix renseigné{filledPrices > 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={finish}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 bg-[#f28c28] hover:bg-[#e07a12] text-white font-bold px-6 py-3 rounded-full shadow-md disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={18} />}
                    J'ai terminé
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-10">
          Une question ? 07 49 52 52 67 · contact@ip5energie.com
        </p>
      </main>
    </div>
  );
}

// Présentation de l'offre aux artisans (visible avant la connexion) : tout
// ce qu'il faut savoir même si on ne les a pas eus au téléphone.
const OFFER = [
  {
    icon: MapPin,
    title: "Des chantiers près de chez vous",
    text: "Nous trouvons les clients et vous proposons des installations de pompes à chaleur dans votre secteur.",
  },
  {
    icon: Package,
    title: "Matériel fourni et livré",
    text: "PAC Atlantic ou Chappée livrées par IP5 : vous n'achetez rien, vous posez.",
  },
  {
    icon: FileCheck2,
    title: "Zéro administratif",
    text: "Dossiers d'aides (CEE, MaPrimeRénov'), devis et suivi client : notre équipe s'occupe de tout.",
  },
  {
    icon: Wrench,
    title: "Vos prix, vos conditions",
    text: "Vous fixez vos tarifs de pose et votre rayon d'intervention. Vous restez libre d'accepter chaque chantier.",
  },
];

const STEPS = [
  { icon: ClipboardList, title: "Vous remplissez votre grille", text: "5 minutes, sur téléphone ou ordinateur." },
  { icon: MapPin, title: "On vous propose des chantiers", text: "Dans votre zone, à vos prix, selon vos disponibilités." },
  { icon: CalendarCheck, title: "Vous posez, on gère le reste", text: "Matériel livré, client et dossier suivis par IP5." },
];

// Photo d'illustration (image générée, pas un vrai client).
const HERO_PHOTO = "/images/artisans/installateur-client.jpg";

const goToSignup = () =>
  document.getElementById("grille")?.scrollIntoView({ behavior: "smooth", block: "start" });

function Presentation() {
  return (
    <div>
      <section className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
        <div className="order-2 md:order-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#f28c28]">Artisans RGE QualiPAC</p>
          <h1 className="text-[28px] leading-tight md:text-4xl font-extrabold text-[#0f2b4a] mt-2">
            Recevez des chantiers de pompes à chaleur dans votre région
          </h1>
          <p className="text-gray-600 mt-4 text-base md:text-lg">
            IP5 Énergie accompagne des particuliers qui remplacent leur chaudière fioul ou gaz. Nous cherchons des
            artisans de confiance pour réaliser la pose près de chez eux.
          </p>
          <button
            onClick={goToSignup}
            className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f28c28] hover:bg-[#e07a12] text-white font-bold text-lg px-8 py-4 rounded-full shadow-lg shadow-orange-200"
          >
            Remplir ma grille de tarifs
          </button>
          <p className="text-xs text-gray-500 mt-3">Gratuit et sans engagement · 5 minutes</p>
        </div>
        <div className="order-1 md:order-2">
          <img
            src={HERO_PHOTO}
            alt="Un installateur et des propriétaires satisfaits devant leur pompe à chaleur"
            className="w-full h-64 sm:h-80 md:h-[24rem] object-cover object-[60%_40%] rounded-3xl shadow-xl ring-4 ring-white"
          />
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Ce que nous vous proposons</h2>
        <div className="grid sm:grid-cols-2 gap-3 md:gap-4 mt-4">
          {OFFER.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-[#2b5a8f] flex items-center justify-center">
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-bold text-gray-900">{title}</span>
                <span className="block text-sm text-gray-600 mt-0.5">{text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Comment ça marche</h2>
        <ol className="grid md:grid-cols-3 gap-3 md:gap-4 mt-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex md:flex-col gap-3 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#f28c28] text-white font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>
                <span className="flex items-center gap-2 font-bold text-gray-900">
                  <Icon size={18} className="text-[#2b5a8f] hidden md:inline" /> {title}
                </span>
                <span className="block text-sm text-gray-600 mt-0.5">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-100 p-4 md:p-5 text-sm md:text-base text-[#173a5e]">
          <b>Pourquoi une grille de tarifs ?</b> Avec vos prix de pose, votre rayon de déplacement et la distance
          maximale que vous acceptez, nous savons tout de suite quels chantiers vous proposer. Pas de négociation à
          chaque fois : vous recevez uniquement des installations qui vous conviennent.
        </div>
      </section>
    </div>
  );
}

function Panel({
  id,
  title,
  icon,
  open,
  setOpen,
  children,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  open: string;
  setOpen: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <section className="bg-white rounded-2xl border border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(isOpen ? "" : id)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-bold text-gray-900"
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-[#2b5a8f]">{icon}</span>}
          {title}
        </span>
        <ChevronDown size={20} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function PriceRow({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 sm:gap-3">
      <span className="flex-1 min-w-0 text-sm text-gray-700 leading-snug">{label}</span>
      <input
        inputMode="decimal"
        className="w-24 sm:w-28 flex-shrink-0 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-semibold text-right text-base focus:border-[#2b5a8f] outline-none"
        value={value}
        maxLength={12}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,\s]/g, ""))}
      />
      <span className="w-14 sm:w-20 flex-shrink-0 text-[11px] sm:text-xs leading-tight text-gray-500">{unit}</span>
    </label>
  );
}
