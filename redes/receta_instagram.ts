// Receta para Instagram cada 2 días: elige candidatas interesantes (comidas y cenas con foto, de nivel medio o
// elaborado, con varios ingredientes), del grupo que toca (carne, legumbres o pescado, el que menos ha salido en
// las 6 últimas; el pescado, el que menos) y sin repetir. Nunca sardinas, caballa, boquerones ni conservas.
// Lo lanza GitHub (.github/workflows/receta-instagram.yml) y deja redes/recetas-instagram/pendiente.json.
// La publicación la programa en Metricool una tarea programada de Claude, que la apunta en hechas.json.
// Uso: deno run -A redes/receta_instagram.ts   (necesita SUPABASE_ACCESS_TOKEN y REF)
import { categoriasDe } from '../supabase/functions/_shared/categorias.ts';

type Grupo = 'carne' | 'legumbres' | 'pescado';
const ORDEN: Grupo[] = ['carne', 'legumbres', 'pescado'];
const PESO: Record<Grupo, number> = { carne: 1, legumbres: 1, pescado: 1.5 }; // el pescado cuenta más: sale menos
const NO_INTERESAN = ['sardin', 'caballa', 'boquer', 'anchoa', 'atun', 'atún', 'bonito', 'melva', 'conserva', 'lata', 'gachas', 'porridge'];

const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const leer = (ruta: string) => {
  try {
    return JSON.parse(Deno.readTextFileSync(ruta));
  } catch {
    return null;
  }
};
const hechas = (leer('redes/recetas-instagram/hechas.json') ?? []) as { receta: number; grupo: Grupo }[];

async function sql<T>(query: string): Promise<T[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${Deno.env.get('REF')}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }),
  });
  if (!r.ok) throw new Error(`Base de datos: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as T[];
}

interface Fila {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo_comida: string;
  nivel: string;
  minutos: number | null;
  kcal: number | null;
  imagen: string;
  ingredientes: { nombre: string }[] | null;
}

const usadas = hechas.map((h) => Number(h.receta)).filter(Boolean);
const filas = await sql<Fila>(`
  select r.id, r.nombre, r.descripcion, r.tipo_comida, r.nivel, r.minutos, r.kcal, r.imagen,
    (select json_agg(json_build_object('nombre', i.nombre)) from public.ingredientes i where i.receta_id = r.id) as ingredientes
  from public.recetas r
  where not r.oculta and r.privada_de is null and r.imagen is not null and r.imagen_mini is not null
    and not coalesce(r.solo_especial, false) and not coalesce(r.dulce, false)
    and coalesce(array_length(r.avisos, 1), 0) = 0
    and r.tipo_comida in ('almuerzo', 'cena')
    and (r.nivel in ('medio', 'elaborado') or r.minutos >= 25)
    ${usadas.length ? `and r.id not in (${usadas.join(',')})` : ''}
  order by r.id desc
  limit 1500`);

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const grupoDe = (r: Fila): Grupo | null => {
  const c = categoriasDe(r).categorias as string[];
  if (c.includes('pescado') || c.includes('marisco')) return 'pescado';
  if (c.includes('carne')) return 'carne';
  if (c.includes('legumbres')) return 'legumbres';
  return null;
};
const interesante = (r: Fila) =>
  (r.ingredientes?.length ?? 0) >= 6 && !NO_INTERESAN.some((p) => sinTildes(`${r.nombre} ${(r.ingredientes ?? []).map((i) => i.nombre).join(' ')}`).includes(sinTildes(p)));

const porGrupo: Record<Grupo, Fila[]> = { carne: [], legumbres: [], pescado: [] };
for (const r of filas) {
  const g = grupoDe(r);
  if (g && interesante(r)) porGrupo[g].push(r);
}

// Grupo que toca: el que menos ha salido en las 6 últimas (el pescado pesa más); a igualdad, carne, legumbres, pescado.
const cuenta: Record<Grupo, number> = { carne: 0, legumbres: 0, pescado: 0 };
for (const h of hechas.slice(-6)) if (h.grupo in cuenta) cuenta[h.grupo] += PESO[h.grupo];
const turno = [...ORDEN].sort((a, b) => cuenta[a] - cuenta[b] || ORDEN.indexOf(a) - ORDEN.indexOf(b));
const grupo = turno.find((g) => porGrupo[g].length) ?? 'carne';
const ultima = hechas.at(-1)?.grupo;
// Nunca el mismo grupo dos veces seguidas si hay otro con recetas.
const elegido = grupo === ultima ? (turno.find((g) => g !== ultima && porGrupo[g].length) ?? grupo) : grupo;

// Al azar entre las candidatas, para no ir siempre por orden.
const lista = [...porGrupo[elegido]].sort(() => Math.random() - 0.5).slice(0, 15);
const candidatas = lista.map((r) => ({
  id: r.id,
  nombre: r.nombre,
  descripcion: r.descripcion,
  tipo: r.tipo_comida === 'cena' ? 'cena' : 'comida',
  minutos: r.minutos,
  nivel: r.nivel,
  kcal: r.kcal,
  imagen: r.imagen,
  ingredientes: (r.ingredientes ?? []).map((i) => i.nombre).slice(0, 12),
}));
Deno.writeTextFileSync('redes/recetas-instagram/pendiente.json', JSON.stringify({ hoy, grupo: elegido, candidatas }, null, 2) + '\n');
console.log(`Hoy toca ${elegido}: ${candidatas.length} candidatas (carne ${porGrupo.carne.length}, legumbres ${porGrupo.legumbres.length}, pescado ${porGrupo.pescado.length}).`);
