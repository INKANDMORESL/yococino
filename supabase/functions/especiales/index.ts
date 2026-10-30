// especiales: el especial de temporada de hoy (Halloween, Navidad, verano…) y sus recetas, para Inicio y «Ver todas».
// Solo recetas aptas para la persona (alergias, lo que no le gusta y sus aparatos). Sin IA: no cuesta nada.
import { recetasDenunciadas } from '../_shared/denuncias.ts';
import { restriccionesDe } from '../_shared/alergenos.ts';
import { especialesDe, especialPorClave } from '../_shared/especiales.ts';
import { crearClientes, fallo, hoyEspana, responder, servir } from '../_shared/http.ts';
import { textoAvisos } from '../_shared/importar_reglas.ts';
import { esApta, type RecetaGuardada } from '../_shared/recetas.ts';

const COLUMNAS = 'id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini, alergenos, aparatos, nota_airfryer, avisos, ingredientes(nombre, nota)';

async function especiales(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
  const cuerpo = (await req.json().catch(() => ({}))) as { clave?: string; limite?: number };

  const hoy = hoyEspana();
  const deHoy = especialesDe(hoy);
  const elegido = cuerpo.clave ? (deHoy.find((e) => e.clave === cuerpo.clave) ?? especialPorClave(cuerpo.clave)) : deHoy[0];
  if (!elegido) return responder({ ok: true, especial: null, recetas: [] });

  const { data: perfil } = await admin.from('profiles').select('alergias, no_me_gusta, aparatos').eq('id', user.id).maybeSingle();
  const restr = restriccionesDe((perfil?.alergias as string[] | null) ?? [], (perfil?.no_me_gusta as string[] | null) ?? [], perfil?.aparatos);

  const { data, error } = await admin
    .from('especial_recetas')
    .select(`receta:recetas(${COLUMNAS}, oculta, privada_de)`)
    .eq('especial', elegido.clave)
    .limit(60);
  if (error) throw error;
  const denunciadas = await recetasDenunciadas(admin, user.id);
  type Fila = RecetaGuardada & Record<string, unknown> & { oculta: boolean; privada_de: string | null; avisos: string[] | null };
  const recetas = ((data ?? []) as unknown as { receta: Fila | null }[])
    .map((f) => f.receta)
    .filter((r): r is Fila => !!r && !r.oculta && !r.privada_de && !denunciadas.has(r.id as number) && !!r.imagen && esApta(r, restr))
    // Primero las que tienen foto ligera y menos avisos.
    .sort((a, b) => (a.avisos?.length ?? 0) - (b.avisos?.length ?? 0))
    .slice(0, Math.max(1, Math.min(60, Number(cuerpo.limite) || 60)))
    .map(({ id, nombre, descripcion, tipo_comida, minutos, kcal, imagen, imagen_mini, avisos }) => ({
      id,
      nombre,
      descripcion,
      tipo_comida,
      minutos,
      kcal,
      imagen,
      imagen_mini,
      aviso: textoAvisos((avisos as string[] | null) ?? []),
    }));
  const { platos: _p, fechas: _f, ...datos } = elegido as typeof elegido & { platos: unknown; fechas: unknown };
  return responder({ ok: true, especial: datos, recetas });
}

servir('especiales', especiales, 'No hemos podido cargar las recetas especiales.');
