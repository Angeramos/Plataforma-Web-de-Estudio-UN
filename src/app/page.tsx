import { StudyForm } from "@/components/study-form";
import { AuroraMascot } from "@/components/aurora-mascot";

export default function Home() {
  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-176 max-w-7xl bg-[radial-gradient(circle_at_top,rgba(244,207,122,0.18),transparent_30%),radial-gradient(circle_at_70%_14%,rgba(88,211,255,0.18),transparent_24%),radial-gradient(circle_at_18%_28%,rgba(138,125,255,0.18),transparent_22%)] blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(135deg,rgba(7,17,31,0.94),rgba(13,24,46,0.76))] p-6 text-white shadow-[0_36px_120px_rgba(4,8,18,0.55)] backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(244,207,122,0.28)] bg-[rgba(244,207,122,0.08)] px-4 py-2 text-xs uppercase tracking-[0.38em] text-[#f4cf7a]">
                Asistente académico
              </div>

              <div className="space-y-4">
                <h1
                  className="max-w-4xl text-5xl leading-tight text-[#fff7e5] sm:text-6xl lg:text-7xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Bienvenid@
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-200/90 sm:text-lg">
                  Sube un PDF o pega tu texto.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Pill text="Resumen ejecutivo" />
                <Pill text="Preguntas de práctica" />
                <Pill text="Tarjetas de repaso" />
                <Pill text="Recomendaciones de estudio" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Metric label="Entrada" value="texto + PDF" accent="sky" />
              <Metric label="Salida" value="4 bloques" accent="gold" />
              <Metric label="Tiempo" value="segundos" accent="violet" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            eyebrow="01"
            title="Captura"
            description="Pega apuntes o carga un PDF para iniciar el análisis de inmediato."
          />
          <FeatureCard
            eyebrow="02"
            title="Organiza"
            description="El contenido se ordena en bloques claros para facilitar la comprensión."
          />
          <FeatureCard
            eyebrow="03"
            title="Consolida"
            description="Repasa, responde preguntas y afianza los conceptos con método."
          />
        </section>

        <StudyForm />

        {/* Institutional upload removed from UI per request */}
      </div>

      <AuroraMascot />
    </main>
  );
}

function Metric({
  label,
  value,
  accent,
}: Readonly<{ label: string; value: string; accent: "gold" | "sky" | "violet" }>) {
  const accentClasses = {
    gold: "from-[#f4cf7a]/28 via-[#f4cf7a]/10 to-transparent text-[#fff0c6]",
    sky: "from-[#58d3ff]/24 via-[#58d3ff]/10 to-transparent text-[#d7f4ff]",
    violet: "from-[#8a7dff]/24 via-[#8a7dff]/10 to-transparent text-[#ece6ff]",
  };

  return (
    <div className={`rounded-3xl border border-white/10 bg-linear-to-br px-4 py-4 shadow-lg ${accentClasses[accent]}`}>
      <p className="text-[0.65rem] uppercase tracking-[0.32em] text-white/55">{label}</p>
      <p className="mt-3 text-2xl text-white" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  );
}

function Pill({ text }: Readonly<{ text: string }>) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      {text}
    </span>
  );
}

function FeatureCard({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>) {
  return (
    <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(7,17,31,0.95))] p-5 text-white shadow-[0_20px_60px_rgba(4,8,18,0.35)] backdrop-blur">
      <p className="font-mono text-xs uppercase tracking-[0.34em] text-[#f4cf7a]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl text-[#fff8e7]" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
    </article>
  );
}
