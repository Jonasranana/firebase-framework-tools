import { useEffect, useRef, useState } from "react";
import { crmFirestore } from "@/lib/crmDb";
import { LEAD_COLUMNS, MONEY_COLUMN_KEYS, applyColumnsConfig, colDaysLeft, type ColTrashEntry, type ColType, type ColumnsConfig, type LeadColumn } from "@/lib/crmColumns";
import { TOTALS_VIEWERS, type Opt } from "@/lib/crm";

// Colonnes du tableau Leads modifiables depuis le menu du titre de colonne
// (comme Monday) : ajouter une colonne à droite avec son type, renommer,
// dupliquer, changer le type, réduire, retour à la ligne, supprimer.
// Configuration partagée : Firestore crm_boards/leads_columns.
export const ADD_TYPES: { type: ColType; label: string; color: string; letter: string }[] = [
  { type: "status", label: "Statut", color: "#00c875", letter: "≡" },
  { type: "text", label: "Texte", color: "#fdab3d", letter: "T" },
  { type: "people", label: "Personnes", color: "#579bfc", letter: "☺" },
  { type: "timeline", label: "Échéances", color: "#9d50dd", letter: "▭" },
  { type: "date", label: "Date", color: "#9d50dd", letter: "▦" },
  { type: "tags", label: "Hashtags", color: "#00c875", letter: "#" },
  { type: "number", label: "Chiffres", color: "#fdab3d", letter: "#" },
  { type: "filecol", label: "Fichiers", color: "#ff642e", letter: "📎" },
];

export const DEFAULT_STATUS_OPTIONS: Opt[] = [
  { key: "en_cours", label: "En cours", hex: "#fdab3d" },
  { key: "termine", label: "Terminé", hex: "#00c875" },
  { key: "bloque", label: "Bloqué", hex: "#df2f4a" },
];

const WIDTHS: Partial<Record<ColType, number>> = { status: 150, text: 180, people: 150, timeline: 210, date: 130, tags: 170, number: 110, filecol: 130 };

export const CUSTOM_TYPES: ColType[] = ["status", "text", "people", "timeline", "date", "tags", "number"];

// Pac Pac garde son document d'origine ; chaque autre tableau a le sien (crm_boards/<tableau>_columns).
const columnsDocId = (boardId: string) => (boardId === "leads" ? "leads_columns" : `${boardId}_columns`);

// Corbeille des colonnes : fonctions pures sur la configuration (utilisées par le tableau et par la page Corbeille).
export function trashColumn(cfg: ColumnsConfig, col: LeadColumn, kind: ColTrashEntry["kind"], order: string[]): ColumnsConfig {
  const isCustom = (cfg.custom ?? []).some((c) => c.key === col.key);
  const entry: ColTrashEntry = {
    key: col.key,
    title: col.title,
    kind,
    at: new Date().toISOString(),
    after: order[order.indexOf(col.key) - 1],
    ...(isCustom ? { col: JSON.parse(JSON.stringify((cfg.custom ?? []).find((c) => c.key === col.key))) } : {}),
  };
  return {
    ...cfg,
    order: order.filter((k) => k !== col.key),
    custom: isCustom ? (cfg.custom ?? []).filter((c) => c.key !== col.key) : cfg.custom,
    deleted: isCustom ? cfg.deleted : [...(cfg.deleted ?? []).filter((k) => k !== col.key), col.key],
    colTrash: [...(cfg.colTrash ?? []).filter((e) => e.key !== col.key), entry],
  };
}

export function restoreColumn(cfg: ColumnsConfig, key: string): ColumnsConfig {
  const e = (cfg.colTrash ?? []).find((x) => x.key === key);
  if (!e) return cfg;
  const order = [...(cfg.order ?? [])].filter((k) => k !== key);
  const at = e.after ? order.indexOf(e.after) : -1;
  if (order.length) order.splice(at >= 0 ? at + 1 : order.length, 0, key);
  return {
    ...cfg,
    order: order.length ? order : cfg.order,
    custom: e.col ? [...(cfg.custom ?? []).filter((c) => c.key !== key), e.col] : cfg.custom,
    deleted: (cfg.deleted ?? []).filter((k) => k !== key),
    colTrash: (cfg.colTrash ?? []).filter((x) => x.key !== key),
  };
}

// Suppression définitive : la colonne quitte la corbeille. Ses valeurs restent dans les fiches (invisibles).
export const purgeColumn = (cfg: ColumnsConfig, key: string): ColumnsConfig => ({ ...cfg, colTrash: (cfg.colTrash ?? []).filter((e) => e.key !== key) });
export const expiredColumns = (cfg: ColumnsConfig) => (cfg.colTrash ?? []).filter((e) => colDaysLeft(e) <= 0);

export function useColumnsConfig(email: string, boardId = "leads") {
  const [config, setConfig] = useState<ColumnsConfig>({});
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  // Vrai dès que la configuration des colonnes de ce tableau est lue (ou illisible) : évite d'afficher le tableau
  // avec les colonnes d'origine puis de le redessiner une seconde plus tard.
  const [ready, setReady] = useState(false);
  const ref = useRef<ColumnsConfig>({});
  ref.current = config;
  // Les colonnes d'argent ne sont montrées qu'aux administrateurs ; un autre compte qui enregistre l'ordre des colonnes
  // ne doit pas les faire sortir de leur place pour les administrateurs.
  const canSeeMoney = TOTALS_VIEWERS.includes(email.toLowerCase());

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, "crm_boards", columnsDocId(boardId)),
          (snap) => {
            if (cancelled) return;
            let c = (snap.data()?.config as ColumnsConfig | undefined) ?? {};
            // Colonnes restées trop longtemps en corbeille : retirées pour de bon (leurs valeurs restent dans les fiches).
            const old = expiredColumns(c);
            if (old.length) {
              c = old.reduce((acc, e) => purgeColumn(acc, e.key), c);
              m.setDoc(snap.ref, { config: JSON.parse(JSON.stringify(c)), updatedAt: m.serverTimestamp(), updatedBy: email }).catch(() => {});
            }
            applyColumnsConfig(c, boardId, canSeeMoney);
            setConfig(c);
            setVersion((v) => v + 1);
            setReady(true);
          },
          () => !cancelled && setReady(true),
        );
      } catch {
        /* colonnes d'origine seulement */
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [boardId]);

  const save = async (nextIn: ColumnsConfig) => {
    const previous = ref.current;
    let next = nextIn;
    if (!canSeeMoney && next.order && previous.order) {
      const order = [...next.order];
      previous.order.forEach((k, i) => {
        if (!MONEY_COLUMN_KEYS.includes(k) || order.includes(k)) return;
        const before = previous.order![i - 1];
        const at = before ? order.indexOf(before) : -1;
        order.splice(at >= 0 ? at + 1 : order.length, 0, k);
      });
      next = { ...next, order };
    }
    applyColumnsConfig(next, boardId, canSeeMoney);
    setConfig(next);
    setVersion((v) => v + 1);
    try {
      const { m, db } = await crmFirestore();
      // Firestore refuse les valeurs « undefined » (ex. options d'une colonne texte, nombre, date, fichiers) :
      // on les retire avant l'envoi, sinon l'ajout ou le changement de type d'une colonne échoue.
      const clean = JSON.parse(JSON.stringify(next)) as ColumnsConfig;
      await m.setDoc(m.doc(db, "crm_boards", columnsDocId(boardId)), { config: clean, updatedAt: m.serverTimestamp(), updatedBy: email });
      setError("");
    } catch (e) {
      console.error(e);
      applyColumnsConfig(previous, boardId, canSeeMoney);
      setConfig(previous);
      setVersion((v) => v + 1);
      setError("Impossible d'enregistrer les colonnes (règle Firestore crm_boards ?).");
    }
  };

  const currentOrder = () => LEAD_COLUMNS.map((c) => c.key);

  const api = {
    addAfter(afterKey: string, type: ColType, title?: string): LeadColumn {
      const label = ADD_TYPES.find((t) => t.type === type)?.label ?? "Colonne";
      const col: LeadColumn = {
        key: `c_${Math.random().toString(36).slice(2, 8)}`,
        title: title ?? label,
        type,
        width: WIDTHS[type] ?? 150,
        custom: true,
        options: type === "status" ? DEFAULT_STATUS_OPTIONS : undefined,
      };
      const order = currentOrder();
      order.splice(order.indexOf(afterKey) + 1, 0, col.key);
      save({ ...ref.current, custom: [...(ref.current.custom ?? []), col], order });
      return col;
    },
    // Déplace une colonne à la place d'une autre (glisser-déposer de l'en-tête).
    move(key: string, targetKey: string) {
      if (key === targetKey || key === "name") return;
      const order = currentOrder();
      const from = order.indexOf(key);
      const to = order.indexOf(targetKey);
      if (from < 0 || to < 0) return;
      order.splice(from, 1);
      order.splice(to, 0, key);
      // Le nom reste toujours la première colonne.
      save({ ...ref.current, order: ["name", ...order.filter((k) => k !== "name")] });
    },
    // Décale une colonne d'un cran vers la gauche (-1) ou la droite (+1).
    moveBy(key: string, delta: number) {
      if (key === "name") return;
      const order = currentOrder();
      const from = order.indexOf(key);
      const to = Math.max(1, Math.min(order.length - 1, from + delta));
      if (from < 0 || to === from) return;
      order.splice(from, 1);
      order.splice(to, 0, key);
      save({ ...ref.current, order: ["name", ...order.filter((k) => k !== "name")] });
    },
    rename(key: string, title: string) {
      const custom = (ref.current.custom ?? []).map((c) => (c.key === key ? { ...c, title } : c));
      save({ ...ref.current, custom, titles: { ...(ref.current.titles ?? {}), [key]: title } });
    },
    setWidth(key: string, width: number) {
      save({ ...ref.current, widths: { ...(ref.current.widths ?? {}), [key]: Math.round(width) } });
    },
    setWrap(key: string, on: boolean) {
      save({ ...ref.current, wrap: { ...(ref.current.wrap ?? {}), [key]: on } });
    },
    setCollapsed(key: string, on: boolean) {
      save({ ...ref.current, collapsed: { ...(ref.current.collapsed ?? {}), [key]: on } });
    },
    setType(key: string, type: ColType) {
      save({
        ...ref.current,
        custom: (ref.current.custom ?? []).map((c) =>
          c.key === key ? { ...c, type, width: WIDTHS[type] ?? c.width, options: type === "status" ? c.options ?? DEFAULT_STATUS_OPTIONS : undefined } : c,
        ),
      });
    },
    setOptions(key: string, options: Opt[]) {
      const isCustom = (ref.current.custom ?? []).some((c) => c.key === key);
      save(
        isCustom
          ? { ...ref.current, custom: (ref.current.custom ?? []).map((c) => (c.key === key ? { ...c, options } : c)) }
          : { ...ref.current, options: { ...(ref.current.options ?? {}), [key]: options } },
      );
    },
    // Supprimer (30 jours en corbeille) ou archiver (60 jours) : la colonne est masquée, pas détruite.
    remove(key: string, kind: ColTrashEntry["kind"] = "delete") {
      const col = LEAD_COLUMNS.find((c) => c.key === key);
      if (!col || key === "name") return;
      save(trashColumn(ref.current, col, kind, currentOrder()));
    },
  };

  return { config, version, api, error, ready };
}
