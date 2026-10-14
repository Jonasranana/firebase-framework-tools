import { useEffect, useState } from "react";
import { crmFirestore } from "@/lib/crmDb";
import { memberName } from "@/lib/crmTeam";
import { COMMERCIAL } from "@/lib/crmColumns";
import type { Lead } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Suivi automatique des appels : à chaque changement du « Statut Appel »,
// on note QUI a appelé (nom, date, statut), on garde le tout premier appelant
// (« 1er appel par » = l'origine du lead pour les comptes) et on met la
// colonne « Commercial » au nom de celui qui vient de rappeler le client.
// Réglage partagé : Firestore crm_boards/call_tracking { enabled }.
// ─────────────────────────────────────────────────────────────────────────
export type CallEntry = { n: number; by: string; name: string; at: string; status: string };

let enabled = true;
const listeners = new Set<() => void>();

export function useCallTracking(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    const l = () => setOn(enabled);
    listeners.add(l);
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, "crm_boards", "call_tracking"),
          (s: any) => {
            enabled = s.data()?.enabled !== false; // actif tant qu'on ne l'a pas coupé
            listeners.forEach((f) => f());
          },
          () => {},
        );
      } catch {
        /* réglage par défaut : actif */
      }
    })();
    return () => {
      listeners.delete(l);
      unsub?.();
    };
  }, []);
  const set = async (v: boolean) => {
    enabled = v;
    listeners.forEach((f) => f());
    const { m, db } = await crmFirestore();
    await m.setDoc(m.doc(db, "crm_boards", "call_tracking"), { enabled: v }, { merge: true });
  };
  return [on, set];
}

// Colonnes « 1er / 2e / 3e appel » : chacune reçoit la personne qui a appelé.
const SLOTS = ["premierAppel", "deuxiemeAppel", "troisiemeAppel"] as const;

// Champs à écrire en plus du nouveau statut. arrayUnion vient du module Firestore.
export function callPatch(lead: Lead, newStatus: string, email: string, arrayUnion: (...v: any[]) => any): Record<string, unknown> {
  if (!enabled || !newStatus || newStatus === lead.status || ["vide", "nouveau_lead"].includes(newStatus)) return {};
  const name = memberName(email, email.split("@")[0]);
  const first = name.split(/\s+/)[0].toLowerCase();
  const patch: Record<string, unknown> = {
    calls: arrayUnion({ n: lead.calls.length + 1, by: email, name, at: new Date().toISOString(), status: newStatus } satisfies CallEntry),
  };
  const opt = COMMERCIAL.find((o) => o.key.toLowerCase() === first);
  if (!opt) return patch; // personne absente de la liste : l'appel est noté dans la fiche seulement
  // Colonne Commercial : celui qui a appelé en premier.
  if (!lead.fields.commercial) patch["fields.commercial"] = opt.key;
  // Prochain appel libre, seulement si ce n'est pas la même personne que le dernier appel noté.
  const filled = SLOTS.filter((k) => lead.fields[k]);
  const last = filled.length ? lead.fields[filled[filled.length - 1]] : "";
  const next = SLOTS.find((k) => !lead.fields[k]);
  if (next && last !== opt.key) patch[`fields.${next}`] = opt.key;
  return patch;
}
