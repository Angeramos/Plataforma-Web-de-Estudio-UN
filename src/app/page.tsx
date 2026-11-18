// Página provisional: el frontend nuevo sobre /api/v1 está por construirse (D-048).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Plataforma de Estudio UN</h1>
      <p className="opacity-80">
        El API está disponible en <code>/api/v1</code> (contrato en <code>openapi.yaml</code>). La interfaz nueva está en construcción.
      </p>
    </main>
  );
}
