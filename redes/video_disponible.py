# Reel vertical «Yococino ya está disponible» (1080x1920, 30 fps): capturas de la app en un móvil, textos
# animados y la función de guardar recetas de TikTok con «Compartir». Voz de redes/clips/disponible-*.wav.
# Uso: python3 redes/video_disponible.py [voz] [carpeta_salida] [--fotogramas]
import math, os, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
W, H, FPS = 1080, 1920, 30
F = '/usr/share/fonts/opentype/inter/'
TIT = lambda t: ImageFont.truetype(F + 'InterDisplay-ExtraBold.otf', t)
MED = lambda t: ImageFont.truetype(F + 'Inter-SemiBold.otf', t)
REG = lambda t: ImageFont.truetype(F + 'Inter-Regular.otf', t)
OLIVA, CREMA, TINTA, LIMON, ARENA = (77, 107, 60), (251, 250, 246), (29, 42, 35), (239, 201, 76), (244, 236, 222)
CAP = RAIZ / 'tienda' / 'capturas-originales'

def suave(x):  # 0..1 con frenada
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3

def rebote(x):
    x = max(0.0, min(1.0, x))
    return 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2

ICONO = Image.open(RAIZ / 'web' / 'icono.png').convert('RGBA')
_cache = {}

def captura(n, ancho):
    k = (n, ancho)
    if k not in _cache:
        im = Image.open(CAP / f'{n}.jpg').convert('RGB')
        _cache[k] = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    return _cache[k]

def redondear(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = im.convert('RGBA')
    out.putalpha(m)
    return out

BARRA = 54  # franja de arriba (hora y cámara) sobre la captura

def movil(pantalla, ancho=620):
    """Móvil sencillo (marco negro redondeado) con la pantalla dentro (proporción de las capturas)."""
    borde = 18
    pw = ancho - 2 * borde
    ph = round(pw * 1.73) + BARRA
    alto = ph + 2 * borde
    p = pantalla.convert('RGB')
    p = p.resize((pw, round(p.height * pw / p.width)), Image.LANCZOS)
    pant = Image.new('RGB', (pw, ph), p.getpixel((pw // 2, 4)))
    pant.paste(p.crop((0, 0, pw, ph - BARRA)), (0, BARRA))
    ImageDraw.Draw(pant).text((44, 14), '9:41', font=MED(22), fill=(30, 30, 30))
    marco = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(marco)
    d.rounded_rectangle((0, 0, ancho - 1, alto - 1), 78, fill=(22, 24, 22, 255))
    marco.alpha_composite(redondear(pant, 62), (borde, borde))
    d.rounded_rectangle((ancho // 2 - 62, borde + 10, ancho // 2 + 62, borde + 42), 16, fill=(10, 10, 10, 255))
    return marco

def sombra(im, radio=40, opacidad=110, desplaz=(0, 30)):
    s = Image.new('RGBA', (im.width + 4 * radio, im.height + 4 * radio), (0, 0, 0, 0))
    a = im.split()[3].point(lambda v: v * opacidad // 255)
    s.paste((0, 0, 0, 255), (2 * radio + desplaz[0], 2 * radio + desplaz[1]), a)
    return s.filter(ImageFilter.GaussianBlur(radio)), 2 * radio

def poner(lienzo, im, x, y, con_sombra=True):
    if con_sombra:
        s, m = sombra(im)
        lienzo.alpha_composite(s, (int(x - m), int(y - m)))
    lienzo.alpha_composite(im, (int(x), int(y)))

def texto_centrado(d, y, texto, fuente, color, ancho=W - 140, inter=1.12):
    lineas = []
    for parrafo in texto.split('\n'):
        actual = ''
        for p in parrafo.split():
            prueba = (actual + ' ' + p).strip()
            if d.textlength(prueba, font=fuente) <= ancho:
                actual = prueba
            else:
                lineas.append(actual)
                actual = p
        lineas.append(actual)
    alto = fuente.size * inter
    for i, l in enumerate(lineas):
        d.text((W / 2, y + i * alto), l, font=fuente, fill=color, anchor='ma')
    return y + len(lineas) * alto

def titulo(lienzo, t, texto, y=150, color=TINTA, sub=None):
    """Título que entra subiendo y apareciendo."""
    a = suave(t / 0.5)
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    fin = texto_centrado(d, y + (1 - a) * 40, texto, TIT(82), color + (255,))
    if sub:
        texto_centrado(d, fin + 18 + (1 - a) * 40, sub, MED(40), (95, 110, 98, 255))
    capa.putalpha(capa.split()[3].point(lambda v: int(v * a)))
    lienzo.alpha_composite(capa)

def fondo(color=CREMA):
    im = Image.new('RGBA', (W, H), color + (255,))
    d = ImageDraw.Draw(im)
    d.ellipse((-300, 1250, 700, 2250), fill=ARENA + (255,))
    d.ellipse((620, -260, 1400, 520), fill=(236, 241, 228, 255))
    return im

def boton_tienda(texto_peq, texto, ancho=430):
    im = Image.new('RGBA', (ancho, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, ancho - 1, 127), 30, fill=(30, 30, 28, 255))
    d.text((ancho / 2, 26), texto_peq, font=MED(26), fill=(230, 230, 230, 255), anchor='ma')
    d.text((ancho / 2, 58), texto, font=TIT(46), fill=(255, 255, 255, 255), anchor='ma')
    return im

def tiendas(lienzo, y, a):
    b1 = boton_tienda('Descárgala en el', 'App Store')
    b2 = boton_tienda('Disponible en', 'Google Play')
    for i, b in enumerate((b1, b2)):
        k = suave((a - i * 0.12) / 0.6)
        if k <= 0:
            continue
        b = b.copy()
        b.putalpha(b.split()[3].point(lambda v: int(v * k)))
        x = 90 + i * 470
        poner(lienzo, b, x, y + (1 - k) * 50, con_sombra=False)

# ---------- Escenas: cada una es f(t, dur) -> Image ----------

def e_intro(t, dur):
    im = fondo()
    k = rebote(t / 0.7)
    lado = int(300 * max(0.01, k))
    logo = redondear(ICONO.resize((lado, lado), Image.LANCZOS), int(lado * 0.24))
    poner(im, logo, W / 2 - lado / 2, 430 - lado / 2 + 150)
    d = ImageDraw.Draw(im)
    a = suave((t - 0.5) / 0.5)
    if a > 0:
        capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dc = ImageDraw.Draw(capa)
        dc.text((W / 2, 790), 'yococino', font=TIT(96), fill=OLIVA + (255,), anchor='ma')
        dc.rounded_rectangle((W / 2 - 300, 960, W / 2 + 300, 1060), 50, fill=LIMON + (255,))
        dc.text((W / 2, 980), '¡Ya disponible!', font=TIT(58), fill=TINTA + (255,), anchor='ma')
        texto_centrado(dc, 1120, 'Tu menú del mes,\nhecho para ti', MED(52), (60, 75, 64, 255))
        capa.putalpha(capa.split()[3].point(lambda v: int(v * a)))
        im.alpha_composite(capa, (0, int((1 - a) * 40)))
    tiendas(im, 1420, t - 1.0)
    return im

def e_movil(capturas, texto, sub):
    def f(t, dur):
        im = fondo()
        titulo(im, t, texto, sub=sub)
        k = suave(t / 0.7)
        y = 520 + (1 - k) * 700
        # Si hay dos capturas, pasa de una a otra a mitad de la escena (fundido dentro de la escena).
        n = len(capturas)
        tramo = dur / n
        i = min(n - 1, int(t / tramo))
        pant = captura(capturas[i], 1283)
        if i + 1 < n and t > (i + 1) * tramo - 0.4:
            mezcla = (t - ((i + 1) * tramo - 0.4)) / 0.4
            pant = Image.blend(pant.convert('RGB'), captura(capturas[i + 1], 1283).convert('RGB').resize(pant.size), suave(mezcla))
        tel = movil(pant)
        # Leve deriva hacia arriba para dar vida.
        y -= t * 14
        poner(im, tel, W / 2 - tel.width / 2, y)
        return im
    return f

def tiktok_video():
    """Un vídeo de receta cualquiera, como se vería en la app de vídeos (sin logos)."""
    foto = captura(3, 1283).crop((160, 60, 1180, 800))
    w, h = 584, 1010
    f = foto.resize((round(foto.width * h / foto.height), h), Image.LANCZOS)
    x0 = (f.width - w) // 2
    v = f.crop((x0, 0, x0 + w, h)).convert('RGBA')
    velo = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dv = ImageDraw.Draw(velo)
    for y in range(h // 2, h):  # degradado inferior
        dv.line((0, y, w, y), fill=(0, 0, 0, int(170 * max(0.0, (y - h / 2) / (h / 2)) ** 1.5)))
    v.alpha_composite(velo)
    d = ImageDraw.Draw(v)
    d.text((28, h - 210), '@cocinacasera', font=MED(28), fill='white')
    d.text((28, h - 168), 'Potaje de garbanzos con', font=REG(26), fill='white')
    d.text((28, h - 136), 'calabaza. ¡Receta fácil!', font=REG(26), fill='white')
    return v

def iconos_laterales(d, x, y, resalte=0.0):
    # corazón, comentario y compartir (flecha), dibujados a mano
    d.ellipse((x - 6, y, x + 66, y + 72), fill=(255, 255, 255, 40))
    d.polygon([(x + 30, y + 58), (x + 6, y + 30), (x + 18, y + 16), (x + 30, y + 26), (x + 42, y + 16), (x + 54, y + 30)], fill='white')
    d.text((x + 30, y + 80), '12,4 mil', font=MED(22), fill='white', anchor='ma')
    y2 = y + 150
    d.rounded_rectangle((x + 4, y2 + 8, x + 56, y2 + 50), 16, fill='white')
    d.polygon([(x + 16, y2 + 48), (x + 12, y2 + 62), (x + 28, y2 + 48)], fill='white')
    d.text((x + 30, y2 + 80), '318', font=MED(22), fill='white', anchor='ma')
    y3 = y + 300
    r = 46 + 20 * resalte
    if resalte > 0:
        d.ellipse((x + 30 - r, y3 + 32 - r, x + 30 + r, y3 + 32 + r), fill=LIMON + (int(200 * resalte),))
    d.polygon([(x + 6, y3 + 50), (x + 6, y3 + 30), (x + 34, y3 + 30), (x + 34, y3 + 14), (x + 60, y3 + 38), (x + 34, y3 + 62), (x + 34, y3 + 46), (x + 16, y3 + 46)], fill='white')
    d.text((x + 30, y3 + 80), 'Compartir', font=MED(22), fill='white', anchor='ma')
    return (x + 30, y3 + 32)

def hoja_compartir(ancho, k_yoco):
    h = 520
    im = Image.new('RGBA', (ancho, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, ancho - 1, h + 60), 40, fill=(248, 247, 244, 255))
    d.rounded_rectangle((ancho / 2 - 40, 16, ancho / 2 + 40, 24), 4, fill=(200, 200, 200, 255))
    d.text((32, 52), 'Compartir en', font=MED(30), fill=TINTA)
    apps = [('Mensajes', (90, 200, 90)), ('Yococino', None), ('Correo', (70, 130, 220)), ('Notas', (240, 200, 70))]
    paso = (ancho - 40) / 4
    for i, (nombre, color) in enumerate(apps):
        cx = 20 + paso * i + paso / 2
        lado = 104
        if color is None:
            esc = 1 + 0.12 * math.sin(k_yoco * math.pi) if 0 < k_yoco < 1 else (1.0)
            l = int(lado * esc)
            if k_yoco > 0:
                d.rounded_rectangle((cx - l / 2 - 10, 116 - (l - lado) / 2 - 10, cx + l / 2 + 10, 116 + lado + (l - lado) / 2 + 10), 34, outline=LIMON, width=7)
            ic = redondear(ICONO.resize((l, l), Image.LANCZOS), int(l * 0.24))
            im.alpha_composite(ic, (int(cx - l / 2), int(116 - (l - lado) / 2)))
        else:
            d.rounded_rectangle((cx - lado / 2, 116, cx + lado / 2, 116 + lado), 26, fill=color + (255,))
        d.text((cx, 240), nombre, font=MED(24), fill=TINTA, anchor='ma')
    for j, op in enumerate(('Copiar enlace', 'Guardar vídeo')):
        d.rounded_rectangle((32, 300 + j * 96, ancho - 32, 380 + j * 96), 22, fill=(255, 255, 255, 255))
        d.text((64, 324 + j * 96), op, font=MED(28), fill=TINTA)
    return im

def pantalla_guardada(k):
    """La app con la receta ya guardada en Mis recetas."""
    w, h = 584, 1010
    im = Image.new('RGBA', (w, h), CREMA + (255,))
    d = ImageDraw.Draw(im)
    d.text((32, 40), 'Mis recetas', font=TIT(48), fill=TINTA)
    d.rounded_rectangle((32, 120, w - 32, 196), 24, fill=(232, 240, 226, 255))
    d.ellipse((52, 140, 88, 176), fill=OLIVA)
    d.line((61, 158, 68, 166, 80, 150), fill='white', width=5)
    d.text((104, 140), 'Receta guardada', font=MED(30), fill=OLIVA)
    foto = captura(3, 1283).crop((0, 0, 1283, 700)).resize((w - 64, round(700 * (w - 64) / 1283)), Image.LANCZOS)
    tarjeta = Image.new('RGBA', (w - 64, foto.height + 210), (255, 255, 255, 255))
    tarjeta.paste(foto, (0, 0))
    dt = ImageDraw.Draw(tarjeta)
    dt.text((24, foto.height + 24), 'Potaje de garbanzos', font=TIT(36), fill=TINTA)
    dt.text((24, foto.height + 70), 'con calabaza y acelgas', font=TIT(36), fill=TINTA)
    dt.text((24, foto.height + 128), 'Almuerzo · 30 min · 710 kcal', font=REG(26), fill=(110, 115, 110))
    tarjeta = redondear(tarjeta, 30)
    im.alpha_composite(tarjeta, (32, int(226 + (1 - k) * 60)))
    d.rounded_rectangle((32, h - 130, w - 32, h - 44), 43, fill=OLIVA + (255,))
    d.text((w / 2, h - 106), 'Añadir a mi menú', font=MED(32), fill='white', anchor='ma')
    return im

def e_tiktok(t, dur):
    im = fondo((246, 241, 232))
    titulo(im, t, '¿Una receta en TikTok?', sub='Dale a Compartir y elige Yococino')
    k = suave(t / 0.6)
    ancho = 620
    # Fases: 0 vídeo → toque en Compartir → hoja de compartir → toque en Yococino → receta guardada
    t1, t2, t3, t4 = dur * 0.30, dur * 0.40, dur * 0.57, dur * 0.74
    if t < t4:
        v = tiktok_video()
        d = ImageDraw.Draw(v)
        resalte = suave((t - t1) / 0.3) if t1 <= t < t2 + 0.3 else 0
        cx, cy = iconos_laterales(d, v.width - 96, 380, resalte)
        if t >= t2:
            kk = suave((t - t2) / 0.4)
            velo = Image.new('RGBA', v.size, (0, 0, 0, int(110 * kk)))
            v.alpha_composite(velo)
            hoja = hoja_compartir(v.width, suave((t - t3) / 0.5) if t >= t3 else 0)
            v.alpha_composite(hoja, (0, int(v.height - hoja.height * kk)))
        pant = v
    else:
        pant = pantalla_guardada(suave((t - t4) / 0.5))
    tel = movil(pant.convert('RGB'), ancho)
    x, y = W / 2 - ancho / 2, 520 + (1 - k) * 700
    poner(im, tel, x, y)
    # Dedo (círculo) que toca Compartir y luego Yococino
    d = ImageDraw.Draw(im)
    escala = (ancho - 36) / 584
    def toque(px, py, tt):
        if 0 <= tt <= 0.6:
            r = 30 + 30 * tt
            a = int(220 * (1 - tt / 0.6))
            capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(capa).ellipse((px - r, py - r, px + r, py + r), fill=(255, 255, 255, a), outline=(29, 42, 35, a), width=5)
            im.alpha_composite(capa)
    toque(x + 18 + (584 - 96 + 30) * escala, y + 18 + BARRA + (380 + 332) * escala, t - t1)
    toque(x + 18 + (20 + (544 / 4) * 1.5) * escala, y + 18 + BARRA + (1010 - 520 + 168) * escala, t - t3)
    if t >= t4:
        a = suave((t - t4) / 0.4)
        capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dc = ImageDraw.Draw(capa)
        dc.rounded_rectangle((W / 2 - 330, 1660 - 40, W / 2 + 330, 1660 + 50), 45, fill=OLIVA + (int(255 * a),))
        dc.text((W / 2, 1642), 'Guardada en tus recetas', font=MED(38), fill=(255, 255, 255, int(255 * a)), anchor='ma')
        im.alpha_composite(capa)
    return im

def e_cierre(t, dur):
    im = fondo()
    k = rebote(t / 0.6)
    lado = int(220 * max(0.01, k))
    logo = redondear(ICONO.resize((lado, lado), Image.LANCZOS), int(lado * 0.24))
    poner(im, logo, W / 2 - lado / 2, 380 - lado / 2 + 110)
    a = suave((t - 0.3) / 0.5)
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dc = ImageDraw.Draw(capa)
    dc.text((W / 2, 640), 'yococino', font=TIT(84), fill=OLIVA + (255,), anchor='ma')
    texto_centrado(dc, 800, 'Pruébala gratis\n7 días', TIT(96), TINTA + (255,))
    texto_centrado(dc, 1060, 'Menú del mes · Recetas paso a paso\nLista de la compra · Recetas de TikTok', MED(36), (90, 104, 94, 255), inter=1.35)
    capa.putalpha(capa.split()[3].point(lambda v: int(v * a)))
    im.alpha_composite(capa)
    tiendas(im, 1380, t - 0.6)
    a2 = suave((t - 1.2) / 0.5)
    d = ImageDraw.Draw(im)
    d.text((W / 2, 1600), 'yococino.app', font=MED(44), fill=OLIVA + (int(255 * a2),), anchor='ma')
    return im

ESCENAS = [
    ('intro', e_intro),
    ('menu', e_movil([1], 'Tu menú de todo el mes', 'A tu gusto, en un momento')),
    ('recetas', e_movil([3, 4], 'Recetas caseras', 'Paso a paso y con temporizador')),
    ('compra', e_movil([5], 'La lista de la compra', 'Se hace sola')),
    ('tiktok', e_tiktok),
    ('cierre', e_cierre),
]

def render(duraciones, salida, solo_fotogramas=False):
    salida = Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    archivos = []
    for (nombre, f), dur in zip(ESCENAS, duraciones):
        if solo_fotogramas:
            for frac in (0.15, 0.5, 0.9):
                f(dur * frac, dur).convert('RGB').save(salida / f'{nombre}-{int(frac * 100)}.jpg', quality=90)
            continue
        tmp = salida / f'{nombre}.tmp.mp4'
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                              '-c:v', 'libx264', '-crf', '19', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', str(tmp)], stdin=subprocess.PIPE)
        n = round(dur * FPS)
        for i in range(n):
            t = i / FPS
            fr = f(t, dur).convert('RGB')
            # fundido de entrada y salida dentro de cada escena
            fade = min(1.0, t / 0.2, (dur - t) / 0.2)
            if fade < 1:
                fr = Image.blend(Image.new('RGB', (W, H), CREMA), fr, max(0.0, fade))
            p.stdin.write(fr.tobytes())
        p.stdin.close()
        if p.wait() != 0:
            sys.exit(f'falló {nombre}')
        final = salida / f'{nombre}.mp4'
        os.replace(tmp, final)
        archivos.append(final)
    return archivos

if __name__ == '__main__':
    import json
    dur = json.loads(sys.argv[1])
    render(dur, sys.argv[2], '--fotogramas' in sys.argv)
