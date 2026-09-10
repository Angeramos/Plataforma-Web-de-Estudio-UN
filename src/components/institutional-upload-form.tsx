"use client";

import { FormEvent, useState } from "react";

export function InstitutionalUploadForm() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!file) {
        throw new Error("Debes seleccionar un archivo.");
      }

      const formData = new FormData();
      formData.set("title", title);
      formData.set("file", file);

      const response = await fetch("/api/institutional/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "No se pudo guardar el material.");
      }

      const payload = (await response.json()) as { fileName: string; title: string };
      setMessage(`Material guardado como ${payload.fileName}.`);
      setTitle("");
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Ocurrió un error inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-4xl border border-[rgba(244,207,122,0.16)] bg-[linear-gradient(180deg,rgba(8,15,31,0.9),rgba(12,20,38,0.94))] p-6 shadow-[0_28px_90px_rgba(4,8,18,0.5)] backdrop-blur">
      <div className="mb-6 space-y-2">
        <p className="text-sm uppercase tracking-[0.34em] text-[#f4cf7a]">Base institucional</p>
        <h2 className="text-2xl text-[#fff7e5]" style={{ fontFamily: "var(--font-display)" }}>
          Cargar material para Aurora
        </h2>
        <p className="text-sm leading-7 text-slate-300">
          Sube parciales, presentaciones o documentos para que Aurora los lea como contexto adicional.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-100">Título opcional</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ejemplo: Análisis sintáctico - parcial 2024"
            className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-[#f4cf7a]/45 focus:ring-2 focus:ring-[#f4cf7a]/18"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-[#f4cf7a]/45 hover:bg-[rgba(244,207,122,0.1)]">
            <span>Seleccionar archivo</span>
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          <span className="text-sm text-slate-400">
            {file ? file.name : "Ningún archivo seleccionado"}
          </span>
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f4cf7a,#fff3c4)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(244,207,122,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar material"}
        </button>
      </form>
    </section>
  );
}
