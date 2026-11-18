"use client";

import { useEffect, useRef, useState } from "react";

const icons = {
  compass: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M9 12h6M9 16h6" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.2 2.2 3.3 4.9 3.3 8S14.2 17.8 12 20c-2.2-2.2-3.3-4.9-3.3-8S9.8 6.2 12 4Z" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h3M11 17h9M14 4v6M7 14v6" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 14-7-4 14-3-6-7-1Z" />
      <path d="m12 13 7-8" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  ),
};

const studioTools = [
  ["Resumen de audio", "Música y síntesis"],
  ["Presentación", "Diapositivas"],
  ["Resumen escrito", "Ideas clave"],
  ["Mapa mental", "Conexiones"],
  ["Infografía", "Visual"],
  ["Tarjetas didácticas", "Memoria"],
  ["Cuestionario", "Práctica"],
  ["Tabla de datos", "Organizar"],
];

export default function Home() {
  type User = { id: string; email: string; name: string };
  type Espacio = { id: string; nombre: string; materia?: string | null; fuentesCount: number; updatedAt: string };
  type Fuente = { id: string; nombreArchivo: string; tipo: "pdf" | "docx" | "pptx" | "txt"; estado: "procesando" | "listo" | "error"; error?: string | null; createdAt?: string };
  type ChatMensaje = { id: string; rol: "user" | "assistant"; contenido: string; fuentesCitadas?: Array<{ fuenteId: string; nombreArchivo: string; pagina?: number | null; fragmento: string }>; createdAt: string };
  type Generacion = { id: string; tipo: "resumen" | "quiz" | "flashcards"; contenido: any; fuentesCitadas: Array<{ fuenteId: string; nombreArchivo: string; pagina?: number | null }>; createdAt: string };

  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [activeId, setActiveId] = useState("");
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [generaciones, setGeneraciones] = useState<Generacion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceMateria, setSpaceMateria] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSpace = espacios.find((item) => item.id === activeId);

  async function api(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.mensaje || "Ocurrió un error inesperado";
      if (response.status === 401) {
        localStorage.removeItem("northspace_token");
        localStorage.removeItem("northspace_user");
        setToken("");
        setUser(null);
        setAuthOpen(true);
      }
      throw new Error(message);
    }
    return data;
  }

  async function loadEspacios(accessToken: string, preferredId?: string) {
    const oldToken = token;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await fetch("/api/v1/espacios", { headers });
    if (!response.ok) throw new Error("No fue posible cargar tus cuadernos");
    const data: Espacio[] = await response.json();
    setEspacios(data);
    if (preferredId && data.some((item) => item.id === preferredId)) {
      setActiveId(preferredId);
    } else if (data.length) {
      setActiveId(data[0].id);
    } else {
      setActiveId("");
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("northspace_token") || "";
    const savedUser = localStorage.getItem("northspace_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch { setUser(null); }
      loadEspacios(savedToken).catch(() => setAuthOpen(false));
    } else {
      setEspacios([{ id: "demo", nombre: "Mi primer cuaderno", materia: "Modo demostración", fuentesCount: 0, updatedAt: new Date().toISOString() }]);
      setActiveId("demo");
      setAuthOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!token || !activeId) {
      setFuentes([]); setMensajes([]); setGeneraciones([]); return;
    }
    let cancelled = false;
    async function loadSpace() {
      try {
        const [detail, chat, generations] = await Promise.all([
          api(`/api/v1/espacios/${activeId}`),
          api(`/api/v1/espacios/${activeId}/chat`),
          api(`/api/v1/espacios/${activeId}/generaciones`),
        ]);
        if (cancelled) return;
        setFuentes(detail.fuentes || []);
        setMensajes(chat || []);
        setGeneraciones(generations || []);
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "No fue posible cargar el cuaderno");
      }
    }
    loadSpace();
    return () => { cancelled = true; };
  }, [token, activeId]);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true); setAuthError("");
    try {
      const endpoint = authMode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const payload = authMode === "login"
        ? { email: authEmail, password: authPassword }
        : { name: authName, email: authEmail, password: authPassword };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.mensaje || "No fue posible iniciar sesión");
      localStorage.setItem("northspace_token", data.accessToken);
      localStorage.setItem("northspace_user", JSON.stringify(data.user));
      setToken(data.accessToken); setUser(data.user); setAuthOpen(false);
      await loadEspacios(data.accessToken);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No fue posible continuar");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("northspace_token");
    localStorage.removeItem("northspace_user");
    setToken(""); setUser(null); setEspacios([]); setActiveId(""); setAuthOpen(true);
  }

  async function createSpace(event: React.FormEvent) {
    event.preventDefault();
    setBusy("Espacio"); setNotice("");
    try {
      if (!token) {
        const created: Espacio = {
          id: `demo-${Date.now()}`,
          nombre: spaceName,
          materia: spaceMateria || null,
          fuentesCount: 0,
          updatedAt: new Date().toISOString(),
        };
        setEspacios((items) => [created, ...items]);
        setActiveId(created.id); setFuentes([]); setMensajes([]); setGeneraciones([]);
        setNewSpaceOpen(false); setSpaceName(""); setSpaceMateria("");
        return;
      }
      const created = await api("/api/v1/espacios", {
        method: "POST",
        body: JSON.stringify({ nombre: spaceName, materia: spaceMateria || undefined }),
      });
      setEspacios((items) => [created, ...items]);
      setActiveId(created.id); setNewSpaceOpen(false); setSpaceName(""); setSpaceMateria("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible crear el cuaderno"); }
    finally { setBusy(""); }
  }

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!activeId || !files.length) return;
    setBusy("Subiendo"); setNotice("");
    try {
      if (!token) {
        const localSources: Fuente[] = files.map((file, index) => ({
          id: `demo-file-${Date.now()}-${index}`,
          nombreArchivo: file.name,
          tipo: (file.name.split(".").pop()?.toLowerCase() || "txt") as Fuente["tipo"],
          estado: "listo",
          createdAt: new Date().toISOString(),
        }));
        setFuentes((items) => [...localSources, ...items]);
        setEspacios((items) => items.map((item) => item.id === activeId ? { ...item, fuentesCount: item.fuentesCount + localSources.length } : item));
        return;
      }
      for (const file of files) {
        const form = new FormData();
        form.append("archivo", file);
        const fuente = await api(`/api/v1/espacios/${activeId}/fuentes`, { method: "POST", body: form });
        setFuentes((items) => [fuente, ...items.filter((item) => item.id !== fuente.id)]);
      }
      const updated = await api(`/api/v1/espacios/${activeId}/fuentes`);
      setFuentes(updated || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible subir el archivo"); }
    finally { setBusy(""); }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || !activeId) return;
    setBusy("Chat"); setNotice("");
    setMensajes((items) => [...items, { id: `local-user-${Date.now()}`, rol: "user", contenido: message, createdAt: new Date().toISOString() }]);
    setPrompt("");
    try {
      if (!token) {
        const response: ChatMensaje = {
          id: `local-assistant-${Date.now()}`,
          rol: "assistant",
          contenido: fuentes.length
            ? `Entendido. Cuando conectes las claves de IA, podré analizar tus ${fuentes.length} fuente(s) y responder con citas. Por ahora estoy mostrando el diseño del cuaderno.`
            : "Primero añade una fuente a tu cuaderno. Después podrás hacer preguntas y recibir respuestas basadas en ella.",
          createdAt: new Date().toISOString(),
        };
        setMensajes((items) => [...items, response]);
        return;
      }
      const assistant = await api(`/api/v1/espacios/${activeId}/chat`, { method: "POST", body: JSON.stringify({ mensaje: message }) });
      setMensajes((items) => [...items, assistant]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible responder"); }
    finally { setBusy(""); }
  }

  async function generate(type: "resumen" | "quiz" | "flashcards") {
    if (!activeId) return;
    setBusy(type); setNotice("");
    try {
      if (!token) {
        const item: Generacion = {
          id: `demo-generation-${Date.now()}`,
          tipo: type,
          contenido: type === "resumen"
            ? { texto: "Conecta una fuente y las claves de IA para generar aquí el resumen real de tu contenido." }
            : type === "quiz"
              ? { preguntas: [] }
              : { tarjetas: [] },
          fuentesCitadas: [],
          createdAt: new Date().toISOString(),
        };
        setGeneraciones((items) => [item, ...items]);
        return;
      }
      const item = await api(`/api/v1/espacios/${activeId}/generaciones`, {
        method: "POST",
        body: JSON.stringify({ tipo: type, cantidad: type === "quiz" ? 5 : type === "flashcards" ? 10 : undefined }),
      });
      setGeneraciones((items) => [item, ...items]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible generar el estudio"); }
    finally { setBusy(""); }
  }

  async function deleteSource(id: string) {
    try {
      if (!token) {
        setFuentes((items) => items.filter((item) => item.id !== id));
        setEspacios((items) => items.map((item) => item.id === activeId ? { ...item, fuentesCount: Math.max(0, item.fuentesCount - 1) } : item));
        return;
      }
      await api(`/api/v1/fuentes/${id}`, { method: "DELETE" });
      setFuentes((items) => items.filter((item) => item.id !== id));
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar la fuente"); }
  }

  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "NS";

  return (
    <main className="northspace-shell">
      <aside className="left-panel">
        <div className="brand-row">
          <div className="brand-mark"><span>{icons.compass}</span></div>
          <div><div className="brand-name">NorthSpace</div><div className="brand-subtitle">Universidad del Norte</div></div>
        </div>

        <div className="panel-heading">
          <span>Mis cuadernos</span>
          <button className="icon-button" aria-label="Nuevo cuaderno" onClick={() => setNewSpaceOpen(true)}>{icons.plus}</button>
        </div>

        <div className="space-list">
          {espacios.map((space) => (
            <button key={space.id} className={`space-item ${activeId === space.id ? "active" : ""}`} onClick={() => setActiveId(space.id)}>
              <span className="space-glyph">✦</span>
              <span><strong>{space.nombre}</strong><small>{space.materia || `${space.fuentesCount} fuentes`}</small></span>
            </button>
          ))}
          {!espacios.length && <button className="empty-space" onClick={() => setNewSpaceOpen(true)}>+ Crear tu primer cuaderno</button>}
        </div>

        <div className="panel-heading sources-heading"><span>Fuentes</span><button className="icon-button" aria-label="Añadir fuente" onClick={() => fileRef.current?.click()}>{icons.plus}</button></div>
        <input ref={fileRef} className="hidden-input" type="file" accept=".pdf,.docx,.pptx,.txt" multiple onChange={uploadFiles} />

        {fuentes.length ? (
          <div className="source-list">
            {fuentes.map((source) => (
              <div className="source-item" key={source.id}>
                <span className="source-type">{source.tipo.toUpperCase()}</span>
                <span className="source-info"><strong>{source.nombreArchivo}</strong><small className={`source-${source.estado}`}>{source.estado === "listo" ? "Lista" : source.estado === "procesando" ? "Procesando..." : source.error || "Error"}</small></span>
                <button aria-label="Eliminar fuente" onClick={() => deleteSource(source.id)}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="source-empty">
            <span className="empty-orbit"><span>{icons.document}</span></span>
            <p><strong>Tus fuentes aparecerán aquí</strong></p>
            <p>Añade archivos PDF, DOCX, PPTX o TXT para comenzar.</p>
          </div>
        )}

        <div className="user-row">
          <div className="avatar">{initials}</div>
          <div><strong>{user?.name || "Explorador"}</strong><span>{user?.email || "Sin sesión"}</span></div>
          {user && <button className="logout-button" onClick={logout}>Salir</button>}
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div><span className="eyebrow">{activeSpace?.materia || "CUADERNO ACTIVO"}</span><h1>{activeSpace?.nombre || "Mi viaje de aprendizaje"}</h1></div>
          <div className="header-actions">
            <button className="header-icon" aria-label="Buscar">{icons.search}</button>
            <button className="new-notebook" onClick={() => setNewSpaceOpen(true)}><span>{icons.plus}</span> Nuevo cuaderno</button>
            <div className="profile-avatar">{initials}</div>
          </div>
        </header>

        <div className="canvas">
          <section className="chat-panel">
            <div className="chat-topline">
              <div className="companion"><div className="companion-star">✦</div><div><strong>Guía North</strong><span>Tu compañero de estudio</span></div></div>
              {mensajes.length > 0 && <button className="clear-chat" onClick={async () => { try { if (!token) { setMensajes([]); return; } await api(`/api/v1/espacios/${activeId}/chat`, { method: "DELETE" }); setMensajes([]); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible limpiar el chat"); } }}>Limpiar chat</button>}
            </div>

            {mensajes.length === 0 ? (
              <div className="welcome">
                <div className="welcome-sigil"><span>✦</span></div>
                <span className="welcome-kicker">BIENVENIDO A NORTHSPACE</span>
                <h2>Vamos a empezar tu <em>gran aventura</em></h2>
                <p>{fuentes.some((item) => item.estado === "listo") ? "Tus fuentes están listas. Pregunta lo que quieras aprender." : "Crea un cuaderno y añade tus fuentes para comenzar."}</p>
              </div>
            ) : (
              <div className="messages">
                {mensajes.map((message) => (
                  <div key={message.id} className={`message ${message.rol}`}>
                    <div className="message-author">{message.rol === "user" ? initials : "✦ North"}</div>
                    <p>{message.contenido}</p>
                    {message.fuentesCitadas && message.fuentesCitadas.length > 0 && <div className="citations">{message.fuentesCitadas.map((cite, index) => <span key={`${cite.fuenteId}-${index}`}>C{index + 1} · {cite.nombreArchivo}{cite.pagina ? ` · p. ${cite.pagina}` : ""}</span>)}</div>}
                  </div>
                ))}
              </div>
            )}

            {mensajes.length === 0 && <div className="suggestions">
              <button onClick={() => setPrompt("Explícame los conceptos clave de mis fuentes")}><span className="suggestion-icon">↗</span><strong>Aprende sobre un tema nuevo</strong><small>Explorar conceptos</small></button>
              <button onClick={() => setPrompt("Crea una guía de estudio sencilla")}><span className="suggestion-icon">✦</span><strong>Crea algo nuevo</strong><small>Generar ideas</small></button>
              <button onClick={() => setPrompt("Hazme un plan de estudio para esta materia")}><span className="suggestion-icon">◈</span><strong>Avanza en un proyecto</strong><small>Organizar trabajo</small></button>
            </div>}

            {notice && <div className="notice">{notice}</div>}

            <form className="composer" onSubmit={sendMessage}>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={activeId ? "Pregunta algo a tu cuaderno..." : "Primero crea o selecciona un cuaderno..."} aria-label="Pregunta a NorthSpace" maxLength={4000} disabled={!activeId || busy === "Chat"} />
              <div className="composer-footer"><button type="button" className="tool-button" aria-label="Añadir herramienta">{icons.sliders}</button><span>{prompt.length}/4000</span><button className="send-button" type="submit" aria-label="Enviar" disabled={!activeId || !prompt.trim() || busy === "Chat"}><span>{busy === "Chat" ? "···" : icons.send}</span></button></div>
            </form>
          </section>

          <aside className="studio-panel">
            <div className="studio-heading"><div><span className="eyebrow">ESTUDIO</span><h2>Crear conocimiento</h2></div><button className="icon-button" aria-label="Opciones">{icons.sliders}</button></div>

            <div className="studio-grid">
              <button className="studio-card" onClick={() => generate("resumen")} disabled={!!busy || !activeId}><span className="tool-glyph">▱</span><span><strong>Resumen escrito</strong><small>{busy === "resumen" ? "Generando..." : "Ideas clave"}</small></span></button>
              <button className="studio-card" onClick={() => generate("flashcards")} disabled={!!busy || !activeId}><span className="tool-glyph glyph-1">▧</span><span><strong>Tarjetas didácticas</strong><small>{busy === "flashcards" ? "Generando..." : "Memoria"}</small></span></button>
              <button className="studio-card" onClick={() => generate("quiz")} disabled={!!busy || !activeId}><span className="tool-glyph glyph-2">?</span><span><strong>Cuestionario</strong><small>{busy === "quiz" ? "Generando..." : "Práctica"}</small></span></button>
              <button className="studio-card" disabled><span className="tool-glyph glyph-3">≡</span><span><strong>Tabla de datos</strong><small>Próximamente</small></span></button>
            </div>

            <div className="results-list">
              {generaciones.map((item) => (
                <article className="result-card" key={item.id}>
                  <span className="result-type">{item.tipo}</span>
                  {item.tipo === "resumen" && <p>{item.contenido?.texto}</p>}
                  {item.tipo === "quiz" && <p>{item.contenido?.preguntas?.length || 0} preguntas listas para practicar</p>}
                  {item.tipo === "flashcards" && <p>{item.contenido?.tarjetas?.length || 0} tarjetas creadas</p>}
                </article>
              ))}
              {!generaciones.length && <div className="studio-empty"><div className="crystal">◆</div><p>Los resultados de estudio aparecerán aquí.</p></div>}
            </div>
          </aside>
        </div>
      </section>

      {newSpaceOpen && <div className="modal-backdrop"><form className="auth-card space-modal" onSubmit={createSpace}><button type="button" className="modal-close" onClick={() => setNewSpaceOpen(false)}>×</button><span className="auth-mark">✦</span><span className="welcome-kicker">NUEVO CUADERNO</span><h2>¿Qué vas a explorar?</h2><label>Nombre<input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} required maxLength={120} placeholder="Ej. Compiladores" /></label><label>Materia <span>(opcional)</span><input value={spaceMateria} onChange={(event) => setSpaceMateria(event.target.value)} maxLength={120} placeholder="Ej. Ingeniería de Sistemas" /></label>{notice && <div className="auth-error">{notice}</div>}<button className="auth-submit" type="submit" disabled={busy === "Espacio"}>{busy === "Espacio" ? "Creando..." : "Crear cuaderno"}</button></form></div>}
    </main>
  );
}
