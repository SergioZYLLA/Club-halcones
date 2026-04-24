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
  const cargarDatos = async () => {
  
    const { data, error } = await supabase
      .from('miembros')
      .select('*')
      .eq('brazo', brazo)
      .order('posicion', { ascending: true });

    if (error) {
  console.error("Error de Supabase:", error.message);
  alert("Error al conectar: " + error.message); // Esto te mostrará un aviso en el navegador
}  

if (error) {
    console.error("Error de Supabase:", error.message);
  } else {
    console.log("Datos recibidos:", data); // Esto nos dirá en la consola si llegó algo
    setMiembros(data || []);
  }
setCargando(false);
  };

  // Se ejecuta cada vez que cambias de pestaña (Brazo)
  useEffect(() => {
    cargarDatos();
  }, [brazo]);

  return (
    <main className="min-h-screen bg-[#fdfeb8] p-4 text-[#2d1b4d]">
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-[#2d1b4d]">
        <div className="bg-[#2d1b4d] p-6 text-center text-white">
          <h1 className="text-4xl font-black italic">CLUB HALCONES</h1>
          <p className="text-yellow-400 font-bold">RANKING BRAZO {brazo.toUpperCase()}</p>
        </div>

        {/* Selector de Brazo */}
        <div className="flex bg-gray-100 p-2 gap-2">
          <button onClick={() => setBrazo("Derecho")} className={`flex-1 py-2 rounded-xl font-bold ${brazo === "Derecho" ? "bg-purple-600 text-white" : "bg-white"}`}>Brazo Derecho</button>
          <button onClick={() => setBrazo("Izquierdo")} className={`flex-1 py-2 rounded-xl font-bold ${brazo === "Izquierdo" ? "bg-purple-600 text-white" : "bg-white"}`}>Brazo Izquierdo</button>
        </div>

        {/* Lista de Miembros */}
        <div className="p-4 space-y-2 bg-[#fdfeb8]">
          {cargando ? (
            <p className="text-center py-10 font-bold">Cargando ranking...</p>
          ) : (
            miembros.map((m, index) => (
              <div key={m.id} className="flex items-center justify-between p-2 bg-[#7b46ad] rounded-lg text-white border-b-4 border-black/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white text-[#7b46ad] w-10 h-10 rounded flex items-center justify-center font-black border-2 border-black">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <span className="font-bold uppercase">{m.nombre}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}