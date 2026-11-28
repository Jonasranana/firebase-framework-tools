// « Mode léger » : sur un petit ordinateur (4 cœurs ou moins, ou 4 Go de mémoire ou moins), le CRM en fait
// moins d'un coup (groupes repliés sauf les siens et les nouveaux, moins de lignes dessinées à la fois),
// pour rester fluide. Mesuré avec le chronomètre : un PC 4 cœurs passait 74 s « figé » sur Pac Pac.
const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
export const appareilLeger = !!nav && ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4);
