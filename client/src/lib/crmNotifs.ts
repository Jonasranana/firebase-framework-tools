import { useEffect, useState } from "react";
import { getEspaceProApp } from "@/lib/espacePro";

// ─────────────────────────────────────────────────────────────────────────
// Historique « 🔔 Notifs » du CRM (comme Facebook / LinkedIn) : les 60
// dernières notifications reçues par la personne connectée, lues via la
// fonction crmNotifs (functions/crmPush.js). Une seule lecture partagée par
// tout le CRM, rafraîchie chaque minute et au retour sur l'appli.
// ─────────────────────────────────────────────────────────────────────────
export type CrmNotif = {
  id: string;
  kind: "leads" | "rappels" | "messages" | "tags" | "planning" | string;
  title: string;
  body: string;
  url: string;
  by: string;
  leadId: string;
  at: string;
  read: boolean;
};

type State = { items: CrmNotif[]; unread: number; loaded: boolean };
let state: State = { items: [], unread: 0, loaded: false };
const listeners = new Set<(s: State) => void>();
const emit = (s: State) => {
  state = s;
  listeners.forEach((l) => l(s));
};

async function call(data: Record<string, unknown>) {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  return (await httpsCallable(getFunctions(app, "europe-west9"), "crmNotifs")(data)).data as { items?: CrmNotif[]; unread?: number };
}

let loading: Promise<void> | null = null;
export function refreshNotifs() {
  if (!loading) {
    loading = call({ action: "list" })
      .then((r) => emit({ items: r.items ?? [], unread: r.unread ?? 0, loaded: true }))
      .catch(() => emit({ ...state, loaded: true }))
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

export async function markNotifRead(id: string) {
  const items = state.items.map((n) => (n.id === id ? { ...n, read: true } : n));
  emit({ items, unread: items.filter((n) => !n.read).length, loaded: true });
  await call({ action: "read", id }).catch(() => {});
}

export async function markAllNotifsRead() {
  emit({ items: state.items.map((n) => ({ ...n, read: true })), unread: 0, loaded: true });
  await call({ action: "readAll" }).catch(() => {});
}

let timer: number | null = null;
export function useNotifs() {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    listeners.add(setS);
    if (!state.loaded) refreshNotifs();
    if (timer === null) {
      timer = window.setInterval(() => document.visibilityState === "visible" && refreshNotifs(), 60_000);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && refreshNotifs());
      // Une notification arrivée pendant que l'appli est ouverte : liste mise à jour tout de suite.
      navigator.serviceWorker?.addEventListener?.("message", (e) => e.data?.type === "crm-push" && refreshNotifs());
    }
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

// Heure exacte + « il y a … », comme sur les réseaux sociaux.
export function notifTime(iso: string) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jour = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const today = new Date().toDateString() === d.toDateString();
  const hier = new Date(Date.now() - 86400000).toDateString() === d.toDateString();
  const rel = min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : min < 24 * 60 ? `il y a ${Math.floor(min / 60)} h` : "";
  return today ? `${rel} · ${heure}` : hier ? `hier · ${heure}` : `${jour} · ${heure}`;
}

// Ouvre ce dont parle la notification : la fiche dans Pac Pac (ou le planning).
export function openNotifTarget(n: CrmNotif, navigate?: (page: string) => void) {
  if (n.leadId) {
    try {
      sessionStorage.setItem("crm-open-lead", n.leadId);
    } catch {
      /* non essentiel */
    }
    window.dispatchEvent(new CustomEvent("crm-open-lead", { detail: { id: n.leadId, updates: n.kind === "messages" || n.kind === "tags" } }));
    navigate?.("leads");
  } else if (n.url.includes("#planning")) {
    navigate?.("planning");
  }
}
