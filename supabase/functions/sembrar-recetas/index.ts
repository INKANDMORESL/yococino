// sembrar-recetas: carga inicial del recetario compartido, por tandas pequeñas. Solo para administradores.
// Respeta el cupo global de recetas nuevas del mes y evita repetir platos que ya existen.
// El gasto no se cobra a ningún cliente: se devuelve en la respuesta para que el dueño lo vea.
import { restriccionesDe } from '../_shared/alergenos.ts';
import { pedirJSON } from '../_shared/claude.ts';
import { cuentaActual } from '../_shared/costes.ts';
import { crearClientes, fallo, hoyEspana, mensajeTecnico, responder, servir } from '../_shared/http.ts';
import type { TipoComida } from '../_shared/nutricion.ts';
import { crearReceta, cupoRecetas, enParalelo, NOMBRE_TIPO, texto, type Nivel } from '../_shared/recetas.ts';
import { frutasDelMes, mesDe } from '../_shared/temporada.ts';
import { normalizar } from '../_shared/texto.ts';

const MODELO_IDEAS = Deno.env.get('MODELO_MENU') || 'claude-haiku-5-5';
const MAX_POR_TANDA = 8;
const TIPOS: TipoComida[] = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];
// Reparto aproximado del recetario: más comidas y cenas, que son las que más variedad necesitan.
const REPARTO: [TipoComida, number][] = [['desayuno', 0.18], ['media_manana', 0.14], ['almuerzo', 0.28], ['merienda', 0.14], ['cena', 0.26]];

interface Idea {
  plato: string;
  descripcion: string;
  tipo_comida: TipoComida;
  nivel: Nivel;
  variante: 'normal' | 'sin_gluten' | 'sin_lactosa';
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['platos'],
  properties: {
    platos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['plato', 'descripcion', 'tipo_comida', 'nivel', 'variante'],
        properties: {
          plato: { type: 'string' },
          descripcion: { type: 'string' },
          tipo_comida: { type: 'string', enum: TIPOS },
          nivel: { type: 'string', enum: ['facil', 'medio', 'elaborado'] },
          variante: { type: 'string', enum: ['normal', 'sin_gluten', 'sin_lactosa'] },
        },
      },
    },
  },
};

async function sembrar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
  const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!esAdmin) return fallo(403, 'no_admin', 'Solo el administrador puede hacer esto.');

  const cuerpo = (await req.json().catch(() => ({}))) as { cantidad?: number };
  const cupo = await cupoRecetas(admin);
  const cantidad = Math.min(MAX_POR_TANDA, Math.max(1, Math.round(Number(cuerpo.cantidad) || MAX_POR_TANDA)), cupo.quedan);
  if (cantidad <= 0) return responder({ ok: true, creadas: [], quedan_cupo: 0, tope: cupo.tope, coste_usd: 0 });

  // Qué hay ya, para equilibrar tipos y no repetir.
  const { data: existentes } = await admin.from('recetas').select('nombre, tipo_comida').order('created_at', { ascending: false }).limit(3000);
  const filas = (existentes ?? []) as { nombre: string; tipo_comida: string }[];
  const total = filas.length + cantidad;
  const faltan = REPARTO.map(([t, p]) => [t, Math.max(0, Math.round(total * p) - filas.filter((f) => f.tipo_comida === t).length)] as const);
  const sumaFaltan = faltan.reduce((s, [, n]) => s + n, 0) || 1;
  const pedir = faltan.map(([t, n]) => `${NOMBRE_TIPO[t]}: ${Math.round((n / sumaFaltan) * cantidad)}`).join(', ');
  const mes = mesDe(hoyEspana());

  const ideas = await pedirJSON<{ platos: Idea[] }>({
    modelo: MODELO_IDEAS,
    sistema: `Eres dietista-nutricionista y cocinero de cocina casera española y mediterránea. Propones platos para un recetario de una app de menús saludables para adultos.
Reglas: platos caseros, equilibrados y apetecibles, con productos de temporada en España (fruta de temporada: ${frutasDelMes(mes).join(', ')}); variedad de legumbres, pescado, verdura, huevo, carne blanca y cereales integrales; pocos ultraprocesados.
Mezcla niveles (sobre todo fácil). Alrededor de 1 de cada 6 platos debe ser en versión sin gluten y 1 de cada 6 sin lactosa (variante), y en ese caso el nombre lo dice.
No repitas ninguno de los platos que ya existen. Nombres cortos, sin cantidades.`,
    mensaje: `Propón exactamente ${cantidad} platos nuevos. Reparto por tipo de comida: ${pedir}.

Platos que ya existen (no los repitas):
${filas.slice(0, 400).map((f) => f.nombre).join(', ') || '(ninguno)'}`,
    esquema: ESQUEMA,
    maxTokens: 3000,
  });

  const vistos = new Set(filas.map((f) => normalizar(f.nombre)));
  const lista = (ideas.platos ?? [])
    .filter((i) => TIPOS.includes(i.tipo_comida) && texto(i.plato, 80) && !vistos.has(normalizar(i.plato)))
    .slice(0, cantidad);

  const errores: string[] = [];
  const creadas = (
    await enParalelo(lista, 4, async (i) => {
      const restr = restriccionesDe(i.variante === 'sin_gluten' ? ['gluten'] : i.variante === 'sin_lactosa' ? ['lactosa'] : [], []);
      const nivel: Nivel = (['facil', 'medio', 'elaborado'] as const).includes(i.nivel) ? i.nivel : 'facil';
      try {
        const r = await crearReceta(admin, texto(i.plato, 80), texto(i.descripcion, 200), i.tipo_comida, nivel, restr, '', mes);
        return r ? r.nombre : null;
      } catch (e) {
        errores.push(mensajeTecnico(e));
        return null;
      }
    })
  ).filter((x): x is string => !!x);

  const despues = await cupoRecetas(admin);
  return responder({
    ok: true,
    creadas,
    quedan_cupo: despues.quedan,
    tope: despues.tope,
    coste_usd: Math.round((cuentaActual()?.usd ?? 0) * 10000) / 10000,
    errores: errores.slice(0, 3),
  });
}

servir('sembrar-recetas', sembrar, 'No hemos podido crear recetas ahora. Vuelve a intentarlo en un momento.');
