"use client";

import { useState } from "react";

const moods = [
  "Soy Aurora te ayudaré con un resumen, preguntas de práctica, tarjetas de repaso o recomendaciones de estudio, estoy aquí para lo que necesites.",
  "Puedo orientarte con una síntesis breve y bien estructurada.",
  "Sube tu PDF o pega tu texto y lo organizo para tu estudio.",
  "Estoy aquí para ayudarte a estudiar con claridad y método.",
];

export function AuroraMascot() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  function handleInteract() {
    setVisible(true);
    setMessageIndex((current) => (current + 1) % moods.length);
  }

  async function sendMessage(evt?: any) {
    evt?.preventDefault();
    const text = input.trim();
    if (!text) return;

    const userMsg = { role: "user" as const, text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const form = new FormData();
      form.set("text", text);

      const res = await fetch("/api/chat", { method: "POST", body: form });
      if (!res.ok) throw new Error("No se pudo contactar al servidor");
      const data = await res.json();
      const assistantText = String(data.reply ?? "Lo siento, no obtuve respuesta.");
      setMessages((m) => [...m, { role: "assistant", text: assistantText }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: "Ocurrió un error al comunicarse con el servidor." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[18rem] sm:bottom-6 sm:right-6">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          {visible && (
            <div className="w-[18rem] rounded-2xl border border-white/10 bg-[rgba(8,15,31,0.78)] p-3 text-white shadow-[0_12px_40px_rgba(4,8,18,0.35)] backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <p className="uppercase tracking-[0.28em] text-[#f4cf7a] text-xs">Aurora</p>
                <button
                  type="button"
                  onClick={() => setVisible(false)}
                  className="text-slate-300 hover:text-white text-xs"
                  aria-label="Cerrar chat"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-2 max-h-40 space-y-2 overflow-auto pr-2 text-sm">
                {messages.length === 0 ? (
                  <p className="text-slate-300">{moods[messageIndex]}</p>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`rounded-xl p-2 ${m.role === "user" ? "bg-white/8 text-white text-right" : "bg-white/10 text-slate-100 text-left"}`}>
                      <div>{m.text}</div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={sendMessage} className="mt-2 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu pregunta..."
                  className="flex-1 rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-[#f4cf7a] px-3 py-2 text-slate-900 text-sm font-semibold disabled:opacity-60"
                >
                  {loading ? "..." : "Enviar"}
                </button>
              </form>
            </div>
          )}

        <button
          type="button"
          onClick={handleInteract}
          className="group relative grid h-14 w-14 place-items-center rounded-full border border-white/18 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(191,230,255,0.96)_36%,rgba(145,196,255,0.82)_66%,rgba(89,145,216,0.9)_100%)] shadow-[0_10px_30px_rgba(88,211,255,0.18)] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_48px_rgba(244,207,122,0.12)]"
          style={{ animation: "float-soft 6s ease-in-out infinite" }}
          aria-label="Interactuar con Aurora"
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_50%)] opacity-90" />
          <span className="absolute inset-2 rounded-full border border-white/35 opacity-65" />
          <span className="absolute left-3 top-3 h-2 w-2 rounded-full border border-slate-900/20 bg-white/95 shadow-[0_0_0_2px_rgba(255,255,255,0.28)]" />
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full border border-slate-900/20 bg-white/95 shadow-[0_0_0_2px_rgba(255,255,255,0.28)]" />
          <span className="absolute top-[2.6rem] h-0.5 w-6 rounded-full bg-slate-100/95" />
          <span className="absolute top-[2.9rem] h-2.5 w-6 rounded-b-full border-b border-white/40 bg-white/70" />
          <span className="absolute top-3 h-4 w-8 rounded-full border border-white/35 bg-[rgba(255,255,255,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" />
          <span className="absolute top-[0.9rem] left-[2.2rem] h-3 w-0.5 rounded-full bg-white/95" />
          <span className="absolute bottom-3 h-4 w-8 rounded-[999px_999px_24px_24px] border border-white/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(201,232,255,0.7))]" />
          <span className="absolute bottom-2 h-1 w-7 rounded-full bg-[rgba(255,255,255,0.55)] blur-sm" />
          <span className="absolute -bottom-1 h-2 w-10 rounded-full bg-[rgba(88,211,255,0.28)] blur-md" />
          <span className="absolute -left-1 top-4 h-3 w-3 rounded-full bg-[rgba(244,207,122,0.18)] blur-md transition duration-300 group-hover:bg-[rgba(244,207,122,0.26)]" />
          <span className="absolute -right-1 bottom-6 h-3 w-3 rounded-full bg-[rgba(88,211,255,0.18)] blur-md transition duration-300 group-hover:bg-[rgba(88,211,255,0.26)]" />
        </button>
      </div>
    </aside>
  );
}
