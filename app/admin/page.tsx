"use client";
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

// Definimos qué datos tiene un miembro para que TypeScript no marque error
interface Miembro {
  id: string;
  nombre: string;
  posicion: number;
  brazo: string;
}

export default function AdminPage() {
  // Estados para la sesión y el login
  const [sesion, setSesion] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Estados para la gestión de miembros
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [nombre, setNombre] = useState("");
  const [brazoForm, setBrazoForm] = useState("Derecho");
  const [cargando, setCargando] = useState(true);

  // NUEVO: flag global para bloquear botones mientras se procesa una acción.
  // Evita dobles clics / doble submit que causaban posiciones duplicadas.
  const [guardando, setGuardando] = useState(false);
  // NUEVO: guardamos qué id específico está en proceso (para deshabilitar solo sus botones)
  const [idEnProceso, setIdEnProceso] = useState<string | null>(null);

  useEffect(() => {
    // 1. Verificar sesión inicial al cargar la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      if (session) cargarMiembros();
      setCargando(false);
    });

    // 2. Escuchar cambios de sesión (Login/Logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      if (session) cargarMiembros();
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Función para iniciar sesión
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error: " + error.message);
    else {
      setSesion(data.session);
      cargarMiembros();
    }
  }

  // Función para traer los datos de la base de datos
  // CORREGIDO: ordenamos primero por 'brazo' y luego por 'posicion'.
  // Antes solo se ordenaba por 'posicion', y como ambos brazos numeran
  // desde 1, había muchos empates. Postgres no garantiza el orden entre
  // filas empatadas, así que al hacer un UPDATE el orden podía "saltar"
  // y parecía que se movía gente del otro brazo sin haberla tocado.
  async function cargarMiembros() {
    const { data, error } = await supabase
      .from('miembros')
      .select('*')
      .order('brazo', { ascending: true })
      .order('posicion', { ascending: true });

    if (error) console.error("Error al cargar:", error.message);
    else setMiembros(data || []);
  }

  // Función para guardar un nuevo Halcón
  // CORREGIDO: calculamos la posición nueva consultando la BD en el momento
  // del guardado (no usando el estado local 'miembros', que puede estar
  // desactualizado si hay un guardado en curso). También bloqueamos el botón
  // mientras se procesa para evitar doble inserción por doble clic.
  async function agregarMiembro(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);

    try {
      const { data: maxData, error: maxError } = await supabase
        .from('miembros')
        .select('posicion')
        .eq('brazo', brazoForm)
        .order('posicion', { ascending: false })
        .limit(1);

      if (maxError) {
        console.error("Error al calcular posición:", maxError.message);
        alert("No se pudo agregar al atleta. Intenta de nuevo.");
        return;
      }

      const nuevaPos = (maxData?.[0]?.posicion || 0) + 1;

      const { error } = await supabase
        .from('miembros')
        .insert([{ nombre, brazo: brazoForm, posicion: nuevaPos }]);

      if (error) {
        console.error("Error al agregar:", error.message);
        alert("No se pudo agregar al atleta: " + error.message);
        return;
      }

      setNombre("");
      await cargarMiembros();
    } finally {
      setGuardando(false);
    }
  }

  // Función para eliminar
  // CORREGIDO: bloqueamos el botón de ese miembro mientras se procesa,
  // y usamos await de forma secuencial y controlada para evitar que dos
  // eliminaciones simultáneas descuadren el reordenamiento.
  async function eliminarMiembro(miembro: Miembro) {
    if (idEnProceso) return;
    if (!confirm(`¿Eliminar a ${miembro.nombre}?`)) return;

    setIdEnProceso(miembro.id);
    try {
      // 1. Eliminar el registro
      const { error: deleteError } = await supabase
        .from('miembros')
        .delete()
        .eq('id', miembro.id);

      if (deleteError) {
        console.error("Error al eliminar:", deleteError.message);
        alert("No se pudo eliminar: " + deleteError.message);
        return;
      }

      // 2. Traer los que estaban debajo de él para reordenar (mismo brazo)
      const { data: posteriores, error: posterioresError } = await supabase
        .from('miembros')
        .select('id, posicion')
        .eq('brazo', miembro.brazo)
        .gt('posicion', miembro.posicion)
        .order('posicion', { ascending: true });

      if (posterioresError) {
        console.error("Error al leer posteriores:", posterioresError.message);
        return;
      }

      // 3. Si hay miembros después, bajarles una posición (uno por uno, en orden)
      if (posteriores && posteriores.length > 0) {
        for (const p of posteriores) {
          await supabase
            .from('miembros')
            .update({ posicion: p.posicion - 1 })
            .eq('id', p.id);
        }
      }

      // 4. Refrescar la tabla en pantalla
      await cargarMiembros();
    } finally {
      setIdEnProceso(null);
    }
  }

  // Función para subir o bajar en el ranking
  // CORREGIDO: bloqueamos por id mientras se procesa un movimiento, para
  // que clics repetidos en ↑/↓ no disparen swaps superpuestos que dejen
  // posiciones duplicadas dentro del mismo brazo.
  async function mover(miembro: Miembro, direccion: number) {
    if (idEnProceso) return;

    const listaBrazo = miembros.filter(m => m.brazo === miembro.brazo);
    const indexActual = listaBrazo.findIndex(m => m.id === miembro.id);
    const indexDestino = indexActual + direccion;

    if (indexDestino < 0 || indexDestino >= listaBrazo.length) return;

    const hermano = listaBrazo[indexDestino];
    setIdEnProceso(miembro.id);

    try {
      // Usamos una posición temporal negativa para evitar chocar con la
      // restricción UNIQUE (brazo, posicion) mientras se hace el swap.
      const posTemporal = -1;

      const { error: e1 } = await supabase
        .from('miembros')
        .update({ posicion: posTemporal })
        .eq('id', miembro.id);
      if (e1) { console.error(e1.message); return; }

      const { error: e2 } = await supabase
        .from('miembros')
        .update({ posicion: miembro.posicion })
        .eq('id', hermano.id);
      if (e2) { console.error(e2.message); return; }

      const { error: e3 } = await supabase
        .from('miembros')
        .update({ posicion: hermano.posicion })
        .eq('id', miembro.id);
      if (e3) { console.error(e3.message); return; }

      await cargarMiembros();
    } finally {
      setIdEnProceso(null);
    }
  }

  // 1. Pantalla de carga inicial
  if (cargando) return <div className="p-10 text-center font-bold text-white bg-black min-h-screen">Verificando acceso...</div>;

  // 2. Si no hay sesión, mostramos el Formulario de Login
  if (!sesion) {
    return (
      <div className="min-h-screen bg-[#2d1b4d] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-4 border-purple-500">
          <h2 className="text-2xl font-black mb-6 text-center text-[#2d1b4d]">ACCESO ADMIN 🦅</h2>
          <input
            type="email"
            placeholder="Correo"
            className="w-full p-3 mb-4 border-2 rounded-xl"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full p-3 mb-6 border-2 rounded-xl"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700">
            ENTRAR
          </button>
        </form>
      </div>
    );
  }

  // 3. Si hay sesión, mostramos el Panel de Administración
  return (
    <div className="min-h-screen bg-[#fdfeb8] p-4 text-[#2d1b4d]">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-3xl shadow-2xl border-4 border-[#2d1b4d]">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black italic">ADMINISTRACIÓN HALCONES 🦅</h1>
          <button onClick={() => supabase.auth.signOut()} className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold">Salir</button>
        </div>

        {/* FORMULARIO PARA AÑADIR */}
        <form onSubmit={agregarMiembro} className="bg-gray-100 p-4 rounded-xl mb-8 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-bold mb-1">Nombre del Atleta:</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full p-2 rounded-lg border-2 border-gray-300"
              placeholder="Ej. Sergio Sánchez"
              required
              disabled={guardando}
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Brazo:</label>
            <select
              value={brazoForm}
              onChange={e => setBrazoForm(e.target.value)}
              className="p-2 rounded-lg border-2 border-gray-300"
              disabled={guardando}
            >
              <option value="Derecho">Derecho</option>
              <option value="Izquierdo">Izquierdo</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={guardando}
            className="bg-[#7b46ad] text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? "GUARDANDO..." : "AÑADIR"}
          </button>
        </form>

        {/* LISTAS POR BRAZO */}
        <div className="grid md:grid-cols-2 gap-8">
          {["Derecho", "Izquierdo"].map(tipo => (
            <div key={tipo}>
              <h2 className="text-xl font-black border-b-4 border-[#7b46ad] mb-3">BRAZO {tipo.toUpperCase()}</h2>
              {miembros.filter(m => m.brazo === tipo).map((m, idx) => {
                const enProceso = idEnProceso === m.id;
                return (
                  <div key={m.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2 border">
                    <span className="font-bold">{idx + 1}. {m.nombre}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => mover(m, -1)}
                        disabled={!!idEnProceso}
                        className="bg-gray-200 px-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enProceso ? "…" : "↑"}
                      </button>
                      <button
                        onClick={() => mover(m, 1)}
                        disabled={!!idEnProceso}
                        className="bg-gray-200 px-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enProceso ? "…" : "↓"}
                      </button>
                      <button
                        onClick={() => eliminarMiembro(m)}
                        disabled={!!idEnProceso}
                        className="bg-red-100 text-red-600 px-2 rounded ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}