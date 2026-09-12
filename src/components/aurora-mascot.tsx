"use client";

import { useState } from "react";

const options = [
  { key: "summary", label: "Resumen" },
  { key: "quizzes", label: "Preguntas de práctica" },
  { key: "flashcards", label: "Tarjetas de repaso" },
  { key: "recommendations", label: "Recomendaciones" },
  { key: "showResults", label: "Mostrar resultados" },
];

export function AuroraMascot() {
  const [open, setOpen] = useState(false);

  function toggle() {
    setOpen((v) => !v);
  }

  function handleOptionClick(key: string) {
    // Dispatch a simple event the rest of the app can listen to
    try {
      window.dispatchEvent(new CustomEvent("aurora-option", { detail: { action: key } }));
    } catch (e) {
      // ignore in non-browser environments
    }
    setOpen(false);
  }

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[18rem] sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {open && (
          <div className="w-48 rounded-2xl border border-white/10 bg-[rgba(8,15,31,0.88)] p-2 text-white shadow-[0_12px_40px_rgba(4,8,18,0.35)] backdrop-blur">
            <p className="px-3 py-2 text-xs uppercase tracking-[0.28em] text-[#f4cf7a]">Aurora</p>
            <div className="mt-1 flex flex-col gap-1">
              {options.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleOptionClick(opt.key)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/5"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggle}
          className="group relative grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(191,230,255,0.96)_36%,rgba(145,196,255,0.82)_66%,rgba(89,145,216,0.9)_100%)] shadow-[0_10px_30px_rgba(88,211,255,0.18)] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_48px_rgba(244,207,122,0.12)]"
          style={{ animation: "float-soft 6s ease-in-out infinite" }}
          aria-label="Aurora opciones"
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_50%)] opacity-90" />
          <span className="absolute inset-1 rounded-full border border-white/35 opacity-65" />
          <span className="h-2 w-2 rounded-full bg-white/95" />
        </button>
      </div>
    </aside>
  );
}
