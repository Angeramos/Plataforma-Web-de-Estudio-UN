"use client";

import { useState } from "react";

const moods = [
  "Soy Aurora te ayudaré con un resumen, preguntas de práctica, tarjetas de repaso o recomendaciones de estudio, estoy aquí para lo que necesites.",
  "Puedo orientarte con una síntesis breve y bien estructurada.",
  "Sube tu PDF o pega tu texto y lo organizo para tu estudio.",
  "Estoy aquí para ayudarte a estudiar con claridad y método.",
];

export function AuroraMascot() {
  const [messageIndex, setMessageIndex] = useState(0);

  function handleInteract() {
    setMessageIndex((current) => (current + 1) % moods.length);
  }

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[18rem] sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <div className="rounded-full border border-white/15 bg-[rgba(8,15,31,0.72)] px-4 py-2 text-right text-xs leading-5 text-slate-100 shadow-[0_16px_50px_rgba(4,8,18,0.35)] backdrop-blur">
          <p className="uppercase tracking-[0.28em] text-[#f4cf7a]">Aurora</p>
          <p className="mt-1 max-w-52 text-[0.78rem] text-slate-200">
            {moods[messageIndex]}
          </p>
        </div>

        <button
          type="button"
          onClick={handleInteract}
          className="group relative grid h-28 w-28 place-items-center rounded-full border border-white/18 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(191,230,255,0.96)_36%,rgba(145,196,255,0.82)_66%,rgba(89,145,216,0.9)_100%)] shadow-[0_18px_60px_rgba(88,211,255,0.24)] transition duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_24px_72px_rgba(244,207,122,0.2)]"
          style={{ animation: "float-soft 6s ease-in-out infinite" }}
          aria-label="Interactuar con Aurora"
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_50%)] opacity-90" />
          <span className="absolute inset-3 rounded-full border border-white/35 opacity-65" />
          <span className="absolute left-7 top-9 h-3 w-3 rounded-full border border-slate-900/20 bg-white/95 shadow-[0_0_0_3px_rgba(255,255,255,0.32)]" />
          <span className="absolute right-7 top-9 h-3 w-3 rounded-full border border-slate-900/20 bg-white/95 shadow-[0_0_0_3px_rgba(255,255,255,0.32)]" />
          <span className="absolute top-[3.15rem] h-0.5 w-8 rounded-full bg-slate-100/95" />
          <span className="absolute top-[3.45rem] h-3.5 w-7 rounded-b-full border-b border-white/40 bg-white/70" />
          <span className="absolute top-5 h-7 w-14 rounded-full border border-white/35 bg-[rgba(255,255,255,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" />
          <span className="absolute top-[1.1rem] left-[3.55rem] h-4 w-1 rounded-full bg-white/95" />
          <span className="absolute bottom-5 h-8 w-16 rounded-[999px_999px_36px_36px] border border-white/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(201,232,255,0.7))]" />
          <span className="absolute bottom-3 h-2 w-14 rounded-full bg-[rgba(255,255,255,0.55)] blur-sm" />
          <span className="absolute -bottom-2 h-4 w-20 rounded-full bg-[rgba(88,211,255,0.28)] blur-md" />
          <span className="absolute -left-1 top-8 h-5 w-5 rounded-full bg-[rgba(244,207,122,0.18)] blur-md transition duration-300 group-hover:bg-[rgba(244,207,122,0.26)]" />
          <span className="absolute -right-1 bottom-10 h-5 w-5 rounded-full bg-[rgba(88,211,255,0.18)] blur-md transition duration-300 group-hover:bg-[rgba(88,211,255,0.26)]" />
        </button>
      </div>
    </aside>
  );
}
