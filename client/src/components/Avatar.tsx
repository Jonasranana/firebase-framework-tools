import { initials } from "@/lib/crmTeam";

// Pastille ronde : photo de profil si elle existe, sinon les initiales.
export default function Avatar({
  name,
  photoUrl,
  size = 32,
  className = "",
}: {
  name: string;
  photoUrl?: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  return photoUrl ? (
    <img src={photoUrl} alt={name} style={style} className={`rounded-full object-cover shrink-0 ${className}`} />
  ) : (
    <span
      style={style}
      className={`rounded-full bg-[#2b5a8f] text-white font-bold flex items-center justify-center shrink-0 ${className}`}
    >
      {initials(name)}
    </span>
  );
}
