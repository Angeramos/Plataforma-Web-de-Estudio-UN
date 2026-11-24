// Lógica del repaso de tarjetas en la app (D-052, actualización del 2026-11-23).
export { nombreFuente } from "./exportar";

// Índice de la tarjeta vecina, sin salirse de la primera ni de la última.
export function mover(indice: number, total: number, paso: 1 | -1): number {
  return Math.min(Math.max(indice + paso, 0), Math.max(total - 1, 0));
}
