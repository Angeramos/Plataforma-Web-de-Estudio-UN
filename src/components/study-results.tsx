import type { StudyContent } from "@/lib/openai";

interface ResultsProps {
  result: StudyContent | null;
}

export function Results({ result }: ResultsProps) {
  if (!result) {
    return (
      <section className="rounded-4xl border border-dashed border-[rgba(244,207,122,0.18)] bg-[rgba(255,255,255,0.04)] p-6 text-slate-300 shadow-[0_24px_80px_rgba(4,8,18,0.32)] backdrop-blur">
        <h2 className="text-xl text-[#fff7e5]" style={{ fontFamily: "var(--font-display)" }}>
          Resultados
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Aquí aparecerán el resumen, las preguntas de práctica, las tarjetas
          de repaso y las recomendaciones de estudio cuando generes contenido.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-4xl border border-[rgba(244,207,122,0.16)] bg-[linear-gradient(180deg,rgba(255,251,236,0.98),rgba(248,250,252,0.95))] p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#9d6b16]">
          Resumen
        </p>
        <p className="mt-3 text-base leading-7 text-slate-700">{result.summary}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Preguntas de práctica">
          <ul className="space-y-3">
            {result.quizzes.map((quiz) => (
              <li key={quiz.question} className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.72)] p-4">
                <p className="font-medium text-slate-900">{quiz.question}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Opciones: {quiz.options.join(" · ")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#9d6b16]">
                  Respuesta: {quiz.answer}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Tarjetas de repaso">
          <ul className="space-y-3">
            {result.flashcards.map((flashcard) => (
              <li key={flashcard.front} className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.72)] p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Frente
                </p>
                <p className="font-medium text-slate-900">{flashcard.front}</p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Reverso
                </p>
                <p className="text-sm text-slate-700">{flashcard.back}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Recomendaciones de estudio">
        <ul className="grid gap-3 md:grid-cols-2">
          {result.recommendations.map((item) => (
            <li key={item} className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.72)] p-4 text-sm text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function Card({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <article className="rounded-4xl border border-[rgba(244,207,122,0.16)] bg-[linear-gradient(180deg,rgba(255,251,236,0.98),rgba(248,250,252,0.95))] p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9d6b16]">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </article>
  );
}
