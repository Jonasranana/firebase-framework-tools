// Rappels : date (rappelLe, AAAA-MM-JJ) + heure exacte (fields.rappelHeure, HH:MM).
import { todayYmd } from "@/lib/crm";

export const RAPPEL_HEURE_KEY = "rappelHeure";

const p2 = (n: number) => String(n).padStart(2, "0");
export const ymdOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const dateOfYmd = (ymd: string) => new Date(`${ymd}T12:00:00`);

const hourLabel = (t: string) => {
  const [h, m] = t.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
};

// « demain à 17h », « aujourd'hui à 9h30 », « lundi 26 octobre à 14h », « 3 novembre » (sans heure).
export function rappelPhrase(ymd: string, time = ""): string {
  if (!ymd) return "";
  const d = dateOfYmd(ymd);
  const t0 = dateOfYmd(todayYmd());
  const diff = Math.round((d.getTime() - t0.getTime()) / 86400000);
  const day =
    diff === 0
      ? "aujourd'hui"
      : diff === 1
        ? "demain"
        : diff === -1
          ? "hier"
          : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return time ? `${day} à ${hourLabel(time)}` : day;
}

// Texte court pour la cellule du tableau : « Demain 17:00 », « Lun. 26 oct. 14:00 ».
export function rappelShort(ymd: string, time = ""): string {
  if (!ymd) return "";
  const d = dateOfYmd(ymd);
  const diff = Math.round((d.getTime() - dateOfYmd(todayYmd()).getTime()) / 86400000);
  const day =
    diff === 0
      ? "Aujourd'hui"
      : diff === 1
        ? "Demain"
        : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return time ? `${day} ${time}` : day;
}

// Rappel dépassé (date passée, ou aujourd'hui et heure passée) ; « aujourd'hui sans heure » compte comme à faire.
export function rappelEnRetard(ymd: string, time = "", now = new Date()): boolean {
  if (!ymd) return false;
  const today = ymdOf(now);
  if (ymd < today) return true;
  if (ymd > today) return false;
  if (!time) return true;
  return time <= `${p2(now.getHours())}:${p2(now.getMinutes())}`;
}

// Pour la discussion (la phrase reste vraie le lendemain) : « demain jeudi 23 octobre à 17h ».
export function rappelPhraseNote(ymd: string, time = ""): string {
  if (!ymd) return "";
  const d = dateOfYmd(ymd);
  const diff = Math.round((d.getTime() - dateOfYmd(todayYmd()).getTime()) / 86400000);
  const full = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const day = diff === 0 ? `aujourd'hui ${full}` : diff === 1 ? `demain ${full}` : full;
  return time ? `${day} à ${hourLabel(time)}` : day;
}
