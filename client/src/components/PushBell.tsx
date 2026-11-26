import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotifsFeed from "@/components/NotifsFeed";
import { canUseIa, setIaFiches, useIaFiches } from "@/components/RelanceIA";
import { openNotifTarget, useNotifs } from "@/lib/crmNotifs";
import { DEFAULT_PREFS, PUSH_KINDS, disablePush, enablePush, pushStatus, pushSupport, savePushPrefs, testPush, type PushPrefs } from "@/lib/crmPush";

// Cloche de la barre du haut du CRM : la liste des notifications reçues (onglet « Notifications »,
// pastille rouge = non lues) et les réglages de cet appareil (onglet « Réglages », voir lib/crmPush.ts).
export default function PushBell({ onNavigate, email = "" }: { onNavigate?: (page: string) => void; email?: string }) {
  const iaFiches = useIaFiches();
  const [iaBusy, setIaBusy] = useState(false);
  const { unread } = useNotifs();
  const [open, setOpen] = useState(false);
  const [onglet, setOnglet] = useState<"liste" | "reglages">("liste");
  const support = pushSupport();
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (support !== "ok") return;
    pushStatus().then((s) => {
      setEnabled(s.enabled);
      setPrefs(s.prefs);
    });
  }, [support]);

  const activer = async () => {
    setBusy(true);
    setMsg("");
    try {
      await enablePush(prefs);
      setEnabled(true);
      await testPush().catch(() => {});
      setMsg("✅ Activé ! Une notification de test vient d'être envoyée.");
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      setMsg(
        m === "refus" || Notification.permission === "denied"
          ? "Notifications bloquées. Autorisez-les dans les réglages du navigateur (cadenas à côté de l'adresse → Notifications), puis réessayez."
          : "Impossible d'activer les notifications sur cet appareil. Réessayez dans un instant.",
      );
    } finally {
      setBusy(false);
    }
  };
  const changer = async (k: keyof PushPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    if (enabled) await savePushPrefs(next).catch(() => setMsg("Choix non enregistré, réessayez."));
  };
  const couper = async () => {
    setBusy(true);
    await disablePush();
    setEnabled(false);
    setBusy(false);
    setMsg("Notifications désactivées sur cet appareil.");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title="Notifications"
          className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
        >
          {enabled ? <BellRing size={17} /> : <Bell size={17} />}
          {unread > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-[10px] font-black leading-[18px] text-white ring-2 ring-white">{unread > 99 ? "99+" : unread}</span>
          ) : (
            !enabled && support !== "unsupported" && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[95vw] p-3 bg-white text-gray-900 border border-gray-200 shadow-xl space-y-3" dir="ltr">
        <div className="flex rounded-xl bg-gray-100 p-1">
          {([["liste", "🔔 Notifications"], ["reglages", "⚙️ Réglages"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setOnglet(k)} className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${onglet === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              {label}
            </button>
          ))}
        </div>
        {onglet === "liste" && (
          <NotifsFeed
            compact
            onOpen={(n) => {
              setOpen(false);
              openNotifTarget(n, onNavigate);
            }}
          />
        )}
        {onglet === "reglages" && (
        <>
        <div>
          <p className="font-extrabold">🔔 Notifications sur cet appareil</p>
          <p className="text-xs text-gray-500">Comme une vraie appli, même CRM fermé.</p>
        </div>

        {support === "ios-install" && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Sur iPhone : ouvrez <b>ip5energie.fr/admin</b> dans <b>Safari</b>, touchez <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>. Ouvrez le CRM depuis cette icône, puis revenez ici.
          </p>
        )}
        {support === "unsupported" && <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">Ce navigateur ne permet pas les notifications. Utilisez Chrome (Android, ordinateur) ou Safari (iPhone).</p>}

        {support === "ok" && (
          <>
            <div className="space-y-1.5">
              {PUSH_KINDS.map((k) => (
                <label key={k.key} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={prefs[k.key]} onChange={() => changer(k.key)} className="mt-1 h-4 w-4 accent-orange-500" />
                  <span>
                    <span className="block text-sm font-semibold">{k.label}</span>
                    <span className="block text-xs text-gray-500">{k.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {!enabled ? (
              <button onClick={activer} disabled={busy} className="w-full rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
                {busy ? "Activation…" : "Activer les notifications"}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => testPush().then(() => setMsg("Notification de test envoyée.")).catch(() => setMsg("Test impossible."))} className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                  Tester
                </button>
                <button onClick={couper} disabled={busy} className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Désactiver
                </button>
              </div>
            )}
          </>
        )}
        {msg && <p className="text-xs font-medium text-gray-700">{msg}</p>}
        {email && canUseIa(email) && (
          <div className="border-t border-gray-100 pt-3">
            <label className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={iaFiches}
                disabled={iaBusy}
                onChange={async (e) => {
                  setIaBusy(true);
                  try {
                    await setIaFiches(e.target.checked, email);
                  } catch {
                    setMsg("Impossible de changer le réglage de l'IA.");
                  } finally {
                    setIaBusy(false);
                  }
                }}
                className="mt-1 h-4 w-4 accent-violet-600"
              />
              <span>
                <span className="block text-sm font-semibold">🤖 Assistant IA dans les fiches</span>
                <span className="block text-xs text-gray-500">
                  Bouton « Analyser et planifier la relance » sous les messages, pour toute la direction. Coupé : les propositions déjà faites par l'IA restent dans les fiches.
                </span>
              </span>
            </label>
          </div>
        )}
        </>
        )}
      </PopoverContent>
    </Popover>
  );
}
