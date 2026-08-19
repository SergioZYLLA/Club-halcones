"use client";
import { supabase } from "./supabase"; // Asegúrate de que la ruta sea correcta
import { useEffect, useState } from "react";

interface Miembro {
  id: string;
  nombre: string;
  posicion: number;
  brazo: string;
}

export default function RankingHalcones() {
  const [brazo, setBrazo] = useState<"Derecho" | "Izquierdo">("Derecho");
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);

  // FUNCIÓN PARA CARGAR DATOS DESDE SUPABASE
  // CORREGIDO: agregamos 'nombre' como orden secundario. Esto es solo un
  // respaldo de seguridad: la causa real de las posiciones duplicadas
  // (14, 15, 16, 16...) se corrige en el panel de admin (agregarMiembro
  // y mover), pero si por alguna razón llegaran a quedar dos filas con la
  // misma posición, al menos el orden en pantalla será consistente y no
  // saltará entre refrescos.
  const cargarDatos = async () => {
    setCargando(true); // Ponemos a cargar cada vez que cambias de brazo
    const { data, error } = await supabase
      .from('miembros')
      .select('*')
      .eq('brazo', brazo)
      .order('posicion', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error de Supabase:", error.message);
      alert("Error al conectar: " + error.message);
    } else {
      setMiembros(data || []);
    }
    setCargando(false);
  };

  // Se ejecuta cada vez que cambias de pestaña (Brazo)
  useEffect(() => {
    cargarDatos();
  }, [brazo]);

  // DIVIDIMOS A LOS MIEMBROS EN 3 CATEGORÍAS SEGÚN SU POSICIÓN EN LA TABLA
  const podio = miembros.filter(m => m.posicion >= 1 && m.posicion <= 3);
  const contendientes = miembros.filter(m => m.posicion >= 4 && m.posicion <= 10);
  const subsuelo = miembros.filter(m => m.posicion > 10);

  // FUNCIÓN AUXILIAR: Para no repetir el código del diseño de cada miembro 3 veces
  const RenderizarMiembro = ({ m, bgClass, textColor }: { m: Miembro, bgClass: string, textColor: string }) => (
    <div key={m.id} className={`flex items-center justify-between p-2 rounded-lg text-white border-b-4 border-black/20 ${bgClass}`}>
      <div className="flex items-center gap-3">
        {/* Usamos m.posicion (el valor real de la BD) para que el número siempre coincida */}
        <div className={`bg-white w-10 h-10 rounded flex items-center justify-center font-black border-2 border-black ${textColor}`}>
          {String(m.posicion).padStart(2, '0')}
        </div>
        <span className="font-bold uppercase">{m.nombre}</span>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#fdfeb8] p-4 text-[#2d1b4d]">
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-[#2d1b4d]">
        <div className="bg-[#2d1b4d] p-6 text-center text-white">
          <h1 className="text-4xl font-black italic">CLUB HALCONES</h1>
          <p className="text-yellow-400 font-bold">RANKING BRAZO {brazo.toUpperCase()}</p>
        </div>

        {/* Selector de Brazo */}
        <div className="flex bg-gray-100 p-2 gap-2">
          <button onClick={() => setBrazo("Derecho")} className={`flex-1 py-2 rounded-xl font-bold transition-all ${brazo === "Derecho" ? "bg-purple-600 text-white shadow-inner" : "bg-white text-gray-700"}`}>Brazo Derecho</button>
          <button onClick={() => setBrazo("Izquierdo")} className={`flex-1 py-2 rounded-xl font-bold transition-all ${brazo === "Izquierdo" ? "bg-purple-600 text-white shadow-inner" : "bg-white text-gray-700"}`}>Brazo Izquierdo</button>
        </div>

        {/* Lista de Miembros */}
        <div className="p-4 space-y-6 bg-[#fdfeb8]">
          {cargando ? (
            <p className="text-center py-10 font-bold">Cargando ranking...</p>
          ) : (
            <>
              {/* SECCIÓN 1: TOP 1 AL 3 */}
              {podio.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-center text-yellow-600 uppercase tracking-widest border-b-2 border-yellow-600 pb-1">🏆 El Podio</h2>
                  {podio.map(m => (
                    <RenderizarMiembro key={m.id} m={m} bgClass="bg-yellow-500" textColor="text-yellow-600" />
                  ))}
                </div>
              )}

              {/* SECCIÓN 2: TOP 4 AL 10 */}
              {contendientes.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-center text-[#7b46ad] uppercase tracking-widest border-b-2 border-[#7b46ad] pb-1">🔥 Contendientes</h2>
                  {contendientes.map(m => (
                    <RenderizarMiembro key={m.id} m={m} bgClass="bg-[#7b46ad]" textColor="text-[#7b46ad]" />
                  ))}
                </div>
              )}

              {/* SECCIÓN 3: SUBSUELO (11 en adelante) */}
              {subsuelo.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-center text-gray-600 uppercase tracking-widest border-b-2 border-gray-500 pb-1">💀 Top Subsuelo</h2>
                  {subsuelo.map(m => (
                    <RenderizarMiembro key={m.id} m={m} bgClass="bg-gray-600" textColor="text-gray-700" />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}