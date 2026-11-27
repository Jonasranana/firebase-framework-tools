// ─────────────────────────────────────────────────────────────────────────
// Export Meta (Gestionnaire de publicités → Exporter → « .xls », répartition
// par jour) : lu directement dans le navigateur, puis enregistré dans
// crm_meta_jours (un document par jour et par campagne). On renvoie l'export
// depuis le début à chaque fois : chaque ligne remplace la précédente, rien
// n'est jamais compté deux fois.
// ─────────────────────────────────────────────────────────────────────────
export type MetaJour = {
  jour: string; // AAAA-MM-JJ
  campagne: string;
  canal: "site" | "formulaire" | "autre";
  depense: number;
  leads: number;
  impressions: number;
  couverture: number;
  budget: number;
  statut: string;
};

export const canalCampagne = (c: string): MetaJour["canal"] => (/formulaire/i.test(c) ? "formulaire" : /^pac/i.test(c.trim()) ? "site" : "autre");
export const idMetaJour = (l: Pick<MetaJour, "jour" | "campagne">) =>
  `${l.jour}_${l.campagne.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}`;

const nombre = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Lit le fichier (XML « Excel 2003 » de Meta, ou CSV) et rend les lignes jour par jour.
export function lireExportMeta(texte: string): MetaJour[] {
  let lignes: string[][] = [];
  if (/<Workbook[\s>]/.test(texte)) {
    const doc = new DOMParser().parseFromString(texte, "application/xml");
    const NS = "urn:schemas-microsoft-com:office:spreadsheet";
    for (const row of Array.from(doc.getElementsByTagNameNS(NS, "Row"))) {
      const cells: string[] = [];
      for (const c of Array.from(row.getElementsByTagNameNS(NS, "Cell"))) {
        const idx = c.getAttributeNS(NS, "Index");
        if (idx) while (cells.length < Number(idx) - 1) cells.push("");
        cells.push(c.getElementsByTagNameNS(NS, "Data")[0]?.textContent ?? "");
      }
      lignes.push(cells);
    }
  } else {
    // CSV (séparateur , ou ;), guillemets gérés simplement.
    const sep = (texte.split("\n")[0].match(/;/g)?.length ?? 0) > (texte.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    lignes = texte
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => (l.match(new RegExp(`("([^"]|"")*"|[^${sep}]*)(${sep}|$)`, "g")) ?? []).map((x) => x.replace(new RegExp(`${sep}$`), "").replace(/^"|"$/g, "").replace(/""/g, '"')));
  }
  const tete = lignes[0] ?? [];
  const col = (...noms: RegExp[]) => tete.findIndex((h) => noms.some((n) => n.test(h)));
  const cDebut = col(/^d[ée]but des rapports/i, /^reporting starts/i, /^jour$/i, /^day$/i);
  const cFin = col(/^fin des rapports/i, /^reporting ends/i);
  const cCamp = col(/^nom de la campagne/i, /^campaign name/i);
  const cDep = col(/^montant d[ée]pens[ée]/i, /^amount spent/i);
  const cRes = col(/^r[ée]sultats$/i, /^results$/i);
  const cImp = col(/^impressions$/i);
  const cCouv = col(/^couverture$/i, /^reach$/i);
  const cBud = col(/^budget des ensembles/i, /^ad set budget/i);
  const cStat = col(/^diffusion des campagnes/i, /^campaign delivery/i);
  if (cDebut < 0 || cCamp < 0 || cDep < 0) throw new Error("Ce fichier ne ressemble pas à un export Meta (colonnes « Début des rapports », « Nom de la campagne », « Montant dépensé » introuvables).");
  const out: MetaJour[] = [];
  for (const r of lignes.slice(1)) {
    const jour = String(r[cDebut] ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) continue;
    // Une ligne doit couvrir un seul jour (export « répartition par jour »).
    if (cFin >= 0 && String(r[cFin] ?? "").slice(0, 10) !== jour) continue;
    const l: MetaJour = {
      jour,
      campagne: String(r[cCamp] ?? "").trim(),
      canal: canalCampagne(String(r[cCamp] ?? "")),
      depense: Math.round(nombre(r[cDep]) * 100) / 100,
      leads: cRes >= 0 ? nombre(r[cRes]) : 0,
      impressions: cImp >= 0 ? nombre(r[cImp]) : 0,
      couverture: cCouv >= 0 ? nombre(r[cCouv]) : 0,
      budget: cBud >= 0 ? nombre(r[cBud]) : 0,
      statut: cStat >= 0 ? String(r[cStat] ?? "") : "",
    };
    if (!l.campagne || (!l.depense && !l.leads && !l.impressions)) continue;
    out.push(l);
  }
  return out;
}
