import { CheckCircle2, Circle, Clock, Phone, FileCheck2, FileWarning } from "lucide-react";
import type { ClientView } from "@/lib/clientSpace";

const ymd = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

// Tableau de bord du client : où en est son dossier, ce qu'on attend de lui, qui le suit.
export default function ClientSpaceDashboard({ view }: { view: ClientView }) {
  return (
    <div dir="ltr" className="max-w-2xl mx-auto space-y-5 text-slate-800">
      <div>
        <p className="text-sm font-semibold text-[#2b5a8f]">Votre espace IP5 Énergie</p>
        <h2 className="text-2xl font-bold text-[#0f2a47]">Bonjour {view.prenom || ""}, voici où en est votre projet</h2>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-5">
          <div className="h-full bg-[#173a5e]" style={{ width: `${((view.currentIndex + 1) / view.stages.length) * 100}%` }} />
        </div>
        <ol className="space-y-4">
          {view.stages.map((s) => (
            <li key={s.key} className="flex gap-3">
              {s.state === "done" ? (
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={22} />
              ) : s.state === "current" ? (
                <Clock className="text-[#2b5a8f] shrink-0 mt-0.5" size={22} />
              ) : (
                <Circle className="text-slate-300 shrink-0 mt-0.5" size={22} />
              )}
              <div className={s.state === "todo" ? "opacity-60" : ""}>
                <p className="font-semibold text-[#0f2a47]">
                  {s.label}
                  {s.state === "current" && <span className="ml-2 text-xs font-bold text-[#2b5a8f] bg-blue-50 rounded px-1.5 py-0.5">En cours</span>}
                </p>
                <p className="text-sm text-slate-600">{s.text}</p>
                {s.date && <p className="text-sm font-semibold text-[#173a5e] mt-0.5">Date prévue : {ymd(s.date)}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-[#173a5e] text-white rounded-xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">Prochaine étape</p>
        <p className="font-medium">{view.nextStep}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="font-semibold text-[#0f2a47] mb-3">Vos documents</p>
        <ul className="space-y-2">
          {view.pieces.map((p) => (
            <li key={p.label} className="flex items-center gap-2 text-sm">
              {p.ok ? <FileCheck2 size={18} className="text-emerald-600" /> : <FileWarning size={18} className="text-amber-500" />}
              <span className={p.ok ? "text-slate-700" : "text-slate-800 font-medium"}>{p.label}</span>
              <span className={`ml-auto text-xs font-semibold ${p.ok ? "text-emerald-700" : "text-amber-600"}`}>{p.ok ? "Reçu" : "À transmettre"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
        <span className="w-11 h-11 rounded-full bg-blue-50 text-[#2b5a8f] flex items-center justify-center shrink-0">
          <Phone size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#0f2a47]">{view.conseiller ? `Votre conseiller : ${view.conseiller}` : "Une question ?"}</p>
          <p className="text-sm text-slate-600">
            Appelez-nous au{" "}
            <a href="tel:+33749525267" className="font-semibold text-[#173a5e]">
              07 49 52 52 67
            </a>{" "}
            ou{" "}
            <a href="tel:+33695920409" className="font-semibold text-[#173a5e]">
              06 95 92 04 09
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
