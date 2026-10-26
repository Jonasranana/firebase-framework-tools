// Tranche de revenus (profil MaPrimeRénov') : couleur et nom court, d'après le texte saisi par le site.
export const trancheInfo = (v: string): { color: string; name: string } | null => {
  const t = String(v ?? "").toLowerCase();
  if (t.includes("très modeste") || t.includes("bleu")) return { color: "#2f7df6", name: "Bleu" };
  if (t.includes("modeste") || t.includes("jaune")) return { color: "#f5c518", name: "Jaune" };
  if (t.includes("intermédiaire") || t.includes("violet")) return { color: "#8b4be0", name: "Violet" };
  if (t.includes("supérieur") || t.includes("rose")) return { color: "#f0509a", name: "Rose" };
  return null;
};
