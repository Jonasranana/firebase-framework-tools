// Équipe du CRM : les trois administrateurs d'origine (identiques à la liste
// des règles Firestore/Storage et de functions/index.js) + les personnes
// ajoutées depuis la page « Équipe » (Firestore crm_team, accès par claim).
export const ROOT_ADMINS: Record<string, string> = {
  "jonassitbon8@gmail.com": "Jonas Sitbon",
  "alexis.sitbon@gmail.com": "Alexis Sitbon",
  "carol.sitbon05@gmail.com": "Carole Sitbon",
};

export const isRootAdmin = (email: string) => email.toLowerCase() in ROOT_ADMINS;

export const memberName = (email: string, fallback = "") =>
  ROOT_ADMINS[email.toLowerCase()] ?? (fallback || email);

export const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export type TeamMember = {
  email: string;
  name: string;
  root: boolean;
  addedBy: string;
  title?: string;
  phone?: string;
  photoUrl?: string;
  notify?: boolean;
};

// ── Accès à l'équipe (fonction manageTeam), avec cache partagé ─────────────
import { useEffect, useState } from "react";
import { getEspaceProApp } from "@/lib/espacePro";

let cache: TeamMember[] | null = null;
const listeners = new Set<(m: TeamMember[]) => void>();

export async function callTeam(data: Record<string, unknown>): Promise<TeamMember[]> {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const r = await httpsCallable(getFunctions(app, "europe-west9"), "manageTeam")(data);
  const members = (r.data as { members: TeamMember[] }).members;
  cache = members;
  listeners.forEach((l) => l(members));
  return members;
}

// Membres de l'équipe (nom, photo, poste…), chargés une fois puis partagés.
export function useTeam() {
  const [members, setMembers] = useState<TeamMember[] | null>(cache);
  useEffect(() => {
    listeners.add(setMembers);
    if (!cache) callTeam({ action: "list" }).catch((e) => console.error(e));
    return () => {
      listeners.delete(setMembers);
    };
  }, []);
  return members;
}
