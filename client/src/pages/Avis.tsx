import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { LogoIP5 } from "./site-chrome";

// Page ouverte par le QR code remis aux clients après les travaux.
// Tous les avis sont acceptés (pas de tri selon la note) et le lien Google
// est proposé à tout le monde : Google interdit de ne rediriger que les
// clients satisfaits.
const REVIEW_ENDPOINT =
  "https://europe-west9-kachoto-7554c.cloudfunctions.net/submitReview";

// Lien « Demander des avis » de la fiche Google Business Profile
// (format https://g.page/r/…/review). Vide = bouton Google masqué.
const GOOGLE_REVIEW_URL = "";

const WORK_TYPES = ["Pompe à chaleur", "Chauffe-eau solaire", "Éclairage LED", "Autre"];

export default function Avis() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [work, setWork] = useState("Pompe à chaleur");
  const [comment, setComment] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"form" | "sending" | "done" | "error">("form");

  useEffect(() => {
    document.title = "Donnez votre avis — IP5 Énergie";
  }, []);

  const canSubmit = rating > 0 && name.trim() && comment.trim().length >= 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setState("sending");
    try {
      const res = await fetch(REVIEW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, name, city, work, comment, publishConsent, company }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  const googleButton = GOOGLE_REVIEW_URL && (
    <a
      href={GOOGLE_REVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl border-2 border-gray-200 py-3 font-semibold text-gray-700 hover:border-gray-300"
    >
      <Star size={18} className="text-amber-400 fill-amber-400" />
      Laisser aussi un avis sur Google
    </a>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10" dir="ltr">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <LogoIP5 className="h-10 mx-auto mb-6" />
        {state === "done" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={40} />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Merci pour votre avis !</h1>
            <p className="text-sm text-gray-500">
              Il a bien été transmis à l'équipe IP5 Énergie.
            </p>
            {googleButton}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">Votre avis nous intéresse</h1>
              <p className="text-sm text-gray-500 mt-1">
                Comment s'est passée votre installation ?
              </p>
            </div>

            <div className="flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className="p-1"
                >
                  <Star
                    size={36}
                    className={
                      n <= (hover || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-300"
                    }
                  />
                </button>
              ))}
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom et initiale du nom (ex. Marie D.)"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              required
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ville (facultatif)"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <select
              value={work}
              onChange={(e) => setWork(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white"
            >
              {WORK_TYPES.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Votre commentaire : accueil, conseils, pose, suivi…"
              rows={5}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              required
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            <label className="flex items-start gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={publishConsent}
                onChange={(e) => setPublishConsent(e.target.checked)}
                className="mt-0.5"
              />
              J'accepte que mon avis (prénom, initiale, ville) soit publié sur le site
              IP5 Énergie.
            </label>

            {state === "error" && (
              <p className="text-sm text-red-600">
                L'envoi a échoué, merci de réessayer dans un instant.
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || state === "sending"}
              className="w-full rounded-xl bg-[#2b5a8f] text-white font-semibold py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {state === "sending" && <Loader2 className="animate-spin" size={18} />}
              Envoyer mon avis
            </button>
            {googleButton}
          </form>
        )}
      </div>
    </div>
  );
}
