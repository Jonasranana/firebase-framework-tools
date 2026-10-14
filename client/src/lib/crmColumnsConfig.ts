import { useEffect, useRef, useState } from "react";
import { crmFirestore } from "@/lib/crmDb";
import { LEAD_COLUMNS, applyColumnsConfig, type ColType, type ColumnsConfig, type LeadColumn } from "@/lib/crmColumns";
import type { Opt } from "@/lib/crm";

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
];

export const DEFAULT_STATUS_OPTIONS: Opt[] = [
  { key: "en_cours", label: "En cours", hex: "#fdab3d" },
  { key: "termine", label: "Terminé", hex: "#00c875" },
  { key: "bloque", label: "Bloqué", hex: "#df2f4a" },
];

const WIDTHS: Partial<Record<ColType, number>> = { status: 150, text: 180, people: 150, timeline: 210, date: 130, tags: 170, number: 110 };

export const CUSTOM_TYPES: ColType[] = ["status", "text", "people", "timeline", "date", "tags", "number"];

export function useColumnsConfig(email: string) {
  const [config, setConfig] = useState<ColumnsConfig>({});
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const ref = useRef<ColumnsConfig>({});
  ref.current = config;

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, "crm_boards", "leads_columns"),
          (snap) => {
            if (cancelled) return;
            const c = (snap.data()?.config as ColumnsConfig | undefined) ?? {};
            applyColumnsConfig(c);
            setConfig(c);
            setVersion((v) => v + 1);
          },
          () => {},
        );
      } catch {
        /* colonnes d'origine seulement */
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const save = async (next: ColumnsConfig) => {
    const previous = ref.current;
    applyColumnsConfig(next);
    setConfig(next);
    setVersion((v) => v + 1);
    try {
      const { m, db } = await crmFirestore();
      await m.setDoc(m.doc(db, "crm_boards", "leads_columns"), { config: next, updatedAt: m.serverTimestamp(), updatedBy: email });
      setError("");
    } catch (e) {
      console.error(e);
      applyColumnsConfig(previous);
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
    rename(key: string, title: string) {
      const custom = (ref.current.custom ?? []).map((c) => (c.key === key ? { ...c, title } : c));
      save({ ...ref.current, custom, titles: { ...(ref.current.titles ?? {}), [key]: title } });
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
    remove(key: string) {
      const order = currentOrder().filter((k) => k !== key);
      const isCustom = (ref.current.custom ?? []).some((c) => c.key === key);
      save({
        ...ref.current,
        order,
        custom: isCustom ? (ref.current.custom ?? []).filter((c) => c.key !== key) : ref.current.custom,
        deleted: isCustom ? ref.current.deleted : [...(ref.current.deleted ?? []), key],
      });
    },
  };

  return { config, version, api, error };
}
