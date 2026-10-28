// Fichier calendrier (.ics) : s'ouvre dans l'agenda de l'iPhone ou d'Android et ajoute les rappels avec une alarme.
// Les heures sont « locales » (sans fuseau) : elles s'affichent à la même heure que celle choisie dans le CRM.

export type IcsEvent = {
  uid: string;
  date: string; // AAAA-MM-JJ
  time: string; // HH:MM (vide = 9 h)
  title: string;
  description?: string;
  minutes?: number; // durée
};

const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Les lignes d'un .ics ne dépassent pas 75 caractères : les suivantes commencent par une espace.
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
};
const stamp = (date: string, time: string, addMin = 0) => {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "09:00").split(":").map(Number);
  const t = new Date(y, mo - 1, d, h, mi + addMin);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}T${p(t.getHours())}${p(t.getMinutes())}00`;
};

export function buildIcs(events: IcsEvent[]): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const dtstamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}00Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IP5 Energie//CRM Rappels//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Rappels IP5 Énergie"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(e.date, e.time)}`,
      `DTEND:${stamp(e.date, e.time, e.minutes ?? 15)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      // Deux alarmes : 10 minutes avant, et à l'heure du rappel.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "TRIGGER:-PT10M",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "TRIGGER:PT0S",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// Ouvre le fichier : partage natif si possible (iPhone / Android), sinon téléchargement.
export async function openIcs(ics: string, filename = "rappels-ip5.ics") {
  const file = new File([ics], filename, { type: "text/calendar" });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: [file], title: "Rappels IP5 Énergie" });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
