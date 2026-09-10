import { readFile } from "node:fs/promises";
import path from "node:path";

export interface KnowledgeChunk {
  title: string;
  content: string;
  sourceFile: string;
}

export interface InstitutionalKnowledgeResult {
  context: string;
  sources: string[];
}

const institutionalContentDir = path.join(process.cwd(), "src", "content", "institutional");
const supportedExtensions = new Set([".md", ".txt"]);

export async function getInstitutionalKnowledge(prompt: string, sourceText: string): Promise<InstitutionalKnowledgeResult> {
  const keywords = extractKeywords(`${prompt} ${sourceText}`);
  const chunks = await loadKnowledgeChunks();

  if (chunks.length === 0) {
    return { context: "", sources: [] };
  }

  const rankedChunks = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, keywords),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.chunk);

  if (rankedChunks.length === 0) {
    return { context: "", sources: [] };
  }

  const contextLines = [
    "Material institucional relevante:",
    ...rankedChunks.map((chunk) => `- ${chunk.title}: ${chunk.content}`),
  ];

  return {
    context: contextLines.join("\n"),
    sources: rankedChunks.map((chunk) => chunk.sourceFile),
  };
}

async function loadKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const entries = await readDirectorySafely(institutionalContentDir);

  const files = entries.filter((entry) => supportedExtensions.has(path.extname(entry).toLowerCase()));
  const chunks: KnowledgeChunk[] = [];

  for (const fileName of files) {
    const filePath = path.join(institutionalContentDir, fileName);
    const rawContent = await readFile(filePath, "utf8");
    const normalized = rawContent.replace(/\s+/g, " ").trim();

    if (!normalized) {
      continue;
    }

    const title = deriveTitle(fileName, normalized);
    const chunkText = normalized.slice(0, 1200);

    chunks.push({
      title,
      content: chunkText,
      sourceFile: fileName,
    });
  }

  return chunks;
}

async function readDirectorySafely(directoryPath: string) {
  try {
    const fs = await import("node:fs/promises");
    return await fs.readdir(directoryPath);
  } catch {
    return [];
  }
}

function extractKeywords(text: string) {
  const words = text
    .toLowerCase()
    .match(/[a-záéíóúñü]{4,}/gi)
    ?.filter(Boolean) ?? [];

  return Array.from(new Set(words)).slice(0, 12);
}

function scoreChunk(chunk: KnowledgeChunk, keywords: string[]) {
  const searchableText = `${chunk.title} ${chunk.content}`.toLowerCase();
  return keywords.reduce((score, keyword) => {
    const occurrences = searchableText.split(keyword.toLowerCase()).length - 1;
    return score + occurrences;
  }, 0);
}

function deriveTitle(fileName: string, content: string) {
  const firstLine = content.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine) {
    return firstLine.replace(/^#+\s*/, "").slice(0, 80);
  }

  return fileName.replace(/[-_]/g, " ").replace(/\.[^.]+$/, "");
}
