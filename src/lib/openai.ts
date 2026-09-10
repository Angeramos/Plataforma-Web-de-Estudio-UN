import OpenAI from "openai";

export interface StudyQuiz {
  question: string;
  options: string[];
  answer: string;
}

export interface StudyFlashcard {
  front: string;
  back: string;
}

export interface StudyContent {
  summary: string;
  quizzes: StudyQuiz[];
  flashcards: StudyFlashcard[];
  recommendations: string[];
  sourceLabel: string;
}

const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
const openaiClient = openaiApiKey && openaiApiKey.startsWith("sk-") ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function generateStudyContent(
  prompt: string,
  sourceText: string,
  sourceLabel: string,
  institutionalContext = "",
): Promise<StudyContent> {
  const cleanedPrompt = prompt.trim();
  const cleanedSourceText = sourceText.trim();
  const cleanedInstitutionalContext = institutionalContext.trim();

  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Eres Aurora, una asistente académica en español. Devuelve solo JSON válido con las claves summary, quizzes, flashcards, recommendations y sourceLabel. summary debe ser un párrafo breve y claro. quizzes debe contener exactamente 2 objetos con question, options y answer. flashcards debe contener exactamente 2 objetos con front y back. recommendations debe contener exactamente 4 cadenas. Mantén un tono profesional, útil y pedagógico. Si el usuario escribe una instrucción, respóndela como una asistente académica. Si recibe contenido de apoyo o material institucional adicional, úsalo para elaborar el resumen y las demás secciones.",
          },
          {
            role: "user",
            content: buildUserMessage(cleanedPrompt, cleanedSourceText, sourceLabel, cleanedInstitutionalContext),
          },
        ],
      });

      const rawContent = response.choices[0]?.message?.content ?? "";
      const parsed = parseContent(rawContent);
      return normalizeStudyContent(parsed, cleanedPrompt, cleanedSourceText, sourceLabel);
    } catch {
      return buildLocalStudyContent(cleanedPrompt, cleanedSourceText, sourceLabel, cleanedInstitutionalContext);
    }
  }

  return buildLocalStudyContent(cleanedPrompt, cleanedSourceText, sourceLabel, cleanedInstitutionalContext);
}

function buildUserMessage(prompt: string, sourceText: string, sourceLabel: string, institutionalContext: string) {
  const lines = [
    `Solicitud del usuario: ${prompt || "Genera una respuesta académica útil."}`,
  ];

  if (sourceText) {
    lines.push(`Contenido de apoyo desde ${sourceLabel}:`, sourceText);
  }

  if (institutionalContext) {
    lines.push(institutionalContext);
  }

  return lines.join("\n\n");
}

function buildLocalStudyContent(prompt: string, sourceText: string, sourceLabel: string, institutionalContext = ""): StudyContent {
  const topic = extractTopic(prompt) || inferTopicFromSource(sourceText) || "el tema solicitado";
  const summary = sourceText
    ? buildSourceSummary(sourceText, sourceLabel, topic)
    : buildTopicSummary(topic);
  const enrichedSummary = institutionalContext
    ? `${summary} ${buildInstitutionalAppendix(institutionalContext)}`
    : summary;

  return {
    sourceLabel,
    summary: enrichedSummary,
    quizzes: buildQuizzes(topic),
    flashcards: buildFlashcards(topic, sourceLabel),
    recommendations: buildRecommendations(topic),
  };
}

function buildSourceSummary(sourceText: string, sourceLabel: string, topic: string) {
  const normalized = sourceText.replace(/\s+/g, " ").trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 0);

  const summarySource =
    sentences.slice(0, 3).join(" ") || normalized || `No se recibió contenido suficiente sobre ${topic}.`;

  return `Resumen de ${sourceLabel}: ${summarySource}`;
}

function buildTopicSummary(topic: string) {
  return `Resumen académico sobre ${topic}: este tema aborda sus conceptos centrales, su estructura interna y la forma en que se analiza en contexto. Para estudiarlo con claridad conviene identificar definiciones, funciones, relaciones y ejemplos. Aurora puede seguir ampliando esta respuesta con el material institucional disponible.`;
}

function buildQuizzes(topic: string): StudyQuiz[] {
  return [
    {
      question: `¿Cuál es el aspecto central de ${topic}?`,
      options: ["Conceptos principales", "Detalles irrelevantes", "Errores comunes", "Información aislada"],
      answer: "Conceptos principales",
    },
    {
      question: `¿Qué estrategia ayuda más a dominar ${topic}?`,
      options: ["Revisión activa", "Lectura superficial", "Evitar practicar", "Memorizar sin contexto"],
      answer: "Revisión activa",
    },
  ];
}

function buildFlashcards(topic: string, sourceLabel: string): StudyFlashcard[] {
  return [
    {
      front: `Concepto clave: ${topic}`,
      back: `Definición breve y explicación académica basada en ${sourceLabel || "el material proporcionado"}.`,
    },
    {
      front: `Aplicación de ${topic}`,
      back: "Relaciona el concepto con ejemplos concretos y con su función dentro del tema de estudio.",
    },
  ];
}

function buildRecommendations(topic: string) {
  return [
    `Haz un repaso activo de ${topic} con preguntas breves.`,
    "Convierte cada idea importante en una tarjeta de repaso.",
    "Subraya definiciones, causas, procesos y ejemplos relevantes.",
    "Estudia en sesiones cortas para consolidar mejor el contenido.",
  ];
}

function buildInstitutionalAppendix(institutionalContext: string) {
  const cleaned = institutionalContext.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  return `Contexto institucional adicional: ${cleaned.slice(0, 280)}.`;
}

function parseContent(rawContent: string): Partial<StudyContent> {
  const cleaned = rawContent
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned) as Partial<StudyContent>;
  } catch {
    return {};
  }
}

function normalizeStudyContent(
  content: Partial<StudyContent>,
  prompt: string,
  sourceText: string,
  sourceLabel: string,
): StudyContent {
  const fallback = buildLocalStudyContent(prompt, sourceText, sourceLabel);

  return {
    sourceLabel: typeof content.sourceLabel === "string" && content.sourceLabel.trim() ? content.sourceLabel : sourceLabel,
    summary: typeof content.summary === "string" && content.summary.trim() ? content.summary : fallback.summary,
    quizzes: Array.isArray(content.quizzes) && content.quizzes.length > 0 ? content.quizzes.slice(0, 2).map((quiz, index) => ({
      question: typeof quiz?.question === "string" && quiz.question.trim() ? quiz.question : fallback.quizzes[index]?.question ?? fallback.quizzes[0].question,
      options: Array.isArray(quiz?.options) && quiz.options.length > 0 ? quiz.options.slice(0, 4).map((option) => String(option)) : fallback.quizzes[index]?.options ?? fallback.quizzes[0].options,
      answer: typeof quiz?.answer === "string" && quiz.answer.trim() ? quiz.answer : fallback.quizzes[index]?.answer ?? fallback.quizzes[0].answer,
    })) : fallback.quizzes,
    flashcards: Array.isArray(content.flashcards) && content.flashcards.length > 0 ? content.flashcards.slice(0, 2).map((flashcard, index) => ({
      front: typeof flashcard?.front === "string" && flashcard.front.trim() ? flashcard.front : fallback.flashcards[index]?.front ?? fallback.flashcards[0].front,
      back: typeof flashcard?.back === "string" && flashcard.back.trim() ? flashcard.back : fallback.flashcards[index]?.back ?? fallback.flashcards[0].back,
    })) : fallback.flashcards,
    recommendations: Array.isArray(content.recommendations) && content.recommendations.length > 0 ? content.recommendations.slice(0, 4).map((recommendation) => String(recommendation)) : fallback.recommendations,
  };
}

function extractTopic(prompt: string) {
  const normalizedPrompt = prompt.trim();

  const patterns = [
    /(?:hazme\s+un\s+)?resumen\s+(?:de|sobre)\s+(.+)/i,
    /(?:explica(?:me)?|explícame|cuéntame|dime|describe(?:me)?)\s+(?:de|sobre)?\s*(.+)/i,
    /(?:analiza(?:me)?|resume(?:me)?|sintetiza(?:me)?)\s+(?:de|sobre)?\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedPrompt.match(pattern);
    if (match?.[1]) {
      return cleanupTopic(match[1]);
    }
  }

  if (normalizedPrompt.length > 0 && normalizedPrompt.length <= 80) {
    return cleanupTopic(normalizedPrompt);
  }

  return "";
}

function inferTopicFromSource(sourceText: string) {
  const words = sourceText
    .toLowerCase()
    .match(/[a-záéíóúñü]{5,}/gi)
    ?.filter(Boolean) ?? [];

  if (words.length === 0) {
    return "";
  }

  return cleanupTopic(Array.from(new Set(words)).slice(0, 3).join(" "));
}

function cleanupTopic(topic: string) {
  return topic.replace(/[?.!,;:]+$/g, "").replace(/\s+/g, " ").trim();
}
