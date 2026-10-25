# Monta un reel vertical (1080x1920) a partir de clips de redes/clips/ con textos, transiciones y un cierre con la app.
# Uso: python3 redes/montar_reel.py redes/videos/<plan>.json
# El plan lleva, además de los clips para Veo, el montaje: textos de cada clip y el cierre.
import json, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
W, H = 1080, 1920
F = '/usr/share/fonts/opentype/inter/'
TIT = lambda t: ImageFont.truetype(F + 'InterDisplay-ExtraBold.otf', t)
MED = lambda t: ImageFont.truetype(F + 'Inter-SemiBold.otf', t)
OLIVA, CREMA, TINTA, LIMON = '#4D6B3C', '#FBFAF6', '#1D2A23', '#EFC94C'
FUNDIDO = 0.4


def envolver(d, texto, f, ancho):
    lineas, actual = [], ''
    for p in texto.split():
        prueba = (actual + ' ' + p).strip()
        if d.textlength(prueba, font=f) <= ancho:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    lineas.append(actual)
    return lineas


def rotulo(texto, destacado, ruta):
    """Texto grande abajo, con degradado oscuro para que se lea sobre cualquier imagen."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # Degradado inferior
    grad = Image.new('L', (1, H), 0)
    for y in range(H):
        grad.putpixel((0, y), int(max(0, (y - H * 0.52) / (H * 0.48)) ** 1.4 * 190))
    img.paste(Image.new('RGBA', (W, H), (10, 16, 12, 255)), (0, 0), grad.resize((W, H)))
    d = ImageDraw.Draw(img)
    f = TIT(84)
    lineas = envolver(d, texto, f, W - 160)
    # Por encima de la zona que tapan el texto y los botones de Instagram.
    y = H - 560 - len(lineas) * 96
    if destacado:
        fd = MED(34)
        ancho = d.textlength(destacado, font=fd) + 56
        d.rounded_rectangle((80, y - 86, 80 + ancho, y - 26), 30, fill=LIMON)
        d.text((108, y - 77), destacado, font=fd, fill=TINTA)
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sombra)
    for i, l in enumerate(lineas):
        ds.text((80, y + i * 96 + 4), l, font=f, fill=(0, 0, 0, 140))
    img.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lineas):
        d.text((80, y + i * 96), l, font=f, fill='#FFFFFF')
    # Marca pequeña arriba
    logo = Image.open(RAIZ / 'web' / 'icono.png').convert('RGBA').resize((56, 56), Image.LANCZOS)
    m = Image.new('L', (56, 56), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 55, 55), 14, fill=255)
    img.paste(logo, (80, 150), m)
    d.text((150, 158), 'yococino', font=TIT(34), fill='#FFFFFF')
    img.save(ruta)


def cierre(c, ruta):
    """Última pantalla: la app en un móvil, el logo y la llamada a probarla."""
    img = Image.new('RGB', (W, H), OLIVA)
    d = ImageDraw.Draw(img)
    d.ellipse((W * 0.55, -W * 0.3, W * 1.35, W * 0.5), fill='#5A7A47')
    d.ellipse((-W * 0.4, H * 0.8, W * 0.35, H * 0.8 + W * 0.75), fill='#5A7A47')
    logo = Image.open(RAIZ / 'web' / 'icono.png').convert('RGBA').resize((110, 110), Image.LANCZOS)
    m = Image.new('L', (110, 110), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 109, 109), 28, fill=255)
    f = TIT(76)
    ancho = 110 + 26 + d.textlength('yococino', font=f)
    x0 = int((W - ancho) / 2)
    img.paste(logo, (x0, 150), m)
    d.text((x0 + 136, 160), 'yococino', font=f, fill='#FFFFFF')
    y = 330
    for l in [x for parte in c['titulo'].split('\n') for x in envolver(d, parte, TIT(70), W - 160)]:
        d.text((W / 2, y), l, font=TIT(70), fill='#FFFFFF', anchor='ma')
        y += 84
    # Móvil con captura
    cap = Image.open(RAIZ / c['captura']).convert('RGB')
    ancho_m = 620
    alto_m = min(int(ancho_m * cap.height / cap.width), H - y - 420)
    borde, radio = 18, 64
    x = (W - ancho_m - 2 * borde) // 2
    yt = y + 50
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((x, yt + 24, x + ancho_m + 2 * borde, yt + alto_m + 2 * borde + 24), radio, fill=(0, 0, 0, 110))
    img.paste(sombra.filter(ImageFilter.GaussianBlur(30)), (0, 0), sombra.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, yt, x + ancho_m + 2 * borde, yt + alto_m + 2 * borde), radio, fill='#1D2A23')
    pant = cap.resize((ancho_m, int(ancho_m * cap.height / cap.width)), Image.LANCZOS).crop((0, 0, ancho_m, alto_m))
    mm = Image.new('L', pant.size, 0)
    ImageDraw.Draw(mm).rounded_rectangle((0, 0, ancho_m - 1, alto_m - 1), radio - borde, fill=255)
    img.paste(pant, (x + borde, yt + borde), mm)
    # Botón y web
    yb = yt + alto_m + 2 * borde + 70
    fb = TIT(46)
    tb = c['boton']
    ab = d.textlength(tb, font=fb) + 100
    d.rounded_rectangle(((W - ab) / 2, yb, (W + ab) / 2, yb + 104), 52, fill=LIMON)
    d.text((W / 2, yb + 52), tb, font=fb, fill=TINTA, anchor='mm')
    d.text((W / 2, yb + 150), c.get('pie', 'yococino.app'), font=MED(38), fill='#E6EDDC', anchor='ma')
    img.save(ruta)


def duracion(ruta):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(ruta)], capture_output=True, text=True)
    return float(r.stdout.strip())


def tiene_audio(ruta):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', str(ruta)], capture_output=True, text=True)
    return bool(r.stdout.strip())


def main(plan_ruta):
    plan = json.loads(Path(plan_ruta).read_text())
    m = plan['montaje']
    tmp = Path(tempfile.mkdtemp())
    partes = []
    # 1. Cada clip: recortado, a 1080x1920 y 30 fps, con su rótulo encima y audio normalizado.
    for i, c in enumerate(plan['clips']):
        entrada = RAIZ / 'redes' / 'clips' / f"{c['nombre']}.mp4"
        t = c.get('segundos', 4.0)
        ini = c.get('desde', 0.5)
        rot = tmp / f'r{i}.png'
        rotulo(c['texto'], c.get('destacado'), rot)
        salida = tmp / f'p{i}.mp4'
        cmd = ['ffmpeg', '-y', '-v', 'error', '-ss', str(ini), '-t', str(t), '-i', str(entrada), '-loop', '1', '-t', str(t), '-i', str(rot)]
        filtro = (
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1,"
            f"eq=contrast=1.04:saturation=1.08[v];"
            f"[1:v]format=rgba,fade=in:st=0.15:d=0.35:alpha=1[t];[v][t]overlay=0:0:format=auto[vo]"
        )
        if tiene_audio(entrada):
            cmd += ['-filter_complex', filtro + f";[0:a]aresample=48000,volume=0.8,afade=in:d=0.2,afade=out:st={t - 0.3}:d=0.3[ao]", '-map', '[vo]', '-map', '[ao]']
        else:
            cmd += ['-f', 'lavfi', '-t', str(t), '-i', 'anullsrc=r=48000:cl=stereo', '-filter_complex', filtro, '-map', '[vo]', '-map', '2:a']
        cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest', str(salida)]
        subprocess.run(cmd, check=True)
        partes.append((salida, t))
    # 2. Cierre con la app (imagen fija con un zoom muy suave).
    fin = tmp / 'cierre.png'
    cierre(m['cierre'], fin)
    tc = m['cierre'].get('segundos', 3.5)
    salida = tmp / 'pfin.mp4'
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-loop', '1', '-t', str(tc), '-i', str(fin), '-f', 'lavfi', '-t', str(tc), '-i', 'anullsrc=r=48000:cl=stereo',
        '-filter_complex', f"[0:v]scale=1188:2112,zoompan=z='min(1+on/{int(tc*30)}*0.04,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(tc*30)}:s={W}x{H}:fps=30,setsar=1[v]",
        '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest', str(salida),
    ], check=True)
    partes.append((salida, tc))
    # 3. Todo junto con fundidos.
    cmd = ['ffmpeg', '-y', '-v', 'error']
    for p, _ in partes:
        cmd += ['-i', str(p)]
    fv, fa, acum = [], [], 0.0
    ult_v, ult_a = '0:v', '0:a'
    for k in range(1, len(partes)):
        acum += partes[k - 1][1] - FUNDIDO
        fv.append(f"[{ult_v}][{k}:v]xfade=transition=fade:duration={FUNDIDO}:offset={acum:.2f}[v{k}]")
        fa.append(f"[{ult_a}][{k}:a]acrossfade=d={FUNDIDO}[a{k}]")
        ult_v, ult_a = f'v{k}', f'a{k}'
    final = RAIZ / 'redes' / 'reels' / f"{Path(plan_ruta).stem}.mp4"
    final.parent.mkdir(parents=True, exist_ok=True)
    cmd += ['-filter_complex', ';'.join(fv + fa), '-map', f'[{ult_v}]', '-map', f'[{ult_a}]',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', str(final)]
    subprocess.run(cmd, check=True)
    # Portada para Instagram (el primer rótulo sobre un fotograma).
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '1.2', '-i', str(final), '-frames:v', '1', '-q:v', '2', str(final.with_suffix('.jpg'))], check=True)
    print(final, f'{duracion(final):.1f} s')


if __name__ == '__main__':
    main(sys.argv[1])
