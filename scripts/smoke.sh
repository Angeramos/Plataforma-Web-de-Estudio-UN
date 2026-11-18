#!/usr/bin/env bash
# Prueba de humo del API v1 con curl (spec §6). Corte A: auth, espacios y fuentes. Corte B: generaciones y chat.
# Uso: scripts/smoke.sh [URL base]   (por defecto http://localhost:3000/api/v1, con `npm run dev` corriendo)
# Requiere curl, node y las claves reales de Groq y Gemini (gasta 3 generaciones y 2 mensajes de la cuota del día).
# Crea dos usuarios smoke.*@example.com que quedan en la BD (no hay endpoint para borrarlos).
set -uo pipefail

BASE="${1:-http://localhost:3000/api/v1}"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT
node "$(dirname "$0")/fixtures.mjs" "$DIR" >/dev/null

fallos=0
STATUS="" BODY=""

# req MÉTODO RUTA [TOKEN] [JSON]  |  upload ESPACIO TOKEN ARCHIVO   → deja STATUS y BODY
req() {
  local args=(-s -o "$DIR/body" -w '%{http_code}' -X "$1" "$BASE$2")
  [[ -n "${3:-}" ]] && args+=(-H "authorization: Bearer $3")
  [[ -n "${4:-}" ]] && args+=(-H 'content-type: application/json' --data "$4")
  STATUS=$(curl "${args[@]}"); BODY=$(cat "$DIR/body")
}
upload() {
  STATUS=$(curl -s -o "$DIR/body" -w '%{http_code}' -X POST "$BASE/espacios/$1/fuentes" -H "authorization: Bearer $2" -F "archivo=@$DIR/$3")
  BODY=$(cat "$DIR/body")
}
# campo RUTA.CON.PUNTOS del JSON en BODY (sin jq)
campo() {
  node -e 'const v=process.argv[1].split(".").reduce((o,k)=>o?.[k],JSON.parse(process.argv[2]));console.log(typeof v==="object"?JSON.stringify(v):v)' "$1" "$BODY"
}
# check DESCRIPCIÓN STATUS_ESPERADO [CAMPO VALOR_ESPERADO]
check() {
  local ok=1 extra=""
  [[ "$STATUS" == "$2" ]] || ok=0
  if [[ $ok == 1 && -n "${3:-}" ]]; then
    local real; real=$(campo "$3")
    [[ "$real" == "$4" ]] || { ok=0; extra=" ($3=$real, se esperaba $4)"; }
  fi
  if [[ $ok == 1 ]]; then echo "✓ $1"; else echo "✗ $1 → HTTP $STATUS$extra: ${BODY:0:200}"; fallos=$((fallos + 1)); fi
}
# cumple DESCRIPCIÓN EXPRESIÓN_JS   (la expresión ve el JSON de BODY como `b`)
cumple() {
  if node -e 'const b=JSON.parse(process.argv[2]);process.exit(eval(process.argv[1])?0:1)' "$2" "$BODY" 2>/dev/null; then echo "✓ $1"
  else echo "✗ $1: ${BODY:0:300}"; fallos=$((fallos + 1)); fi
}

sello="$(date +%s)$RANDOM"
EA="smoke.a.$sello@example.com"; EB="smoke.b.$sello@example.com"
PASS="clave-segura-1"

echo "== Auth ($BASE)"
req POST /auth/register "" "{\"email\":\"$EA\",\"password\":\"$PASS\",\"name\":\"Smoke A\"}"; check "register A" 201
req POST /auth/register "" "{\"email\":\"${EA^^}\",\"password\":\"$PASS\",\"name\":\"Otro\"}"; check "register correo repetido (mayúsculas) → 409" 409 error.codigo EMAIL_YA_REGISTRADO
req POST /auth/register "" "{\"email\":\"$EB\",\"password\":\"$PASS\",\"name\":\"Smoke B\"}"; check "register B" 201
TB=$(campo accessToken)
req POST /auth/login "" "{\"email\":\"$EA\",\"password\":\"$PASS\"}"; check "login A" 200
TA=$(campo accessToken)
req POST /auth/login "" "{\"email\":\"$EA\",\"password\":\"incorrecta\"}"; check "login con clave mala → 401" 401 error.codigo NO_AUTENTICADO
req GET /auth/me "$TA"; check "me" 200 email "$EA"
req GET /auth/me; check "me sin token → 401" 401

echo "== Espacios"
req POST /espacios "$TA" '{"nombre":"Compiladores","materia":"Ingeniería de Sistemas"}'; check "crear espacio" 201 fuentesCount 0
E=$(campo id)
req POST /espacios "$TA" '{"nombre":""}'; check "nombre vacío → 400" 400 error.codigo VALIDACION
req GET /espacios "$TA"; check "listar espacios" 200 0.id "$E"
req GET "/espacios/$E" "$TB"; check "B ve el espacio de A → 404" 404 error.codigo NO_ENCONTRADO
req GET /espacios/no-es-uuid "$TA"; check "id no-UUID → 404" 404
req PATCH "/espacios/$E" "$TA" '{"nombre":"Compiladores II"}'; check "renombrar" 200 nombre "Compiladores II"

echo "== Fuentes"
upload "$E" "$TA" apuntes.txt; check "subir TXT → listo" 202 estado listo
upload "$E" "$TA" analisis-lexico.pdf; check "subir PDF → listo" 202 estado listo
FP=$(campo id)
upload "$E" "$TA" escaneado.pdf; check "PDF sin texto → error" 202 estado error
upload "$E" "$TA" codigo-intermedio.docx; check "subir DOCX → listo" 202 estado listo
upload "$E" "$TA" semantico.pptx; check "subir PPTX → listo" 202 estado listo
upload "$E" "$TA" programa.exe; check "tipo no soportado → 415" 415 error.codigo TIPO_NO_SOPORTADO
upload "$E" "$TA" grande.txt; check "archivo > límite → 413" 413 error.codigo ARCHIVO_MUY_GRANDE
upload "$E" "$TB" apuntes.txt; check "B sube al espacio de A → 404" 404
req GET "/espacios/$E/fuentes" "$TA"; check "listar fuentes" 200 1.nombreArchivo analisis-lexico.pdf
req GET "/espacios/$E" "$TA"; check "detalle con fuentes" 200 fuentesCount 5

echo "== Generaciones (Groq real)"
req GET "/espacios/$E/fuentes" "$TA"
IDS=$(node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1]).filter(f=>f.estado==="listo").map(f=>f.id)))' "$BODY")
req POST /espacios "$TA" '{"nombre":"Vacío"}'; EV=$(campo id)
req POST "/espacios/$EV/generaciones" "$TA" '{"tipo":"resumen"}'; check "generar sin fuentes listas → 409" 409 error.codigo SIN_FUENTES_LISTAS
req POST "/espacios/$E/generaciones" "$TA" '{"tipo":"resumen"}'; check "resumen" 201 tipo resumen
cumple "  cita solo fuentes del espacio" "const ids=$IDS; b.fuentesCitadas.length>0 && b.fuentesCitadas.every(f=>ids.includes(f.fuenteId))"
req POST "/espacios/$E/generaciones" "$TA" '{"tipo":"quiz","cantidad":3}'; check "quiz (cantidad 3)" 201 tipo quiz
GQ=$(campo id)
cumple "  1-3 preguntas, 4 opciones, correcta 0-3, fuenteId del espacio" "const ids=$IDS, p=b.contenido.preguntas; p.length>=1 && p.length<=3 && p.every(x=>x.opciones.length===4 && x.correcta>=0 && x.correcta<=3 && ids.includes(x.fuenteId))"
req POST "/espacios/$E/generaciones" "$TA" '{"tipo":"flashcards"}'; check "flashcards" 201 tipo flashcards
cumple "  1-10 tarjetas con fuenteId del espacio" "const ids=$IDS, t=b.contenido.tarjetas; t.length>=1 && t.length<=10 && t.every(x=>x.frente && x.reverso && ids.includes(x.fuenteId))"
req POST "/espacios/$E/generaciones" "$TA" '{"tipo":"poema"}'; check "tipo inválido → 400" 400 error.codigo VALIDACION
req GET "/espacios/$E/generaciones" "$TA"; check "listar generaciones (recientes primero)" 200 0.tipo flashcards
req GET "/espacios/$E/generaciones?tipo=quiz" "$TA"; check "filtrar por tipo" 200 0.id "$GQ"
req GET "/espacios/$E/generaciones" "$TB"; check "B lista las generaciones de A → 404" 404
req DELETE "/generaciones/$GQ" "$TB"; check "B borra una generación de A → 404" 404
req DELETE "/generaciones/$GQ" "$TA"; check "borrar generación" 204

echo "== Chat (Groq + Gemini reales)"
req POST "/espacios/$EV/chat" "$TA" '{"mensaje":"¿Qué es un token?"}'; check "chat sin fuentes listas → 409" 409 error.codigo SIN_FUENTES_LISTAS
req POST "/espacios/$E/chat" "$TA" '{"mensaje":"¿Qué hace la recuperación en modo de pánico?"}'; check "pregunta del material" 201 rol assistant
cumple "  cita la pág. 3 del PDF con su fragmento" 'b.fuentesCitadas.some(c=>c.nombreArchivo==="analisis-lexico.pdf" && c.pagina===3 && /pánico/.test(c.fragmento))'
req POST "/espacios/$E/chat" "$TA" '{"mensaje":"¿Quién ganó el mundial de fútbol de 2014?"}'; check "pregunta fuera del material → no encontré" 201 contenido "No encontré eso en tus fuentes."
cumple "  sin citas" 'b.fuentesCitadas.length===0'
req POST "/espacios/$E/chat" "$TA" '{"mensaje":"¿Qué verifica la comprobación de tipos?"}'; check "pregunta que solo responde el PPTX" 201 rol assistant
cumple "  cita la diapositiva 2 del PPTX" 'b.fuentesCitadas.some(c=>c.nombreArchivo==="semantico.pptx" && c.pagina===2)'
req POST "/espacios/$E/chat" "$TA" '{"mensaje":"¿Cuántos operandos usa como máximo el código de tres direcciones?"}'; check "pregunta que solo responde el DOCX" 201 rol assistant
cumple "  cita el DOCX (sin página)" 'b.fuentesCitadas.some(c=>c.nombreArchivo==="codigo-intermedio.docx" && c.pagina===null)'
req POST "/espacios/$E/chat" "$TA" '{"mensaje":"   "}'; check "mensaje vacío → 400" 400 error.codigo VALIDACION
req GET "/espacios/$E/chat" "$TA"; check "historial" 200 0.rol user
cumple "  8 mensajes en orden user/assistant" 'b.length===8 && b.every((m,i)=>m.rol===(i%2?"assistant":"user"))'
req GET "/espacios/$E/chat" "$TB"; check "B lee el chat de A → 404" 404
req DELETE "/espacios/$E/chat" "$TA"; check "limpiar chat" 204
req GET "/espacios/$E/chat" "$TA"; cumple "  historial vacío" 'b.length===0'
req DELETE "/espacios/$EV" "$TA"; check "borrar espacio vacío" 204

echo "== Borrado"
req DELETE "/fuentes/$FP" "$TB"; check "B borra fuente de A → 404" 404
req DELETE "/fuentes/$FP" "$TA"; check "borrar fuente" 204
req DELETE "/espacios/$E" "$TA"; check "borrar espacio" 204
req GET "/espacios/$E" "$TA"; check "espacio borrado → 404" 404

echo
if [[ $fallos == 0 ]]; then echo "OK: todo en verde"; else echo "FALLARON $fallos"; fi
exit $(( fallos > 0 ))
