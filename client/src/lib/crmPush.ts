import { getEspaceProApp } from "@/lib/espacePro";

// ─────────────────────────────────────────────────────────────────────────
// Notifications du CRM sur cet appareil (appli installée depuis Chrome, ou
// Safari sur iPhone). Le jeton de l'appareil est enregistré côté serveur par
// la fonction crmPushToken (functions/crmPush.js), avec les choix de
// notifications. Le service worker /crm-sw.js les affiche.
// ─────────────────────────────────────────────────────────────────────────
export type PushPrefs = { leads: boolean; rappels: boolean; tags: boolean; planning: boolean };
export const DEFAULT_PREFS: PushPrefs = { leads: true, rappels: true, tags: true, planning: true };
export const PUSH_KINDS: { key: keyof PushPrefs; label: string; hint: string }[] = [
  { key: "leads", label: "📥 Nouveaux leads", hint: "Site, formulaire Facebook…" },
  { key: "rappels", label: "⏰ Rappels", hint: "20 min avant un rappel qui vous est attribué" },
  { key: "tags", label: "💬 Quand on me tague", hint: "Avec @ dans une discussion" },
  { key: "planning", label: "🗓️ Planning du lendemain", hint: "Chaque soir à 19 h : pré-visites et poses" },
];

const LS_TOKEN = "crm-push-token";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export type PushSupport = "ok" | "ios-install" | "unsupported";
export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  }
  if (isIos() && !isStandalone()) return "ios-install";
  return "PushManager" in window ? "ok" : "unsupported";
}

async function call(data: Record<string, unknown>) {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const r = await httpsCallable(getFunctions(app, "europe-west9"), "crmPushToken")(data);
  return r.data as { ok: boolean; registered?: boolean; prefs?: PushPrefs };
}

const savedToken = () => {
  try {
    return localStorage.getItem(LS_TOKEN) || "";
  } catch {
    return "";
  }
};

export async function registerSw() {
  return navigator.serviceWorker.register("/crm-sw.js", { scope: "/" });
}

// État sur cet appareil : activé ou non, et choix enregistrés.
export async function pushStatus(): Promise<{ enabled: boolean; prefs: PushPrefs }> {
  const token = savedToken();
  if (!token || Notification.permission !== "granted") return { enabled: false, prefs: DEFAULT_PREFS };
  try {
    const r = await call({ action: "get", token });
    return { enabled: !!r.registered, prefs: r.prefs ?? DEFAULT_PREFS };
  } catch {
    return { enabled: false, prefs: DEFAULT_PREFS };
  }
}

// Demande l'autorisation, récupère le jeton de l'appareil et l'enregistre.
export async function enablePush(prefs: PushPrefs): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("refus");
  const reg = await registerSw();
  await navigator.serviceWorker.ready;
  const app = await getEspaceProApp();
  const m = await import("firebase/messaging");
  if (!(await m.isSupported())) throw new Error("unsupported");
  const token = await m.getToken(m.getMessaging(app), { serviceWorkerRegistration: reg });
  if (!token) throw new Error("token");
  const old = savedToken();
  if (old && old !== token) await call({ action: "unregister", token: old }).catch(() => {});
  try {
    localStorage.setItem(LS_TOKEN, token);
  } catch {
    /* non essentiel */
  }
  const device = `${isIos() ? "iPhone" : /android/i.test(navigator.userAgent) ? "Android" : "Ordinateur"}${isStandalone() ? " (appli)" : ""}`;
  await call({ action: "register", token, prefs, device });
}

export async function savePushPrefs(prefs: PushPrefs) {
  const token = savedToken();
  if (token) await call({ action: "prefs", token, prefs });
}

export async function disablePush() {
  const token = savedToken();
  if (token) await call({ action: "unregister", token }).catch(() => {});
  try {
    localStorage.removeItem(LS_TOKEN);
  } catch {
    /* non essentiel */
  }
}

export async function testPush() {
  const token = savedToken();
  if (token) await call({ action: "test", token });
}
