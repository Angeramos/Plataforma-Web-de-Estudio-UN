import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const institutionalDir = path.join(process.cwd(), "src", "content", "institutional");

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Debes enviar un archivo." }, { status: 400 });
  }

  const originalName = file.name;
  const extension = path.extname(originalName).toLowerCase();
  const baseName = createSlug(title || originalName.replace(/\.[^.]+$/, "")) || "material-institucional";
  const rawText = await extractText(file, extension, originalName);
  const cleanedText = cleanText(rawText);

  if (!cleanedText) {
    return NextResponse.json({ error: "No se pudo extraer texto del archivo." }, { status: 422 });
  }

  await fs.mkdir(institutionalDir, { recursive: true });
  const fileName = await getAvailableFileName(baseName);
  const markdown = buildMarkdown(title || originalName, originalName, cleanedText);
  const targetPath = path.join(institutionalDir, fileName);

  await fs.writeFile(targetPath, markdown, "utf8");

  return NextResponse.json({
    ok: true,
    fileName,
    title: title || originalName,
  });
}

async function extractText(file: File, extension: string, originalName: string) {
  if (extension === ".pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await new PDFParse({ data: buffer }).getText();
    return parsed.text;
  }

  if (extension === ".docx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (extension === ".pptx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return extractPptxText(buffer);
  }

  if (extension === ".txt" || extension === ".md") {
    return await file.text();
  }

  const fallback = await file.text();
  if (fallback.trim()) {
    return fallback;
  }

  return originalName;
}

async function extractPptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((fileName) => /^ppt\/slides\/slide\d+\.xml$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const slideTexts: string[] = [];

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile)?.async("string");
    if (!xml) {
      continue;
    }

    const text = Array.from(xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gi))
      .map((match) => decodeXml(match[1]))
      .join(" ")
      .trim();

    if (text) {
      slideTexts.push(text);
    }
  }

  return slideTexts.join("\n\n");
}

async function getAvailableFileName(baseName: string) {
  const initialName = `${baseName}.md`;
  const initialPath = path.join(institutionalDir, initialName);

  if (!(await pathExists(initialPath))) {
    return initialName;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${baseName}-${suffix}.md`;
    const candidatePath = path.join(institutionalDir, candidate);
    if (!(await pathExists(candidatePath))) {
      return candidate;
    }
    suffix += 1;
  }

  return `${baseName}-${Date.now()}.md`;
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildMarkdown(title: string, originalName: string, content: string) {
  return `# ${title}\n\nArchivo original: ${originalName}\n\n${content}\n`;
}

function cleanText(content: string) {
  return content.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
