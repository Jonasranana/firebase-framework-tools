import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  Search,
  Plus,
  Loader2,
  BellRing,
  Check,
  X,
  Send,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getEspaceProApp } from "@/lib/espacePro";
import { ARTISAN_GRID_SECTIONS, TRAVEL_FIELDS } from "@/lib/artisanGrid";
import {
  ARTISAN_STATUSES,
  CRM_ARTISANS_COLLECTION,
  artisanFromDoc,
  artisanStatusInfo,
  formatDateTime,
  formatPhone,
  formatShortDate,
  formatYmd,
  telHref,
  todayYmd,
  whatsappHref,
  type Artisan,
  type ArtisanStatus,
  type LeadNote,
} from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Onglet Artisans — pipeline de recrutement des poseurs partenaires (étape 5
// du CRM maison). Données : collection Firestore crm_artisans, alimentée par
// l'import Monday, par les grilles reçues sur /espace-pro et par la saisie
// manuelle. Les mails « Proposition / Relance / Dernier message / Après
// appel » passent par la fonction sendArtisanMessage.
// ─────────────────────────────────────────────────────────────────────────

const newId = () => Math.random().toString(36).slice(2, 10);
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const MAIL_TEMPLATES = [
  { key: "proposition", label: "Proposition (mail de présentation)" },
  { key: "relance", label: "Relance" },
  { key: "dernier message", label: "Dernier message" },
  { key: "mail apres appel", label: "Mail après appel" },
] as const;

async function fs() {
  const app = await getEspaceProApp();
  const m = await import("firebase/firestore");
  return { m, db: m.getFirestore(app) };
}

async function patchArtisan(id: string, email: string, patch: Record<string, unknown>) {
  const { m, db } = await fs();
  await m.updateDoc(m.doc(db, CRM_ARTISANS_COLLECTION, id), {
    ...patch,
    updatedAt: m.serverTimestamp(),
    updatedBy: email,
  });
}

const inputCls =
  "w-full text-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f]";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    {children}
  </label>
);

const StatusBadge = ({ status }: { status: ArtisanStatus }) => {
  const s = artisanStatusInfo(status);
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.badge}`}>
      {s.label}
    </span>
  );
};

const isDue = (a: Artisan) =>
  !!a.relanceLe && a.relanceLe <= todayYmd() && !["signe", "dead"].includes(a.status);

// ── Grille de prix reçue ───────────────────────────────────────────────────
const GrilleView = ({ grille }: { grille: NonNullable<Artisan["grille"]> }) => {
  const [open, setOpen] = useState(false);
  const rows = ARTISAN_GRID_SECTIONS.map((s) => ({
    title: s.title,
    lines: s.lines.filter((l) => grille.prices[l.id]),
  })).filter((s) => s.lines.length);
  return (
    <div className="bg-blue-50 rounded-xl p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-bold text-[#2b5a8f]"
      >
        Grille de prix de pose ({Object.keys(grille.prices).length} tarifs)
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-xs text-gray-700">
          {TRAVEL_FIELDS.filter((f) => grille.travel[f.id]).map((f) => (
            <p key={f.id}>
              {f.label} : <b>{grille.travel[f.id]} {f.unit}</b>
            </p>
          ))}
          {rows.map((s) => (
            <div key={s.title}>
              <p className="font-bold text-gray-800">{s.title}</p>
              {s.lines.map((l) => (
                <p key={l.id} className="flex justify-between gap-2">
                  <span>{l.label}</span>
                  <b>{grille.prices[l.id]} {l.unit}</b>
                </p>
              ))}
            </div>
          ))}
          {grille.comment && <p className="italic">« {grille.comment} »</p>}
          {grille.submittedAt && (
            <p className="text-gray-400">Reçue le {formatDateTime(grille.submittedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Envoi de mail ──────────────────────────────────────────────────────────
const MailSender = ({ artisan }: { artisan: Artisan }) => {
  const [tpl, setTpl] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    const label = MAIL_TEMPLATES.find((t) => t.key === tpl)?.label;
    if (!confirm(`Envoyer « ${label} » à ${artisan.email} ?`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const app = await getEspaceProApp();
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      await httpsCallable(getFunctions(app, "europe-west9"), "sendArtisanMessage")({
        artisanId: artisan.id,
        template: tpl,
      });
      setFeedback({ ok: true, text: "Mail envoyé." });
      setTpl("");
    } catch (e: any) {
      console.error(e);
      setFeedback({ ok: false, text: e?.message || "Échec de l'envoi." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-3 border-t border-gray-100 space-y-2">
      <span className="block text-xs font-semibold text-gray-600">Envoyer un mail</span>
      <select value={tpl} onChange={(e) => setTpl(e.target.value)} className={inputCls}>
        <option value="">Modèle…</option>
        {MAIL_TEMPLATES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        onClick={send}
        disabled={!tpl || !artisan.email || busy}
        title={!artisan.email ? "Pas d'adresse e-mail" : undefined}
        className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl py-2.5"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Envoyer le mail
      </button>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-green-600" : "text-red-600"}`}>{feedback.text}</p>
      )}
    </div>
  );
};

// ── Fiche artisan ──────────────────────────────────────────────────────────
type Draft = { name: string; telephone: string; email: string; siret: string; ville: string; zone: string };
const draftOf = (a?: Artisan): Draft => ({
  name: a?.name ?? "",
  telephone: a?.telephone ?? "",
  email: a?.email ?? "",
  siret: a?.siret ?? "",
  ville: a?.ville ?? "",
  zone: a?.zone ?? "",
});

const ArtisanSheet = ({
  artisan,
  creating,
  email,
  onClose,
}: {
  artisan: Artisan | null;
  creating: boolean;
  email: string;
  onClose: () => void;
}) => {
  const open = creating || !!artisan;
  const [draft, setDraft] = useState<Draft>(draftOf(artisan ?? undefined));
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const id = artisan?.id;
  useEffect(() => {
    setDraft(draftOf(artisan ?? undefined));
    setNoteText("");
    setError("");
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, creating]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const dirty = creating
    ? true
    : artisan
      ? (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== draftOf(artisan)[k])
      : false;

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(fail);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () =>
    run(async () => {
      const clean = Object.fromEntries(
        Object.entries(draft).map(([k, v]) => [k, v.trim()]),
      ) as Draft;
      clean.email = clean.email.toLowerCase();
      if (!clean.name) throw new Error("nom requis");
      if (creating) {
        const { m, db } = await fs();
        await m.addDoc(m.collection(db, CRM_ARTISANS_COLLECTION), {
          ...clean,
          status: "a_contacter",
          relanceLe: "",
          rgeVerifie: false,
          grille: null,
          notes: [],
          source: "saisie-manuelle",
          createdAt: m.serverTimestamp(),
          updatedAt: m.serverTimestamp(),
          updatedBy: email,
        });
        onClose();
      } else if (artisan) {
        await patchArtisan(artisan.id, email, clean);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    }, "Échec de l'enregistrement (le nom est obligatoire).");

  const changeStatus = (status: ArtisanStatus) => {
    if (!artisan || status === artisan.status) return;
    run(async () => {
      const { m } = await fs();
      await patchArtisan(artisan.id, email, {
        status,
        notes: m.arrayUnion({
          id: newId(),
          text: `${artisanStatusInfo(artisan.status).label} → ${artisanStatusInfo(status).label}`,
          by: email,
          at: new Date().toISOString(),
          kind: "statut",
        } satisfies LeadNote),
      });
    }, "Impossible de changer le statut.");
  };

  const addNote = () => {
    const text = noteText.trim();
    if (!artisan || !text) return;
    run(async () => {
      const { m } = await fs();
      await patchArtisan(artisan.id, email, {
        notes: m.arrayUnion({ id: newId(), text, by: email, at: new Date().toISOString(), kind: "note" } satisfies LeadNote),
      });
      setNoteText("");
    }, "Impossible d'ajouter la note.");
  };

  const tel = artisan ? telHref(artisan.telephone) : "";
  const notes = artisan ? [...artisan.notes].sort((a, b) => (a.at < b.at ? 1 : -1)) : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" dir="ltr">
        <SheetHeader className="text-left">
          <SheetTitle>{creating ? "Nouvel artisan" : artisan?.name || "Fiche artisan"}</SheetTitle>
          <SheetDescription>
            {creating
              ? "Saisie manuelle d'un artisan."
              : artisan
                ? `Ajouté le ${formatDateTime(artisan.createdAt)}${artisan.source ? ` · ${artisan.source}` : ""}`
                : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {artisan && (
            <div className="flex flex-wrap gap-2">
              {tel && (
                <a href={tel} className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-4 py-2 rounded-full">
                  <Phone size={14} /> Appeler
                </a>
              )}
              {tel && (
                <a
                  href={whatsappHref(artisan.telephone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-full"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              )}
              {artisan.email && (
                <a href={`mailto:${artisan.email}`} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-bold px-4 py-2 rounded-full">
                  <Mail size={14} /> Mail
                </a>
              )}
            </div>
          )}

          {artisan && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Statut">
                  <select
                    value={artisan.status}
                    disabled={busy}
                    onChange={(e) => changeStatus(e.target.value as ArtisanStatus)}
                    className={inputCls}
                  >
                    {ARTISAN_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prochaine relance">
                  <input
                    type="date"
                    value={artisan.relanceLe}
                    disabled={busy}
                    onChange={(e) => run(() => patchArtisan(artisan.id, email, { relanceLe: e.target.value }), "Impossible d'enregistrer la relance.")}
                    className={inputCls}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={artisan.rgeVerifie}
                  disabled={busy}
                  onChange={(e) => run(() => patchArtisan(artisan.id, email, { rgeVerifie: e.target.checked }), "Impossible d'enregistrer.")}
                />
                <ShieldCheck size={15} className="text-green-600" /> RGE + décennale vérifiés
              </label>
            </>
          )}

          <div className="space-y-3">
            <Field label="Nom / société">
              <input value={draft.name} onChange={set("name")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone">
                <input type="tel" value={draft.telephone} onChange={set("telephone")} className={inputCls} />
              </Field>
              <Field label="E-mail">
                <input type="email" value={draft.email} onChange={set("email")} className={inputCls} />
              </Field>
              <Field label="Ville">
                <input value={draft.ville} onChange={set("ville")} className={inputCls} />
              </Field>
              <Field label="Zone">
                <input value={draft.zone} onChange={set("zone")} className={inputCls} />
              </Field>
            </div>
            <Field label="SIRET">
              <input value={draft.siret} onChange={set("siret")} className={inputCls} />
            </Field>
            <button
              onClick={saveDraft}
              disabled={!dirty || busy}
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl py-2.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
              {creating ? "Créer l'artisan" : saved ? "Enregistré" : "Enregistrer les infos"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {artisan?.grille && <GrilleView grille={artisan.grille} />}
          {artisan?.mondayUrl && (
            <a href={artisan.mondayUrl} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-[#2b5a8f]">
              Voir la fiche Monday d'origine
            </a>
          )}

          {artisan && <MailSender key={artisan.id} artisan={artisan} />}

          {artisan && (
            <div className="pt-3 border-t border-gray-100">
              <span className="block text-xs font-semibold text-gray-600 mb-2">Notes et historique</span>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Résumé de l'appel, prochaine étape…"
                className={`${inputCls} resize-none`}
              />
              <button
                onClick={addNote}
                disabled={!noteText.trim() || busy}
                className="mt-2 w-full text-sm font-bold text-[#2b5a8f] border-2 border-[#2b5a8f] disabled:opacity-40 rounded-xl py-2"
              >
                Ajouter la note
              </button>
              <ul className="mt-3 space-y-2">
                {notes.length === 0 && <li className="text-xs text-gray-400">Aucune note pour l'instant.</li>}
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      n.kind === "statut"
                        ? "bg-gray-50 text-gray-500 text-xs"
                        : n.kind === "message"
                          ? "bg-green-50 text-gray-700"
                          : "bg-blue-50 text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{n.text}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDateTime(n.at)} · {n.by}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function ArtisansCRM({ email }: { email: string }) {
  const [artisans, setArtisans] = useState<Artisan[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ArtisanStatus>("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [relancesOnly, setRelancesOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await fs();
        unsub = m.onSnapshot(
          m.query(m.collection(db, CRM_ARTISANS_COLLECTION), m.orderBy("createdAt", "desc")),
          (snap) => {
            if (cancelled) return;
            setArtisans(snap.docs.map((d) => artisanFromDoc(d.id, d.data())));
            setError("");
          },
          (e) => {
            console.error(e);
            setError("Impossible de charger les artisans. Vérifiez que vous êtes autorisé, puis rechargez la page.");
          },
        );
      } catch (e) {
        console.error(e);
        setError("Impossible de se connecter à la base de données.");
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const zones = useMemo(
    () => Array.from(new Set((artisans ?? []).map((a) => a.zone).filter(Boolean))).sort(),
    [artisans],
  );

  const baseFiltered = useMemo(() => {
    const q = normalize(query.trim());
    return (artisans ?? []).filter((a) => {
      if (zoneFilter && a.zone !== zoneFilter) return false;
      if (relancesOnly && !isDue(a)) return false;
      if (!q) return true;
      const qd = q.replace(/\D/g, "");
      if (qd.length >= 3 && a.telephone.replace(/\D/g, "").includes(qd)) return true;
      return normalize([a.name, a.email, a.ville, a.zone, a.siret].join(" ")).includes(q);
    });
  }, [artisans, query, zoneFilter, relancesOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of baseFiltered) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [baseFiltered]);

  const filtered = statusFilter ? baseFiltered.filter((a) => a.status === statusFilter) : baseFiltered;
  const dueCount = useMemo(() => (artisans ?? []).filter(isDue).length, [artisans]);
  const open = artisans?.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, ville, zone, SIRET, téléphone…)"
            className="w-full text-sm bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 outline-none focus:border-[#2b5a8f]"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-4 rounded-2xl"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-3 py-1.5 max-w-[12rem]"
        >
          <option value="">Toutes zones</option>
          {zones.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
        <button
          onClick={() => setRelancesOnly((v) => !v)}
          className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border ${
            relancesOnly ? "bg-red-100 text-red-700 border-red-200" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          <BellRing size={12} /> Relances{dueCount ? ` (${dueCount})` : ""}
        </button>
        {(query || statusFilter || zoneFilter || relancesOnly) && (
          <button
            onClick={() => {
              setQuery("");
              setStatusFilter("");
              setZoneFilter("");
              setRelancesOnly(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500"
          >
            <X size={12} /> Effacer
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        <button
          onClick={() => setStatusFilter("")}
          className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${
            !statusFilter ? "bg-[#2b5a8f] text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          Tous ({baseFiltered.length})
        </button>
        {ARTISAN_STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? "" : s.key)}
            className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
              statusFilter === s.key ? "bg-[#2b5a8f] text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            {s.label} ({counts[s.key] ?? 0})
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!artisans && !error && (
        <div className="py-10 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={24} />
          Chargement…
        </div>
      )}
      {artisans && artisans.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-10">
          Aucun artisan pour l'instant. Importez ceux de Monday, ou ajoutez-en un avec « Nouveau ».
        </p>
      )}

      <div className="grid gap-2.5 md:grid-cols-2">
        {filtered.map((a) => (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpenId(a.id)}
            onKeyDown={(e) => e.key === "Enter" && setOpenId(a.id)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-[#2b5a8f]/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{a.name || "Sans nom"}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[a.telephone && formatPhone(a.telephone), a.ville, a.zone].filter(Boolean).join(" · ")}
                </p>
              </div>
              {telHref(a.telephone) && (
                <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <a href={telHref(a.telephone)} aria-label={`Appeler ${a.name}`} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#2b5a8f] text-white">
                    <Phone size={14} />
                  </a>
                  <a href={whatsappHref(a.telephone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${a.name}`} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-green-500 text-white">
                    <MessageCircle size={14} />
                  </a>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <StatusBadge status={a.status} />
              {a.rgeVerifie && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                  <ShieldCheck size={10} /> RGE
                </span>
              )}
              {a.relanceLe && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isDue(a) ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <BellRing size={10} /> {formatYmd(a.relanceLe).slice(0, 5)}
                </span>
              )}
              <span className="ml-auto text-[11px] text-gray-400">{formatShortDate(a.createdAt)}</span>
            </div>
          </div>
        ))}
        {artisans && artisans.length > 0 && filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8 md:col-span-2">
            Aucun artisan ne correspond aux filtres.
          </p>
        )}
      </div>

      <ArtisanSheet
        artisan={open}
        creating={creating}
        email={email}
        onClose={() => {
          setOpenId(null);
          setCreating(false);
        }}
      />
    </div>
  );
}
