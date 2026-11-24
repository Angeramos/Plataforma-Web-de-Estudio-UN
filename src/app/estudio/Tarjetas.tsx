"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { FuenteRef, Generacion } from "./exportar";
import { mover, nombreFuente } from "./tarjetas";

type Props = { generacion: Generacion; titulo: string; fuentes: FuenteRef[]; onClose: () => void };

// Repaso de flashcards: una tarjeta a la vez; clic, Espacio o Enter voltea; flechas navegan; Esc cierra.
export default function Tarjetas({ generacion, titulo, fuentes, onClose }: Props) {
  const tarjetas = generacion.contenido.tarjetas ?? [];
  const [indice, setIndice] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const tarjeta = tarjetas[indice];

  function ir(paso: 1 | -1) {
    setIndice((i) => mover(i, tarjetas.length, paso));
    setVolteada(false);
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowRight") ir(1);
    else if (event.key === "ArrowLeft") ir(-1);
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setVolteada((v) => !v);
    }
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="auth-card flashcards-modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>×</button>
        <span className="welcome-kicker">REPASO</span>
        <h2>{titulo}</h2>

        {tarjeta ? (
          <>
            <button
              type="button"
              className={`flashcard ${volteada ? "flipped" : ""}`}
              onClick={() => setVolteada((v) => !v)}
              aria-label={volteada ? "Mostrar la pregunta" : "Mostrar la respuesta"}
            >
              <span className="flashcard-inner">
                <span className="flashcard-face flashcard-front">
                  <strong>{tarjeta.frente}</strong>
                  <small>Toca para ver la respuesta</small>
                </span>
                <span className="flashcard-face flashcard-back">
                  <strong>{tarjeta.reverso}</strong>
                  <small>Fuente: {nombreFuente(fuentes, tarjeta.fuenteId)}</small>
                </span>
              </span>
            </button>

            <div className="flashcard-nav">
              <button type="button" onClick={() => ir(-1)} disabled={indice === 0} aria-label="Tarjeta anterior">◀</button>
              <span>{indice + 1} de {tarjetas.length}</span>
              <button type="button" onClick={() => ir(1)} disabled={indice === tarjetas.length - 1} aria-label="Tarjeta siguiente">▶</button>
            </div>
          </>
        ) : (
          <p className="flashcards-empty">Este material no tiene tarjetas.</p>
        )}
      </section>
    </div>
  );
}
