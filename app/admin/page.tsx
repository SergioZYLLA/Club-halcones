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
  async function cargarMiembros() {
    const { data, error } = await supabase
      .from('miembros')
      .select('*')
      .order('posicion', { ascending: true });
    
    if (error) console.error("Error al cargar:", error.message);
    else setMiembros(data || []);
  }

  // Función para guardar un nuevo Halcón
  async function agregarMiembro(e: React.FormEvent) {
    e.preventDefault();
    const nuevaPos = miembros.filter(m => m.brazo === brazoForm).length + 1;
    
    const { error } = await supabase
      .from('miembros')
      .insert([{ nombre, brazo: brazoForm, posicion: nuevaPos }]);

    if (!error) {
      setNombre("");
      cargarMiembros();
    }
  }

  // Función para eliminar
  async function eliminarMiembro(miembro: Miembro) {
  if (confirm(`¿Eliminar a ${miembro.nombre}?`)) {
    // 1. Eliminar el registro
    const { error: deleteError } = await supabase
      .from('miembros')
      .delete()
      .eq('id', miembro.id);

    if (deleteError) {
      console.error("Error al eliminar:", deleteError.message);
      return;
    }

    // 2. Traer los que estaban debajo de él para reordenar
    const { data: posteriores } = await supabase
      .from('miembros')
      .select('id, posicion')
      .eq('brazo', miembro.brazo)
      .gt('posicion', miembro.posicion);

    // 3. Si hay miembros después, bajarles una posición
    if (posteriores && posteriores.length > 0) {
      for (const p of posteriores) {
        await supabase
          .from('miembros')
          .update({ posicion: p.posicion - 1 })
          .eq('id', p.id);
      }
    }

    // 4. Refrescar la tabla en pantalla
    cargarMiembros();
  }
}

  // Función para subir o bajar en el ranking
  async function mover(miembro: Miembro, direccion: number) {
    const listaBrazo = miembros.filter(m => m.brazo === miembro.brazo);
    const indexActual = listaBrazo.findIndex(m => m.id === miembro.id);
    const indexDestino = indexActual + direccion;

    if (indexDestino >= 0 && indexDestino < listaBrazo.length) {
      const hermano = listaBrazo[indexDestino];
      
      await supabase.from('miembros').update({ posicion: hermano.posicion }).eq('id', miembro.id);
      await supabase.from('miembros').update({ posicion: miembro.posicion }).eq('id', hermano.id);
      
      cargarMiembros();
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
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-2 rounded-lg border-2 border-gray-300" placeholder="Ej. Sergio Sánchez" required />
          </div>
          <div>
            <label className="block font-bold mb-1">Brazo:</label>
            <select value={brazoForm} onChange={e => setBrazoForm(e.target.value)} className="p-2 rounded-lg border-2 border-gray-300">
              <option value="Derecho">Derecho</option>
              <option value="Izquierdo">Izquierdo</option>
            </select>
          </div>
          <button type="submit" className="bg-[#7b46ad] text-white px-6 py-2 rounded-lg font-bold">AÑADIR</button>
        </form>

        {/* LISTAS POR BRAZO */}
        <div className="grid md:grid-cols-2 gap-8">
          {["Derecho", "Izquierdo"].map(tipo => (
            <div key={tipo}>
              <h2 className="text-xl font-black border-b-4 border-[#7b46ad] mb-3">BRAZO {tipo.toUpperCase()}</h2>
              {miembros.filter(m => m.brazo === tipo).map((m, idx) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2 border">
                  <span className="font-bold">{idx + 1}. {m.nombre}</span>
                  <div className="flex gap-1">
                    <button onClick={() => mover(m, -1)} className="bg-gray-200 px-2 rounded">↑</button>
                    <button onClick={() => mover(m, 1)} className="bg-gray-200 px-2 rounded">↓</button>
                    <button onClick={() => eliminarMiembro(m)} className="bg-red-100 text-red-600 px-2 rounded ml-2">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}