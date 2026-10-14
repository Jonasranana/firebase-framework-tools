import { useState } from "react";
import CorbeilleCRM from "./CorbeilleCRM";
import DoublonsCRM from "./DoublonsCRM";

// Un seul bouton du menu pour la corbeille de secours et la détection des doublons.
export default function CorbeilleEtDoublons({ email, onOpenLead }: { email: string; onOpenLead: (id: string) => void }) {
  const [tab, setTab] = useState<"corbeille" | "doublons">("corbeille");
  const btn = (k: typeof tab, label: string) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 text-sm font-semibold rounded-full border ${tab === k ? "bg-[#0073ea] text-white border-[#0073ea]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        {btn("corbeille", "🗑️ Corbeille")}
        {btn("doublons", "👥 Doublons")}
      </div>
      {tab === "corbeille" ? <CorbeilleCRM email={email} /> : <DoublonsCRM email={email} onOpenLead={onOpenLead} />}
    </div>
  );
}
