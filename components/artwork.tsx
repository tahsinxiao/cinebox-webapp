/** Server-safe artwork helpers (no hooks, importable from RSC and client). */

const GRADIENTS = [
  "from-[#3b1e8c] via-[#1a1033] to-[#07060f]",
  "from-[#7b3dff] via-[#2d1668] to-[#07060f]",
  "from-[#0f3b6e] via-[#101a3a] to-[#07060f]",
  "from-[#6d1246] via-[#2a0f33] to-[#07060f]",
  "from-[#134e4a] via-[#0f2436] to-[#07060f]",
  "from-[#5b2110] via-[#2a1220] to-[#07060f]",
];

export function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function ArtworkFallback({ title, seed, className = "" }: { title: string; seed: string; className?: string }) {
  return (
    <div className={`relative flex h-full w-full items-end bg-gradient-to-br ${gradientFor(seed)} ${className}`}>
      <div className="absolute inset-0 opacity-[.18] [background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.5)_0_1px,transparent_1px_14px)]" />
      <div className="relative z-10 p-3">
        <p className="line-clamp-3 text-[13px] font-extrabold leading-tight tracking-tight text-white/95 drop-shadow">
          {title}
        </p>
      </div>
    </div>
  );
}
