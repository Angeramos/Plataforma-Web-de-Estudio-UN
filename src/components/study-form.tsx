"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { StudyContent } from "@/lib/openai";
import { Results } from "@/components/study-results";

export function StudyForm() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StudyContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("text", text);

      if (file) {
        formData.set("file", file);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("No se pudo generar el contenido.");
      }

      const data = (await response.json()) as StudyContent;
      setResult(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    function onAuroraOption(evt: any) {
      const action = evt?.detail?.action as string | undefined;
      if (!action) return;

      if (action === "showResults") {
        setTimeout(() => {
          document.getElementById("aurora-results")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
        return;
      }

      const templates: Record<string, string> = {
        summary: "Hazme un resumen claro y conciso sobre:",
        quizzes: "Genera preguntas de práctica sobre:",
        flashcards: "Crea tarjetas de repaso sobre:",
        recommendations: "Dame recomendaciones de estudio para:",
      };

      if (templates[action]) {
        setText((prev) => (prev && prev.trim().length > 0 ? prev : templates[action] + " "));
        setTimeout(() => textareaRef.current?.focus(), 60);
      }
    }

    window.addEventListener("aurora-option", onAuroraOption as EventListener);
    return () => window.removeEventListener("aurora-option", onAuroraOption as EventListener);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-4xl border border-[rgba(244,207,122,0.16)] bg-[linear-gradient(180deg,rgba(8,15,31,0.9),rgba(12,20,38,0.94))] p-6 shadow-[0_28px_90px_rgba(4,8,18,0.5)] backdrop-blur"
      >
        <div className="mb-6 space-y-2">
          <p className="text-sm uppercase tracking-[0.34em] text-[#f4cf7a]">
            Flujo académico
          </p>
          <h2 className="text-2xl text-[#fff7e5]" style={{ fontFamily: "var(--font-display)" }}>
            Aurora responde a tus solicitudes o a tus apuntes.
          </h2>
          <p className="text-sm leading-7 text-slate-300">
            Escribe lo que necesitas, pega un texto o sube un PDF para obtener
            un resumen estructurado, preguntas de práctica, tarjetas de repaso
            y recomendaciones.
          </p>
        </div>

        <label className="mb-4 block space-y-2">
          <span className="text-sm font-medium text-slate-100">
            Solicitud o texto
          </span>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            placeholder="Ejemplo: hazme un resumen de análisis sintáctico o pega aquí tus apuntes..."
            className="min-h-44 w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-[#f4cf7a]/45 focus:ring-2 focus:ring-[#f4cf7a]/18"
          />
        </label>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-[#f4cf7a]/45 hover:bg-[rgba(244,207,122,0.1)]">
            <span>Subir PDF</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          <span className="text-sm text-slate-400">
            {file ? file.name : "Ningún PDF seleccionado"}
          </span>
        </div>

        {error ? (
          <p className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f4cf7a,#fff3c4)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(244,207,122,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Generando..." : "Generar contenido"}
        </button>
      </form>

      <aside id="aurora-results">
        <Results result={result} />
      </aside>
    </div>
  );
}
