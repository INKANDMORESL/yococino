// version-peques: adapta una receta compartida para los niños de casa con los mismos ingredientes.
// Se genera una sola vez por receta y se guarda en recetas.peques.
// La versión Peques NUNCA es una dieta: sin calorías, sin peso, sin "comer menos" (ver CLAUDE.md).
// Las alternativas se revisan contra las alergias y gustos de quien la pide antes de enseñarlas.
import { motivosNoApta, restriccionesDe } from '../_shared/alergenos.ts';
import { pedirJSON } from '../_shared/claude.ts';
import { crearClientes, fallo, responder, servir } from '../_shared/http.ts';
import { permitirExtra } from '../_shared/perfil.ts';
import { listaTextos, texto } from '../_shared/recetas.ts';

const MODELO_PEQUES = Deno.env.get('MODELO_PEQUES') || Deno.env.get('MODELO_RECETA') || 'claude-sonnet-5-5';
const MAX_NUEVAS_DIA = 30;
const FRANJAS = ['1-3', '4-8', '9-13', '14-17'] as const;

interface Peques {
  resumen: string;
  cambios: string[];
  por_edad: { franja: (typeof FRANJAS)[number]; consejo: string }[];
  presentacion: string[];
  alternativas: { nombre: string; descripcion: string; ingredientes: string[] }[];
  seguridad: string[];
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'cambios', 'por_edad', 'presentacion', 'alternativas', 'seguridad'],
  properties: {
    resumen: { type: 'string', description: 'Una frase: cómo queda el plato para los peques.' },
    cambios: { type: 'array', items: { type: 'string' }, description: 'Qué hacer distinto, en orden: apartar su ración antes de salar o picar, textura, corte, cocción.' },
    por_edad: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['franja', 'consejo'],
        properties: { franja: { type: 'string', enum: FRANJAS }, consejo: { type: 'string' } },
      },
      description: 'Un consejo para cada franja de edad.',
    },
    presentacion: { type: 'array', items: { type: 'string' }, description: 'Ideas para que les apetezca y participen en la cocina.' },
    alternativas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'descripcion', 'ingredientes'],
        properties: {
          nombre: { type: 'string' },
          descripcion: { type: 'string', description: 'Cómo se hace, en una o dos frases.' },
          ingredientes: { type: 'array', items: { type: 'string' }, description: 'Ingredientes que usa, todos de la receta original.' },
        },
      },
      description: 'Una o dos formas distintas de servir los mismos ingredientes a los peques.',
    },
    seguridad: { type: 'array', items: { type: 'string' }, description: 'Avisos de seguridad concretos para este plato.' },
  },
};

const SISTEMA = `Eres dietista-nutricionista especializada en alimentación infantil y cocinera. Adaptas una receta familiar para los niños de la casa (de 1 a 17 años) usando LOS MISMOS ingredientes.

Reglas obligatorias:
- Esto NUNCA es una dieta: no hables de calorías, de peso, de adelgazar ni de comer menos. El objetivo es que coman lo mismo que la familia, rico y seguro.
- Solo puedes usar ingredientes que ya están en la receta original. No añadas ninguno nuevo, ni siquiera en las alternativas.
- Su ración se aparta antes de añadir sal, picante, alcohol o mucha especia. Sin sal añadida para los más pequeños.
- Seguridad: de 1 a 3 años, nada de frutos secos enteros (solo molidos o en crema), uvas, tomates cherry o aceitunas enteras (siempre en cuartos), salchichas en rodajas, ni trozos duros o redondos que puedan atragantar. Pescado sin espinas. Huevo y carne bien cocinados.
- Para 1-3 años, texturas blandas y trozos que puedan coger con la mano. Para mayores, la misma comida que los adultos con pequeños ajustes.
- Lenguaje sencillo, cercano, en español de España. Sin consejos médicos.`;

async function version(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { receta_id?: number };
  const recetaId = Number(cuerpo.receta_id);
  if (!Number.isInteger(recetaId) || recetaId <= 0) return fallo(400, 'datos', 'Falta la receta.');

  const { data: receta, error } = await admin
    .from('recetas')
    .select('id, nombre, descripcion, pasos, peques, ingredientes(nombre, cantidad, unidad, nota, orden)')
    .eq('id', recetaId)
    .maybeSingle();
  if (error) throw error;
  if (!receta) return fallo(404, 'no_encontrada', 'No encontramos esa receta.');

  let peques = receta.peques as Peques | null;
  if (!peques) {
    const bloqueo = await permitirExtra(admin, user.id, 'peques', MAX_NUEVAS_DIA);
    if (bloqueo) return bloqueo;
    const ingredientes = ((receta.ingredientes ?? []) as { nombre: string; cantidad: number | null; unidad: string | null; nota: string | null; orden: number }[])
      .sort((a, b) => a.orden - b.orden)
      .map((i) => `- ${i.nombre}${i.nota ? ` (${i.nota})` : ''}`)
      .join('\n');
    const r = await pedirJSON<Peques>({
      modelo: MODELO_PEQUES,
      sistema: SISTEMA,
      mensaje: `Receta: ${receta.nombre}\n${receta.descripcion ?? ''}\n\nIngredientes:\n${ingredientes}\n\nPasos:\n${((receta.pasos ?? []) as string[]).map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
      esquema: ESQUEMA,
      maxTokens: 4000,
    });
    peques = {
      resumen: texto(r.resumen, 240),
      cambios: listaTextos(r.cambios, 6, 300),
      por_edad: (Array.isArray(r.por_edad) ? r.por_edad : [])
        .filter((p) => (FRANJAS as readonly string[]).includes(p.franja))
        .map((p) => ({ franja: p.franja, consejo: texto(p.consejo, 300) }))
        .filter((p) => p.consejo)
        .slice(0, 4),
      presentacion: listaTextos(r.presentacion, 3, 240),
      alternativas: (Array.isArray(r.alternativas) ? r.alternativas : [])
        .map((a) => ({ nombre: texto(a.nombre, 80), descripcion: texto(a.descripcion, 300), ingredientes: listaTextos(a.ingredientes, 12, 80) }))
        .filter((a) => a.nombre)
        .slice(0, 2),
      seguridad: listaTextos(r.seguridad, 4, 240),
    };
    if (!peques.cambios.length) return fallo(502, 'ia', 'No hemos podido preparar la versión Peques. Prueba otra vez en un momento.', 'respuesta vacía');
    await admin.from('recetas').update({ peques, peques_modelo: MODELO_PEQUES }).eq('id', receta.id);
  }

  // Las alternativas se enseñan solo si encajan con las alergias y gustos de esta casa.
  const { data: perfil } = await admin.from('profiles').select('alergias, no_me_gusta, aparatos').eq('id', user.id).maybeSingle();
  const restr = restriccionesDe((perfil?.alergias as string[] | null) ?? [], (perfil?.no_me_gusta as string[] | null) ?? [], perfil?.aparatos);
  const alternativas = peques.alternativas.filter(
    (a) => motivosNoApta({ nombre: a.nombre, alergenos: [], ingredientes: [...a.ingredientes, a.descripcion].map((nombre) => ({ nombre })) }, restr).length === 0,
  );
  return responder({ ok: true, peques: { ...peques, alternativas } });
}

servir('version-peques', version, 'No hemos podido preparar la versión Peques. Vuelve a intentarlo en un momento.');
