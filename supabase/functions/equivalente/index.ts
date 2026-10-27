// equivalente: «no hay X en la tienda, ¿qué compro?» desde la lista de la compra.
// - sugerir: equivalentes de la tabla propia (gratis); solo si no está, la IA barata propone 3.
// - cambiar: cambia ese ingrediente por el elegido en las comidas del menú de esos días (sin crear recetas:
//   se guarda en comidas.cambios y la app lo enseña ya cambiado en la receta y en la lista).
// Siempre se respetan las alergias y lo que no le gusta.
import { motivosNoApta, restriccionesDe } from '../_shared/alergenos.ts';
import { ErrorIA, pedirJSON } from '../_shared/claude.ts';
import { equivalentesDe } from '../_shared/equivalentes.ts';
import { crearClientes, fallo, hoyEspana, responder, servir, sumarDias } from '../_shared/http.ts';
import { permitirExtra } from '../_shared/perfil.ts';
import { MODELO_RECETA_SENCILLA, texto } from '../_shared/recetas.ts';
import { normalizar } from '../_shared/texto.ts';

const MAX_IA_DIA = 10;

async function equivalente(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string; ingrediente?: string; nuevo?: string; desde?: string; hasta?: string };
  const ingrediente = texto(cuerpo.ingrediente, 80);
  if (!ingrediente) return fallo(400, 'datos', 'Falta el ingrediente.');

  const { data: perfil } = await admin.from('profiles').select('alergias, no_me_gusta, aparatos').eq('id', user.id).maybeSingle();
  const restr = restriccionesDe((perfil?.alergias as string[] | null) ?? [], (perfil?.no_me_gusta as string[] | null) ?? [], perfil?.aparatos);
  const apto = (alimento: string) => motivosNoApta({ nombre: alimento, alergenos: [], ingredientes: [{ nombre: alimento }] }, restr).length === 0;

  // Propuestas de la IA (solo si la tabla no tiene nada): 3 alimentos comunes en España, mismo uso en cocina.
  const conIA = async (validar?: string): Promise<{ valido: boolean; alternativas: string[] } | Response> => {
    const bloqueo = await permitirExtra(admin, user.id, 'equivalente', MAX_IA_DIA);
    if (bloqueo) return bloqueo;
    try {
      return await pedirJSON<{ valido: boolean; alternativas: string[] }>({
        modelo: MODELO_RECETA_SENCILLA,
        sistema:
          'Eres cocinero. Para un ingrediente de una receta casera, propones sustitutos que se encuentren en cualquier supermercado de España y se usen en la misma cantidad y de la misma forma. Nombres cortos, en minúscula. Si te dan además un sustituto elegido por la persona, di si es un alimento real, seguro y que sirve como sustituto ("valido").',
        mensaje: validar ? `Ingrediente: ${ingrediente}\nSustituto elegido: ${validar}` : `Ingrediente: ${ingrediente}`,
        esquema: {
          type: 'object',
          additionalProperties: false,
          required: ['valido', 'alternativas'],
          properties: { valido: { type: 'boolean' }, alternativas: { type: 'array', items: { type: 'string' } } },
        },
        maxTokens: 1500,
      });
    } catch (e) {
      if (e instanceof ErrorIA && e.noConfigurada) throw e;
      return fallo(502, 'ia', 'Ahora mismo no podemos buscar equivalentes. Escribe tú el que quieras o prueba en un momento.');
    }
  };

  if (cuerpo.accion !== 'cambiar') {
    let opciones = equivalentesDe(ingrediente);
    if (!opciones.length) {
      const r = await conIA();
      if (r instanceof Response) return r;
      opciones = (r.alternativas ?? []).map((x) => texto(x, 40).toLowerCase()).filter((x) => x.length >= 3);
    }
    return responder({ ok: true, opciones: opciones.filter(apto).slice(0, 6) });
  }

  // Cambiar
  const nuevo = texto(cuerpo.nuevo, 60);
  if (!nuevo) return fallo(400, 'datos', 'Elige por qué lo quieres cambiar.');
  if (!apto(nuevo)) return fallo(422, 'no_apto', `«${nuevo}» no encaja con tus alergias o con lo que no te gusta.`);
  const deTabla = equivalentesDe(ingrediente).some((x) => normalizar(x) === normalizar(nuevo));
  if (!deTabla) {
    const r = await conIA(nuevo);
    if (r instanceof Response) return r;
    if (!r.valido) {
      const alt = (r.alternativas ?? []).map((x) => texto(x, 40).toLowerCase()).filter(apto).slice(0, 3);
      return fallo(422, 'ingrediente_no_valido', `«${nuevo}» no sirve como sustituto de ${ingrediente.toLowerCase()}.${alt.length ? ' Puedes usar:' : ''}`, alt.join('|'));
    }
  }

  const hoy = hoyEspana();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.desde)) && String(cuerpo.desde) >= hoy ? String(cuerpo.desde) : hoy;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.hasta)) ? String(cuerpo.hasta) : sumarDias(hoy, 7);
  const { data } = await admin
    .from('comidas')
    .select('id, cambios, receta:recetas(ingredientes(nombre))')
    .eq('user_id', user.id)
    .eq('hecha', false)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  const objetivo = normalizar(ingrediente);
  let cambiadas = 0;
  for (const c of (data ?? []) as unknown as { id: number; cambios: Record<string, string> | null; receta: { ingredientes: { nombre: string }[] } | null }[]) {
    const cambios = { ...(c.cambios ?? {}) };
    let toca = false;
    // El ingrediente tal cual en la receta…
    for (const i of c.receta?.ingredientes ?? []) {
      if (normalizar(i.nombre) === objetivo) {
        cambios[normalizar(i.nombre)] = nuevo;
        toca = true;
      }
    }
    // …o uno que ya se había cambiado por este (se cambia otra vez).
    for (const [k, v] of Object.entries(cambios)) {
      if (normalizar(v) === objetivo) {
        cambios[k] = nuevo;
        toca = true;
      }
    }
    if (!toca) continue;
    // Si se vuelve al original, se quita el cambio.
    for (const [k, v] of Object.entries(cambios)) if (normalizar(v) === k) delete cambios[k];
    await admin.from('comidas').update({ cambios }).eq('id', c.id).eq('user_id', user.id);
    cambiadas++;
  }
  return responder({ ok: true, cambiadas });
}

servir('equivalente', equivalente, 'No hemos podido cambiar el ingrediente. Vuelve a intentarlo en un momento.');
