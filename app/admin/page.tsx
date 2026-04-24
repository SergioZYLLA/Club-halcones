"use client";
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

interface Miembro {
  id: string;
  nombre: string;
  posicion: number;
  brazo: string;
  puntos: number;
}

export default function AdminPage() {
  const [sesion, setSesion] = useState<any>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [nombre, setNombre] = useState("");
  const [brazo, setBrazo] = useState("Derecho");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      if (session) cargarMiembros();
    });
  }, []);

  async function cargarMiembros() {
    const { data } = await supabase.from('miembros').select('*').order('posicion', { ascending: true });
    setMiembros(data || []);
  }

  // --- FUNCIÓN PARA AGREGAR ---
  async function agregarMiembro(e: React.FormEvent) {
    e.preventDefault();
    const nuevaPos = miembros.filter(m => m.brazo === brazo).length + 1;
    await supabase.from('miembros').insert([{ nombre, brazo, posicion: nuevaPos, puntos: 0 }]);
    setNombre("");
    cargarMiembros();
  }

  // --- FUNCIÓN PARA ELIMINAR ---
  async function eliminarMiembro(id: string) {
    if (confirm("¿Seguro que quieres eliminar a este Halcón?")) {
      await supabase.from('miembros').delete().eq('id', id);
      cargarMiembros();
    }
  }

  // --- FUNCIÓN PARA MOVER (RANKING) ---
  async function mover(miembro: Miembro, direccion: number) {
    const listaBrazo = miembros.filter(m => m.brazo === miembro.brazo);
    const indexActual = listaBrazo.findIndex(m => m.id === miembro.id);
    const indexDestino = indexActual + direccion;

    if (indexDestino >= 0 && indexDestino < listaBrazo.length) {
      const hermano = listaBrazo[indexDestino];
      
      // Intercambiamos posiciones en la base de datos
      await supabase.from('miembros').update({ posicion: hermano.posicion }).eq('id', miembro.id);
      await supabase.from('miembros').update({ posicion: miembro.posicion }).eq('id', hermano.id);
      
      cargarMiembros();
    }
  }

  if (!sesion) return <div className="p-10 text-center font-bold">Iniciando sesión...</div>;

  return (
    <div className="min-h-screen bg-[#fdfeb8] p-4 text-[#2d1b4d]">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-3xl shadow-2xl border-4 border-[#2d1b4d]">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black italic">ADMINISTRACIÓN HALCONES 🦅</h1>
          <button onClick={() => supabase.auth.signOut().then(() => setSesion(null))} className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold">Salir</button>
        </div>

        {/* FORMULARIO PARA AGREGAR */}
        <form onSubmit={agregarMiembro} className="bg-gray-100 p-4 rounded-xl mb-8 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-bold mb-1">Nombre del Atleta:</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-2 rounded-lg border-2 border-gray-300" placeholder="Ej. Sergio Sánchez" required />
          </div>
          <div>
            <label className="block font-bold mb-1">Brazo:</label>
            <select value={brazo} onChange={e => setBrazo(e.target.value)} className="p-2 rounded-lg border-2 border-gray-300">
              <option value="Derecho">Derecho</option>
              <option value="Izquierdo">Izquierdo</option>
            </select>
          </div>
          <button type="submit" className="bg-[#7b46ad] text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700">AÑADIR</button>
        </form>

        {/* LISTA DE MIEMBROS PARA EDITAR */}
        <div className="space-y-4">
          {["Derecho", "Izquierdo"].map(tipoBrazo => (
            <div key={tipoBrazo}>
              <h2 className="text-xl font-black border-b-4 border-[#7b46ad] inline-block mb-3">BRAZO {tipoBrazo.toUpperCase()}</h2>
              {miembros.filter(m => m.brazo === tipoBrazo).map((m, index) => (
                <div key={m.id} className="flex items-center justify-between bg-white border-2 border-gray-200 p-3 rounded-xl mb-2 hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <span className="bg-[#2d1b4d] text-white w-8 h-8 flex items-center justify-center rounded-full font-bold">{index + 1}</span>
                    <span className="font-bold text-lg">{m.nombre}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={() => mover(m, -1)} className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300">↑</button>
                    <button onClick={() => mover(m, 1)} className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300">↓</button>
                    <button onClick={() => eliminarMiembro(m.id)} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200">🗑️</button>
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