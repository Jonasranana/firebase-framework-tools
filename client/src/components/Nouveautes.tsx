import { useEffect, useState } from "react";
import { nouveautesPour, type Nouveaute } from "@/lib/nouveautes";

// Fenêtre « Quoi de neuf ? » : s'ouvre au chargement du CRM s'il y a des
// nouveautés que la personne n'a pas encore vues (mémorisé sur l'appareil).
// Les nouveautés de plus de 21 jours ne sont plus montrées.
const KEY = (email: string) => `crm-nouveautes-vues:${email.toLowerCase()}`;

export default function Nouveautes({ email }: { email: string }) {
  const [items, setItems] = useState<Nouveaute[]>([]);

  useEffect(() => {
    let vues: string[] = [];
    try {
      vues = JSON.parse(localStorage.getItem(KEY(email)) ?? "[]");
    } catch {}
    const limite = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
    setItems(nouveautesPour(email).filter((n) => !vues.includes(n.id) && n.date >= limite));
  }, [email]);

  if (!items.length) return null;
  const fermer = () => {
    try {
      const vues: string[] = JSON.parse(localStorage.getItem(KEY(email)) ?? "[]");
      localStorage.setItem(KEY(email), JSON.stringify(Array.from(new Set([...vues, ...items.map((n) => n.id)]))));
    } catch {}
    setItems([]);
  };
  const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Nouveautés du CRM">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="sticky top-0 bg-gradient-to-r from-[#173a5e] to-[#2b5a8f] text-white px-5 pt-5 pb-4">
          <p className="text-[12px] font-bold uppercase tracking-widest text-amber-200">Mise à jour</p>
          <h2 className="text-xl font-extrabold mt-0.5">✨ Quoi de neuf dans le CRM ?</h2>
        </div>
        <div className="px-5 py-4 space-y-5">
          {items.map((n) => (
            <section key={n.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{n.emoji}</span>
                <div>
                  <h3 className="font-extrabold text-gray-900 leading-snug">{n.titre}</h3>
                  <p className="text-[12px] text-gray-400 mt-0.5">{frDate(n.date)}</p>
                </div>
              </div>
              <ul className="mt-2 space-y-1.5 pl-1">
                {n.points.map((p, i) => (
                  <li key={i} className="text-[15px] text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-[#2b5a8f] font-bold">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button onClick={fermer} className="w-full rounded-2xl bg-[#173a5e] text-white font-bold py-3.5 text-[16px]">
            J'ai compris 👍
          </button>
        </div>
      </div>
    </div>
  );
}
