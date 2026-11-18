// Archivos de prueba para scripts/smoke.sh: PDF de 3 páginas (Helvetica, WinAnsi), PDF sin texto, TXT con BOM,
// DOCX, PPTX de 2 diapositivas (con jszip, ya instalado), archivo de 5 MB y un .exe. Uso: node scripts/fixtures.mjs <dir>
import { writeFileSync } from "node:fs";
import JSZip from "jszip";

const dir = process.argv[2];
if (!dir) throw new Error("Uso: node scripts/fixtures.mjs <dir>");

// PDF mínimo válido: una página por arreglo de líneas; un arreglo vacío = página sin texto.
function pdf(paginas) {
  const objs = [];
  const add = (s) => (objs.push(s), objs.length);
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pagesId = objs.length + 1 + paginas.length * 2;
  const kids = [];
  for (const lineas of paginas) {
    const esc = (t) => t.replace(/[\\()]/g, (c) => "\\" + c);
    const body = lineas.length ? "BT /F1 11 Tf 14 TL 50 790 Td " + lineas.map((l) => `(${esc(l)}) '`).join(" ") + " ET" : "";
    const content = add(`<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const p1 = [
  "Tema 2. Análisis léxico",
  "El analizador léxico es la primera fase de un compilador. Lee los caracteres",
  "del programa fuente y los agrupa en componentes léxicos (tokens), que entrega",
  "al analizador sintáctico. También elimina espacios en blanco y comentarios.",
  "",
  "Un token es un par formado por un nombre y un valor de atributo opcional.",
  "Un lexema es la secuencia de caracteres del programa fuente que coincide con",
  "el patrón de un token. Un patrón describe la forma que pueden tomar los lexemas.",
  "",
  "Ejemplo: en la instrucción  posición = inicial + velocidad * 60  los lexemas",
  "son posición, =, inicial, +, velocidad, * y 60. Los identificadores se guardan",
  "en la tabla de símbolos junto con sus atributos.",
];
const p2 = [
  "Expresiones regulares y autómatas",
  "Los patrones de los tokens se especifican con expresiones regulares. Por ejemplo,",
  "un identificador es una letra seguida de cero o más letras o dígitos.",
  "Las expresiones regulares se convierten en autómatas finitos no deterministas",
  "(AFN) mediante la construcción de Thompson, y estos en autómatas finitos",
  "deterministas (AFD) mediante la construcción de subconjuntos.",
  "",
  "Un AFD reconoce el lexema más largo posible (regla de la coincidencia más larga).",
  "Si dos patrones reconocen el mismo lexema, gana el que aparece primero en la",
  "especificación, por eso las palabras reservadas se listan antes que los",
  "identificadores. Herramientas como Lex y Flex generan el analizador a partir de",
  "estas especificaciones.",
];
const p3 = [
  "Errores léxicos",
  "Un error léxico ocurre cuando ningún patrón coincide con el prefijo de la entrada,",
  "por ejemplo un carácter no válido como @ en un lenguaje que no lo admite.",
  "La recuperación en modo de pánico elimina caracteres hasta encontrar un token",
  "válido. Otras estrategias son insertar, borrar o reemplazar un carácter, o",
  "intercambiar dos caracteres adyacentes.",
];

writeFileSync(`${dir}/analisis-lexico.pdf`, pdf([p1, p2, p3]));
writeFileSync(`${dir}/escaneado.pdf`, pdf([[], []]));
writeFileSync(
  `${dir}/apuntes.txt`,
  "﻿Resumen de sintaxis\n\nLa gramática libre de contexto define la estructura del lenguaje. Un analizador LL(1) es descendente y predictivo; un analizador LR(1) es ascendente.\n",
);
writeFileSync(`${dir}/grande.txt`, "a".repeat(4.2 * 1024 * 1024)); // > 4 MB de la app, < 4.5 MB de Vercel
writeFileSync(`${dir}/programa.exe`, Buffer.from([0x4d, 0x5a, 0x90, 0x00]));

// DOCX y PPTX mínimos válidos. Su contenido no está en los demás archivos, para probar que el chat los cita.
const zip = async (archivos) => {
  const z = new JSZip();
  for (const [ruta, xml] of Object.entries(archivos)) z.file(ruta, `<?xml version="1.0" encoding="UTF-8"?>${xml}`);
  return z.generateAsync({ type: "nodebuffer" });
};
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
writeFileSync(
  `${dir}/codigo-intermedio.docx`,
  await zip({
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<w:document ${W}><w:body>${[
      "Generación de código intermedio",
      "El código de tres direcciones usa como máximo tres operandos por instrucción, por ejemplo t1 = b * c.",
      "Las cuádruplas guardan el operador, dos argumentos y el resultado de cada instrucción.",
    ]
      .map((t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  }),
);
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const diapositiva = (parrafos) =>
  `<p:sld ${A}><p:cSld><p:spTree><p:sp><p:txBody>${parrafos.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
writeFileSync(
  `${dir}/semantico.pptx`,
  await zip({
    "ppt/slides/slide1.xml": diapositiva(["Análisis semántico", "Tema 4 del curso"]),
    "ppt/slides/slide2.xml": diapositiva([
      "Comprobación de tipos",
      "El analizador semántico verifica que los operandos de cada operador tengan tipos compatibles &amp; aplica coerciones.",
    ]),
  }),
);
