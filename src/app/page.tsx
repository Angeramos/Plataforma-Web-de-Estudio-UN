"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { descargarBlob } from "./estudio/descarga";
import { armarDocumento, detalleCorto, ETIQUETA, nombreArchivo, type Generacion } from "./estudio/exportar";
import Tarjetas from "./estudio/Tarjetas";

type User = { id: string; email: string; name: string };
type Espacio = { id: string; nombre: string; materia?: string | null; fuentesCount: number; updatedAt: string };
type Fuente = {
  id: string;
  nombreArchivo: string;
  tipo: "pdf" | "docx" | "pptx" | "txt";
  estado: "procesando" | "listo" | "error";
  error?: string | null;
  createdAt?: string;
};
type Cita = { fuenteId: string; nombreArchivo: string; pagina?: number | null; fragmento: string };
type ChatMensaje = { id: string; rol: "user" | "assistant"; contenido: string; fuentesCitadas?: Cita[]; createdAt: string };

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

const authStorage = {
  token: "northspace_token",
  user: "northspace_user",
};

// Mismo valor por defecto que MAX_UPLOAD_MB del backend; el servidor lo vuelve a validar.
const MAX_UPLOAD_MB = 4;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

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
  const [repaso, setRepaso] = useState<Generacion | null>(null);
  const [spaceName, setSpaceName] = useState("");
  const [spaceMateria, setSpaceMateria] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const activeSpace = espacios.find((item) => item.id === activeId);

  // Fuentes desmarcadas por espacio (D-053): así toda fuente nueva entra marcada y cada espacio guarda su selección.
  const [excluidasPorEspacio, setExcluidasPorEspacio] = useState<Record<string, string[]>>({});
  const excluidas = excluidasPorEspacio[activeId] ?? [];
  const fuentesListas = fuentes.filter((item) => item.estado === "listo");
  const seleccionadas = fuentesListas.filter((item) => !excluidas.includes(item.id));

  function toggleFuente(id: string) {
    setExcluidasPorEspacio((prev) => {
      const actuales = prev[activeId] ?? [];
      return { ...prev, [activeId]: actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id] };
    });
  }

  function marcarTodas(marcar: boolean) {
    setExcluidasPorEspacio((prev) => ({ ...prev, [activeId]: marcar ? [] : fuentesListas.map((item) => item.id) }));
  }

  async function request(path: string, options: RequestInit = {}, forceToken?: string) {
    const sessionToken = forceToken ?? token;
    const headers = new Headers(options.headers || {});
    if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.mensaje || "Ocurrió un error inesperado";
      if (response.status === 401) {
        logout(true);
      }
      throw new Error(message);
    }
    return data;
  }

  function persistSession(nextToken: string, nextUser: User) {
    localStorage.setItem(authStorage.token, nextToken);
    localStorage.setItem(authStorage.user, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setAuthOpen(false);
  }

  function logout(isExpired = false) {
    localStorage.removeItem(authStorage.token);
    localStorage.removeItem(authStorage.user);
    setToken("");
    setUser(null);
    setEspacios([]);
    setActiveId("");
    setFuentes([]);
    setMensajes([]);
    setGeneraciones([]);
    setAuthOpen(true);
    if (isExpired) setAuthError("Tu sesión expiró. Inicia sesión de nuevo.");
  }

  async function loadEspacios(accessToken?: string, preferredId?: string) {
    const data = (await request("/api/v1/espacios", {}, accessToken)) as Espacio[];
    setEspacios(data);
    if (!data.length) {
      setActiveId("");
      setFuentes([]);
      setMensajes([]);
      setGeneraciones([]);
      return;
    }
    if (preferredId && data.some((item) => item.id === preferredId)) {
      setActiveId(preferredId);
      return;
    }
    setActiveId((current) => (data.some((item) => item.id === current) ? current : data[0].id));
  }

  async function fetchSpaceDetails(spaceId: string) {
    return (await Promise.all([
      request(`/api/v1/espacios/${spaceId}`),
      request(`/api/v1/espacios/${spaceId}/chat`),
      request(`/api/v1/espacios/${spaceId}/generaciones`),
    ])) as [
      { id: string; nombre: string; materia: string | null; fuentesCount: number; updatedAt: string; fuentes: Fuente[] },
      ChatMensaje[],
      Generacion[],
    ];
  }

  function applySpaceDetails([detail, chat, generations]: Awaited<ReturnType<typeof fetchSpaceDetails>>) {
    setFuentes(detail.fuentes || []);
    setMensajes(chat || []);
    setGeneraciones(generations || []);
  }

  async function loadSpaceDetails(spaceId: string) {
    applySpaceDetails(await fetchSpaceDetails(spaceId));
  }

  // Effect events (React 19.2): leen siempre el estado más reciente sin ser dependencias de los efectos.
  // Los setState de los efectos van dentro de callbacks de promesas, no en el cuerpo del efecto.
  const restoreSession = useEffectEvent(async () => {
    const savedToken = localStorage.getItem(authStorage.token) || "";
    const savedUserRaw = localStorage.getItem(authStorage.user);
    if (!savedToken || !savedUserRaw) return null;
    const me = (await request("/api/v1/auth/me", {}, savedToken)) as User;
    return { token: savedToken, user: me };
  });
  const startSession = useEffectEvent(async (sessionToken: string, sessionUser: User) => {
    persistSession(sessionToken, sessionUser);
    await loadEspacios(sessionToken);
  });
  const expireSession = useEffectEvent(() => logout(true));
  const fetchFuentes = useEffectEvent((spaceId: string) => request(`/api/v1/espacios/${spaceId}/fuentes`));
  const fetchActiveSpace = useEffectEvent((spaceId: string) => fetchSpaceDetails(spaceId));
  const showActiveSpace = useEffectEvent(applySpaceDetails);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then(async (session) => {
        if (cancelled) return;
        if (!session) {
          setAuthOpen(true);
          return;
        }
        await startSession(session.token, session.user);
      })
      .catch(() => {
        if (!cancelled) expireSession();
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Al cerrar sesión o quedarse sin espacios, logout() y loadEspacios() ya vacían fuentes, chat y generaciones.
  useEffect(() => {
    if (!token || !activeId) return;
    let cancelled = false;
    fetchActiveSpace(activeId)
      .then((details) => {
        if (!cancelled) showActiveSpace(details);
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "No fue posible cargar el espacio");
      });
    return () => {
      cancelled = true;
    };
  }, [token, activeId]);

  useEffect(() => {
    if (!token || !activeId || !fuentes.some((item) => item.estado === "procesando")) return;
    const id = window.setInterval(() => {
      fetchFuentes(activeId)
        .then((rows) => setFuentes((rows as Fuente[]) || []))
        .catch(() => {
          window.clearInterval(id);
        });
    }, 2500);
    return () => window.clearInterval(id);
  }, [token, activeId, fuentes]);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const endpoint = authMode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const payload = authMode === "login"
        ? { email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword, name: authName };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.mensaje || "No fue posible iniciar sesión");
      persistSession(data.accessToken, data.user);
      await loadEspacios(data.accessToken);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      setNotice("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No fue posible continuar");
    } finally {
      setAuthLoading(false);
    }
  }

  async function createSpace(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy("Espacio");
    setNotice("");
    try {
      const created = (await request("/api/v1/espacios", {
        method: "POST",
        body: JSON.stringify({ nombre: spaceName, materia: spaceMateria || undefined }),
      })) as Espacio;
      setNewSpaceOpen(false);
      setSpaceName("");
      setSpaceMateria("");
      await loadEspacios(undefined, created.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible crear el espacio");
    } finally {
      setBusy("");
    }
  }

  async function renameActiveSpace() {
    if (!activeSpace || !token) return;
    const nombre = window.prompt("Nuevo nombre del espacio", activeSpace.nombre)?.trim();
    if (!nombre) return;
    const materia = window.prompt("Materia (deja vacío para quitarla)", activeSpace.materia || "") ?? "";
    try {
      await request(`/api/v1/espacios/${activeSpace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nombre, materia }),
      });
      await loadEspacios(undefined, activeSpace.id);
      await loadSpaceDetails(activeSpace.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible editar el espacio");
    }
  }

  async function deleteActiveSpace() {
    if (!activeSpace || !token) return;
    const ok = window.confirm(`¿Eliminar el espacio \"${activeSpace.nombre}\"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      await request(`/api/v1/espacios/${activeSpace.id}`, { method: "DELETE" });
      await loadEspacios();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible eliminar el espacio");
    }
  }

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!activeId || !files.length || !token) return;
    // Vercel corta cuerpos > 4.5 MB con un 413 que no es JSON: se avisa antes de subir (D-023).
    const tooBig = files.filter((file) => file.size > MAX_UPLOAD_BYTES);
    const toUpload = files.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    const problems = tooBig.map((file) => `"${file.name}" pesa más de ${MAX_UPLOAD_MB} MB`);
    setNotice("");
    if (!toUpload.length) {
      setNotice(`${problems.join(". ")}. Divide el archivo o comprímelo e inténtalo de nuevo.`);
      return;
    }
    setBusy("Subiendo");
    try {
      for (const file of toUpload) {
        const form = new FormData();
        form.append("archivo", file);
        try {
          await request(`/api/v1/espacios/${activeId}/fuentes`, { method: "POST", body: form });
        } catch (error) {
          problems.push(`"${file.name}": ${error instanceof Error ? error.message : "no se pudo subir"}`);
        }
      }
      if (problems.length) setNotice(`No se subió todo. ${problems.join(". ")}.`);
      const updated = (await request(`/api/v1/espacios/${activeId}/fuentes`)) as Fuente[];
      setFuentes(updated || []);
      await loadEspacios(undefined, activeId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible subir el archivo");
    } finally {
      setBusy("");
    }
  }

  async function deleteSource(id: string) {
    if (!token) return;
    try {
      await request(`/api/v1/fuentes/${id}`, { method: "DELETE" });
      setFuentes((items) => items.filter((item) => item.id !== id));
      await loadEspacios(undefined, activeId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible eliminar la fuente");
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || !activeId || !token) return;
    setBusy("Chat");
    setNotice("");

    const localUserMessage: ChatMensaje = {
      id: `local-user-${Date.now()}`,
      rol: "user",
      contenido: message,
      createdAt: new Date().toISOString(),
    };
    setMensajes((items) => [...items, localUserMessage]);
    setPrompt("");

    try {
      const assistant = (await request(`/api/v1/espacios/${activeId}/chat`, {
        method: "POST",
        body: JSON.stringify({ mensaje: message }),
      })) as ChatMensaje;
      setMensajes((items) => [...items, assistant]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible responder");
    } finally {
      setBusy("");
    }
  }

  async function clearChat() {
    if (!token || !activeId) return;
    try {
      await request(`/api/v1/espacios/${activeId}/chat`, { method: "DELETE" });
      setMensajes([]);
      await loadEspacios(undefined, activeId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible limpiar el chat");
    }
  }

  // Arma el archivo en el navegador (D-052); las librerías se cargan solo al hacer clic.
  // Borra la generación en la BD (DELETE /generaciones/{id}) y solo entonces la quita de la lista.
  async function eliminarGeneracion(g: Generacion) {
    if (!token) return;
    const nombre = `${ETIQUETA[g.tipo]} — ${activeSpace?.nombre || "Espacio"}`;
    if (!window.confirm(`¿Eliminar «${nombre}»? Esta acción no se puede deshacer.`)) return;
    setNotice("");
    try {
      await request(`/api/v1/generaciones/${g.id}`, { method: "DELETE" });
      setGeneraciones((items) => items.filter((item) => item.id !== g.id));
    } catch (error) {
      setNotice(error instanceof Error ? `No fue posible eliminar el material: ${error.message}` : "No fue posible eliminar el material");
    }
  }

  async function exportar(g: Generacion, ext: "pdf" | "docx") {
    const espacio = activeSpace?.nombre || "Espacio";
    setBusy(`export-${g.id}`);
    setNotice("");
    try {
      const documento = armarDocumento(g, espacio, fuentes);
      const blob = ext === "pdf"
        ? await (await import("./estudio/pdf")).crearPdf(documento)
        : await (await import("./estudio/word")).crearWord(documento);
      descargarBlob(blob, nombreArchivo(g, espacio, ext));
    } catch {
      setNotice("No fue posible crear el archivo");
    } finally {
      setBusy("");
    }
  }

  async function generate(type: "resumen" | "quiz" | "flashcards") {
    if (!activeId || !token || !seleccionadas.length) return;
    // Sin fuentes desmarcadas no se envía fuenteIds: el backend usa todas las listas.
    const fuenteIds = seleccionadas.length < fuentesListas.length ? seleccionadas.map((item) => item.id) : undefined;
    setBusy(type);
    setNotice("");
    try {
      const item = (await request(`/api/v1/espacios/${activeId}/generaciones`, {
        method: "POST",
        body: JSON.stringify({ tipo: type, cantidad: type === "quiz" ? 5 : type === "flashcards" ? 10 : undefined, fuenteIds }),
      })) as Generacion;
      setGeneraciones((items) => [item, ...items]);
      await loadEspacios(undefined, activeId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible generar el estudio");
    } finally {
      setBusy("");
    }
  }

  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NS";

  if (booting) {
    return <main className="northspace-shell"><section className="workspace loading-screen">Conectando NorthSpace...</section></main>;
  }

  return (
    <main className="northspace-shell">
      <aside className="left-panel">
        <div className="brand-row">
          <div className="brand-mark"><span>{icons.compass}</span></div>
          <div>
            <div className="brand-name">NorthSpace</div>
            <div className="brand-subtitle">Universidad del Norte</div>
          </div>
        </div>

        <div className="panel-heading">
          <span>Mis espacios</span>
          <div className="space-controls">
            <button className="icon-button" aria-label="Editar espacio" onClick={renameActiveSpace} disabled={!activeSpace}>{icons.sliders}</button>
            <button className="icon-button" aria-label="Nuevo espacio" onClick={() => setNewSpaceOpen(true)}>{icons.plus}</button>
          </div>
        </div>

        <div className="space-list">
          {espacios.map((space) => (
            <button key={space.id} className={`space-item ${activeId === space.id ? "active" : ""}`} onClick={() => setActiveId(space.id)}>
              <span className="space-glyph">✦</span>
              <span>
                <strong>{space.nombre}</strong>
                <small>{space.materia || `${space.fuentesCount} fuentes`}</small>
              </span>
            </button>
          ))}
          {!espacios.length && <button className="empty-space" onClick={() => setNewSpaceOpen(true)}>+ Crear tu primer espacio</button>}
        </div>

        <div className="panel-heading sources-heading">
          <span>Fuentes</span>
          {fuentesListas.length > 1 && (
            <button className="select-all" onClick={() => marcarTodas(seleccionadas.length < fuentesListas.length)}>
              {seleccionadas.length < fuentesListas.length ? "Marcar todas" : "Desmarcar todas"}
            </button>
          )}
          <button className="icon-button" aria-label="Añadir fuente" onClick={() => fileRef.current?.click()} disabled={!activeId}>{icons.plus}</button>
        </div>
        <input ref={fileRef} className="hidden-input" type="file" accept=".pdf,.docx,.pptx,.txt" multiple onChange={uploadFiles} />

        {fuentes.length ? (
          <div className="source-list">
            {fuentes.map((source) => (
              <div className="source-item" key={source.id}>
                <input
                  type="checkbox"
                  className="source-check"
                  aria-label={`Usar ${source.nombreArchivo} en el Estudio`}
                  checked={source.estado === "listo" && !excluidas.includes(source.id)}
                  disabled={source.estado !== "listo"}
                  onChange={() => toggleFuente(source.id)}
                />
                <span className="source-type">{source.tipo.toUpperCase()}</span>
                <span className="source-info">
                  <strong>{source.nombreArchivo}</strong>
                  <small className={`source-${source.estado}`}>
                    {source.estado === "listo" ? "Lista" : source.estado === "procesando" ? "Procesando..." : source.error || "Error"}
                  </small>
                </span>
                <button aria-label="Eliminar fuente" onClick={() => deleteSource(source.id)}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="source-empty">
            <span className="empty-orbit"><span>{icons.document}</span></span>
            <p><strong>Tus fuentes aparecerán aquí</strong></p>
            <p>Añade archivos PDF, DOCX, PPTX o TXT (máximo {MAX_UPLOAD_MB} MB cada uno) para comenzar.</p>
          </div>
        )}

        <div className="quota-note">
          <small>Límite diario recomendado: 30 generaciones y 100 mensajes.</small>
        </div>

        <div className="user-row">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{user?.name || "Sin sesión"}</strong>
            <span>{user?.email || "Inicia sesión"}</span>
          </div>
          {activeSpace && <button className="logout-button" onClick={deleteActiveSpace}>Borrar</button>}
          {user && <button className="logout-button" onClick={() => logout(false)}>Salir</button>}
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">{activeSpace?.materia || "ESPACIO ACTIVO"}</span>
            <h1>{activeSpace?.nombre || "Mi viaje de aprendizaje"}</h1>
          </div>
          <div className="header-actions">
            <button className="header-icon" aria-label="Buscar">{icons.search}</button>
            <button className="new-notebook" onClick={() => setNewSpaceOpen(true)}><span>{icons.plus}</span> Nuevo espacio</button>
            <div className="profile-avatar">{initials}</div>
          </div>
        </header>

        <div className="canvas">
          <section className="chat-panel">
            <div className="chat-topline">
              <div className="companion">
                <div className="companion-star">✦</div>
                <div><strong>Guía North</strong><span>Tu compañero de estudio</span></div>
              </div>
              {mensajes.length > 0 && <button className="clear-chat" onClick={clearChat}>Limpiar chat</button>}
            </div>

            {mensajes.length === 0 ? (
              <div className="welcome">
                <div className="welcome-sigil"><span>✦</span></div>
                <span className="welcome-kicker">BIENVENIDO A NORTHSPACE</span>
                <h2>Vamos a empezar tu <em>gran aventura</em></h2>
                <p>
                  {fuentes.some((item) => item.estado === "listo")
                    ? "Tus fuentes están listas. Pregunta lo que quieras aprender."
                    : "Crea un espacio y añade tus fuentes para comenzar."}
                </p>
              </div>
            ) : (
              <div className="messages">
                {mensajes.map((message) => (
                  <div key={message.id} className={`message ${message.rol}`}>
                    <div className="message-author">{message.rol === "user" ? initials : "✦ North"}</div>
                    <p>{message.contenido}</p>
                    {message.fuentesCitadas && message.fuentesCitadas.length > 0 && (
                      <div className="citations">
                        {message.fuentesCitadas.map((cite, index) => (
                          <span key={`${cite.fuenteId}-${index}`}>
                            C{index + 1} · {cite.nombreArchivo}{cite.pagina ? ` · p. ${cite.pagina}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {notice && <div className="notice">{notice}</div>}

            <form className="composer" onSubmit={sendMessage}>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={activeId ? "Pregunta algo a tu espacio..." : "Primero crea o selecciona un espacio..."}
                aria-label="Pregunta a NorthSpace"
                maxLength={4000}
                disabled={!activeId || busy === "Chat"}
              />
              <div className="composer-footer">
                <button type="button" className="tool-button" aria-label="Añadir herramienta">{icons.sliders}</button>
                <span>{prompt.length}/4000</span>
                <button className="send-button" type="submit" aria-label="Enviar" disabled={!activeId || !prompt.trim() || busy === "Chat"}>
                  <span>{busy === "Chat" ? "···" : icons.send}</span>
                </button>
              </div>
            </form>
          </section>

          <aside className="studio-panel">
            <div className="studio-heading">
              <div><span className="eyebrow">ESTUDIO</span><h2>Crear conocimiento</h2></div>
              <button className="icon-button" aria-label="Opciones">{icons.sliders}</button>
            </div>
            {fuentesListas.length > 0 && (
              <p className={`studio-sources ${seleccionadas.length ? "" : "studio-sources-empty"}`}>
                {seleccionadas.length
                  ? `Usando ${seleccionadas.length} de ${fuentesListas.length} ${fuentesListas.length === 1 ? "fuente" : "fuentes"}`
                  : "Marca al menos una fuente para generar"}
              </p>
            )}

            <div className="studio-grid">
              <button className="studio-card" onClick={() => generate("resumen")} disabled={!!busy || !activeId || !seleccionadas.length}><span className="tool-glyph">▱</span><span><strong>Resumen escrito</strong><small>{busy === "resumen" ? "Generando..." : "Ideas clave"}</small></span></button>
              <button className="studio-card" onClick={() => generate("flashcards")} disabled={!!busy || !activeId || !seleccionadas.length}><span className="tool-glyph glyph-1">▧</span><span><strong>Tarjetas didácticas</strong><small>{busy === "flashcards" ? "Generando..." : "Memoria"}</small></span></button>
              <button className="studio-card" onClick={() => generate("quiz")} disabled={!!busy || !activeId || !seleccionadas.length}><span className="tool-glyph glyph-2">?</span><span><strong>Cuestionario</strong><small>{busy === "quiz" ? "Generando..." : "Práctica"}</small></span></button>
              <button className="studio-card" disabled><span className="tool-glyph glyph-3">≡</span><span><strong>Tabla de datos</strong><small>Próximamente</small></span></button>
            </div>

            <div className="results-list">
              {generaciones.map((item) => (
                <article className="file-card" key={item.id}>
                  <button className="file-delete" onClick={() => eliminarGeneracion(item)} disabled={!!busy} aria-label={`Eliminar ${ETIQUETA[item.tipo]}`}>×</button>
                  <span className="file-icon">{icons.document}</span>
                  <span className="file-info">
                    <strong className="file-name">{ETIQUETA[item.tipo]} — {activeSpace?.nombre || "Espacio"}</strong>
                    <small className="file-meta">
                      {new Date(item.createdAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {detalleCorto(item)}
                    </small>
                  </span>
                  <span className="file-actions">
                    {item.tipo === "flashcards" ? (
                      <button onClick={() => setRepaso(item)} aria-label={`Repasar ${ETIQUETA[item.tipo]}`}>Repasar</button>
                    ) : (
                      <>
                    <button onClick={() => exportar(item, "pdf")} disabled={!!busy} aria-label={`Descargar ${ETIQUETA[item.tipo]} en PDF`}>
                      {busy === `export-${item.id}` ? "···" : "PDF"}
                    </button>
                    <button onClick={() => exportar(item, "docx")} disabled={!!busy} aria-label={`Descargar ${ETIQUETA[item.tipo]} en Word`}>
                      Word
                    </button>
                      </>
                    )}
                  </span>
                </article>
              ))}
              {!generaciones.length && <div className="studio-empty"><div className="crystal">◆</div><p>Los resultados de estudio aparecerán aquí.</p></div>}
            </div>
          </aside>
        </div>
      </section>

      {repaso && (
        <Tarjetas
          generacion={repaso}
          titulo={`${ETIQUETA[repaso.tipo]} — ${activeSpace?.nombre || "Espacio"}`}
          fuentes={fuentes}
          onClose={() => setRepaso(null)}
        />
      )}

      {newSpaceOpen && (
        <div className="modal-backdrop">
          <form className="auth-card space-modal" onSubmit={createSpace}>
            <button type="button" className="modal-close" onClick={() => setNewSpaceOpen(false)}>×</button>
            <span className="auth-mark">✦</span>
            <span className="welcome-kicker">NUEVO ESPACIO</span>
            <h2>¿Qué vas a explorar?</h2>
            <label>
              Nombre
              <input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} required maxLength={120} placeholder="Ej. Compiladores" />
            </label>
            <label>
              Materia <span>(opcional)</span>
              <input value={spaceMateria} onChange={(event) => setSpaceMateria(event.target.value)} maxLength={120} placeholder="Ej. Ingeniería de Sistemas" />
            </label>
            {notice && <div className="auth-error">{notice}</div>}
            <button className="auth-submit" type="submit" disabled={busy === "Espacio"}>{busy === "Espacio" ? "Creando..." : "Crear espacio"}</button>
          </form>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop auth-backdrop">
          <form className="auth-card" onSubmit={submitAuth}>
            <span className="auth-mark">✦</span>
            <span className="welcome-kicker">NORTHSPACE</span>
            <h2>{authMode === "login" ? "Bienvenido de nuevo" : "Inicia tu aventura"}</h2>
            {authMode === "register" && (
              <label>
                Nombre
                <input value={authName} onChange={(event) => setAuthName(event.target.value)} required minLength={1} placeholder="Tu nombre" />
              </label>
            )}
            <label>
              Correo
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required placeholder="estudiante@correo.com" />
            </label>
            <label>
              Contraseña
              <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" />
            </label>
            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit" type="submit" disabled={authLoading}>
              {authLoading ? "Abriendo tu espacio..." : authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>
              {authMode === "login" ? "¿Nuevo aquí? Crea una cuenta" : "Ya tengo una cuenta"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
