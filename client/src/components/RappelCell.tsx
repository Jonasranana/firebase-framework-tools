import { useEffect, useState } from "react";
import { fr } from "date-fns/locale";
import { BellRing, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateOfYmd, rappelShort, ymdOf } from "@/lib/rappel";

const QUICK_HOURS = ["09:00", "11:00", "14:00", "16:00", "17:00", "18:00"];

// Sélecteur de rappel : calendrier du mois (les jours à venir d'abord) + heure exacte.
// Utilisé dans la cellule du tableau et dans la fiche.
export function RappelPicker({
  date,
  time,
  overdue,
  disabled,
  onSave,
  trigger,
}: {
  date: string;
  time: string;
  overdue?: boolean;
  disabled?: boolean;
  onSave: (date: string, time: string) => void;
  trigger?: "cell" | "field";
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Date | undefined>(date ? dateOfYmd(date) : undefined);
  const [t, setT] = useState(time || "");
  const [month, setMonth] = useState<Date>(date ? dateOfYmd(date) : new Date());

  useEffect(() => {
    if (open) {
      setD(date ? dateOfYmd(date) : undefined);
      setT(time || "");
      setMonth(date ? dateOfYmd(date) : new Date());
    }
  }, [open, date, time]);

  const pick = (x: Date) => {
    setD(x);
    setMonth(x);
  };
  const day = (n: number) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    return x;
  };
  const nextMonday = () => {
    const x = new Date();
    x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7));
    return x;
  };
  const chip = "text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-300";
  const label = date ? rappelShort(date, time) : "";

  const validate = () => {
    if (!d) return;
    onSave(ymdOf(d), t);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative group/rappel w-full h-full flex items-center">
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            title="Choisir le jour et l'heure du rappel"
            className={
              trigger === "field"
                ? "w-full text-left text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-orange-300"
                : `flex-1 h-full px-2 text-left text-xs hover:bg-gray-100 truncate ${
                    !date ? "text-gray-300" : overdue ? "text-red-600 font-semibold" : "text-gray-700 font-medium"
                  }`
            }
          >
            {label ? (
              <span className="inline-flex items-center gap-1">
                <BellRing size={12} className={overdue ? "text-red-500" : "text-orange-500"} /> {label}
              </span>
            ) : trigger === "field" ? (
              <span className="text-gray-400">Choisir jour et heure…</span>
            ) : (
              "—"
            )}
          </button>
        </PopoverTrigger>
        {date && !disabled && trigger !== "field" && (
          <button
            onClick={() => onSave("", "")}
            aria-label="Effacer le rappel"
            className="absolute right-1 z-10 text-gray-300 hover:text-red-500 opacity-0 group-hover/rappel:opacity-100 px-1"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto p-3 max-w-[96vw] bg-white text-gray-900 border border-gray-200 shadow-xl z-[60]">
        <div className="flex flex-wrap gap-1.5 mb-1">
          <button className={chip} onClick={() => pick(day(0))}>Aujourd'hui</button>
          <button className={chip} onClick={() => pick(day(1))}>Demain</button>
          <button className={chip} onClick={() => pick(day(2))}>Après-demain</button>
          <button className={chip} onClick={() => pick(nextMonday())}>Lundi</button>
        </div>
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={1}
          selected={d}
          onSelect={(x) => x && pick(x)}
          month={month}
          onMonthChange={setMonth}
          disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          className="p-1 bg-white text-gray-900"
        />
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500">Heure exacte</span>
            <input
              type="time"
              step={300}
              value={t}
              onChange={(e) => setT(e.target.value)}
              className="text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-2 py-1 [color-scheme:light]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_HOURS.map((h) => (
              <button
                key={h}
                onClick={() => setT(h)}
                className={`${chip} ${t === h ? "!bg-orange-500 !border-orange-500 !text-white" : ""}`}
              >
                {h.replace(":00", "h")}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                onSave("", "");
                setOpen(false);
              }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              Effacer
            </button>
            <button
              onClick={validate}
              disabled={!d}
              className="text-sm font-bold text-white px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 disabled:opacity-40"
            >
              Valider
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
