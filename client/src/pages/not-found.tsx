import { Home, Phone } from "lucide-react";

// Page 404 publique : en français, avec des portes de sortie claires
// (accueil, téléphone) plutôt qu'un message technique.
export default function NotFound() {
  return (
    <div
      dir="ltr"
      className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4"
    >
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
        <p className="text-6xl font-black text-[#2b5a8f] mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Cette page n'existe pas
        </h1>
        <p className="text-gray-600 mb-8">
          L'adresse est peut-être erronée, ou la page a été déplacée.
          Retrouvez tout ce qu'il vous faut depuis l'accueil.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-[#2b5a8f] text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-800 transition-colors"
          >
            <Home size={18} /> Retour à l'accueil
          </a>
          <a
            href="tel:+33749525267"
            className="inline-flex items-center justify-center gap-2 bg-white text-[#2b5a8f] border-2 border-[#2b5a8f] px-6 py-3 rounded-full font-semibold hover:bg-blue-50 transition-colors"
          >
            <Phone size={18} /> 07 49 52 52 67
          </a>
        </div>
      </div>
    </div>
  );
}
