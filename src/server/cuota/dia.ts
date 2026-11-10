// "Hoy" = día calendario en America/Bogota (spec §4.6). Bogotá es UTC-5 todo el año (sin horario de verano).
const DESFASE_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export function inicioDelDiaBogota(ahora: Date): Date {
  const local = ahora.getTime() - DESFASE_MS;
  return new Date(local - (((local % DIA_MS) + DIA_MS) % DIA_MS) + DESFASE_MS);
}
