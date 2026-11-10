import { describe, expect, it } from "vitest";
import { inicioDelDiaBogota } from "./dia";

// Bogotá es UTC-5 todo el año (sin horario de verano): el día empieza a las 05:00 UTC.
describe("inicioDelDiaBogota", () => {
  it.each([
    ["mañana en Bogotá (07:00)", "2026-11-07T12:00:00Z", "2026-11-07T05:00:00.000Z"],
    ["noche en Bogotá (22:00 del día anterior en UTC ya es otro día)", "2026-11-07T03:00:00Z", "2026-11-06T05:00:00.000Z"],
    ["justo a medianoche en Bogotá", "2026-11-07T05:00:00Z", "2026-11-07T05:00:00.000Z"],
    ["un milisegundo antes de medianoche", "2026-11-07T04:59:59.999Z", "2026-11-06T05:00:00.000Z"],
    ["cambio de año", "2027-01-01T02:00:00Z", "2026-12-31T05:00:00.000Z"],
  ])("%s", (_, ahora, esperado) => {
    expect(inicioDelDiaBogota(new Date(ahora)).toISOString()).toBe(esperado);
  });
});
