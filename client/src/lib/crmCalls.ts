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

// Champs à écrire en plus du nouveau statut. arrayUnion vient du module Firestore.
export function callPatch(lead: Lead, newStatus: string, email: string, arrayUnion: (...v: any[]) => any): Record<string, unknown> {
  if (!enabled || !newStatus || newStatus === lead.status || ["vide", "nouveau_lead"].includes(newStatus)) return {};
  const name = memberName(email, email.split("@")[0]);
  const first = name.split(/\s+/)[0].toLowerCase();
  const n = (Number(lead.fields.nbAppels) || lead.calls.length) + 1;
  const patch: Record<string, unknown> = {
    "fields.nbAppels": String(n),
    calls: arrayUnion({ n, by: email, name, at: new Date().toISOString(), status: newStatus } satisfies CallEntry),
  };
  if (!lead.fields.premierAppel) patch["fields.premierAppel"] = name;
  const opt = COMMERCIAL.find((o) => o.key.toLowerCase() === first);
  if (opt) patch["fields.commercial"] = opt.key;
  return patch;
}
