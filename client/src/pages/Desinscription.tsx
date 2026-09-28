import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { LogoIP5 } from "./site-chrome";

// Lien « se désinscrire » des mails de campagne : ?e=<adresse encodée>&t=<jeton>.
// Le jeton (HMAC côté serveur) empêche de désinscrire l'adresse de quelqu'un
// d'autre en devinant l'URL.
const UNSUBSCRIBE_ENDPOINT =
  "https://europe-west9-kachoto-7554c.cloudfunctions.net/unsubscribeEmail";

export default function Desinscription() {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    document.title = "Désinscription — IP5 Énergie";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);

    const params = new URLSearchParams(window.location.search);
    const e = params.get("e");
    const t = params.get("t");
    if (!e || !t) {
      setState("error");
      return () => meta.remove();
    }
    fetch(UNSUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ e, t }),
    })
      .then((res) => setState(res.ok ? "done" : "error"))
      .catch(() => setState("error"));
    return () => meta.remove();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="ltr">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <LogoIP5 className="h-10 mx-auto mb-6" />
        {state === "loading" && (
          <div className="py-6 text-gray-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Désinscription en cours…</span>
          </div>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={40} />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Vous êtes désinscrit(e)
            </h1>
            <p className="text-sm text-gray-500">
              Vous ne recevrez plus nos messages d'information. Si c'était une
              erreur, écrivez-nous à{" "}
              <a href="mailto:contact@ip5energie.com" className="text-[#2b5a8f] underline">
                contact@ip5energie.com
              </a>
              .
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <AlertCircle className="mx-auto mb-4 text-orange-500" size={40} />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Lien invalide ou expiré
            </h1>
            <p className="text-sm text-gray-500">
              Pour ne plus recevoir nos messages, répondez simplement « STOP » au
              mail reçu, ou écrivez-nous à{" "}
              <a href="mailto:contact@ip5energie.com" className="text-[#2b5a8f] underline">
                contact@ip5energie.com
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
