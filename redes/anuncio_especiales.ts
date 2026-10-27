// Anuncios de los especiales de temporada en Instagram: busca los especiales que empiezan en los próximos
// días (o que ya han empezado y aún no se han anunciado) y elige recetas con foto para la publicación.
// Lo lanza GitHub (.github/workflows/anuncio-especiales.yml) y deja el resultado en redes/anuncios/pendientes.json.
// En Instagram solo se publican comidas y cenas (nunca desayunos, medias mañanas ni meriendas).
// Uso: deno run -A redes/anuncio_especiales.ts   (necesita SUPABASE_ACCESS_TOKEN y REF)
import { ESPECIALES } from '../supabase/functions/_shared/especiales.ts';

const DIAS_ANTES = 3; // se prepara el anuncio unos días antes de que empiece
const MINIMO_RESTANTE = 2; // si quedan menos días de especial, ya no se anuncia

const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const sumar = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const leer = (ruta: string) => {
  try {
    return JSON.parse(Deno.readTextFileSync(ruta));
  } catch {
    return null;
  }
};
const hechos = (leer('redes/anuncios/hechos.json') ?? {}) as Record<string, unknown>;

async function sql<T>(query: string): Promise<T[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${Deno.env.get('REF')}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }),
  });
  if (!r.ok) throw new Error(`Base de datos: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as T[];
}

const ano = Number(hoy.slice(0, 4));
const pendientes = [];
const sinReceta: string[] = [];
for (const e of ESPECIALES) {
  for (const a of [ano - 1, ano, ano + 1]) {
    const [desde, hasta] = e.fechas(a);
    const id = `${e.clave}-${desde.slice(0, 4)}`;
    if (hechos[id]) continue;
    if (desde > sumar(hoy, DIAS_ANTES) || hoy > sumar(hasta, -MINIMO_RESTANTE)) continue;
    const clave = e.clave.replace(/[^a-z0-9_]/g, '');
    const recetas = await sql<{ id: number; nombre: string; descripcion: string | null; tipo_comida: string; imagen: string }>(`
      select r.id, r.nombre, r.descripcion, r.tipo_comida, r.imagen
      from public.especial_recetas er join public.recetas r on r.id = er.receta_id
      where er.especial = '${clave}' and not r.oculta and r.privada_de is null and r.imagen is not null
        and r.tipo_comida in ('almuerzo', 'cena')
      order by coalesce(array_length(r.avisos, 1), 0), r.solo_especial desc, r.id desc
      limit 5`);
    if (!recetas.length) {
      sinReceta.push(id);
      continue;
    }
    pendientes.push({
      id,
      clave: e.clave,
      titulo: e.titulo,
      emoji: e.emoji,
      descripcion: e.descripcion,
      desde,
      hasta,
      publicar: desde > hoy ? desde : hoy,
      recetas,
    });
  }
}
pendientes.sort((x, y) => x.publicar.localeCompare(y.publicar));
Deno.writeTextFileSync('redes/anuncios/pendientes.json', JSON.stringify({ hoy, pendientes, sin_receta: sinReceta }, null, 2) + '\n');
console.log(`Pendientes: ${pendientes.map((p) => p.id).join(', ') || 'ninguno'}. Sin receta con foto todavía: ${sinReceta.join(', ') || 'ninguno'}.`);
