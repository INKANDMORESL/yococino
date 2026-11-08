# Capturas para iPad 13" (2064x2752): la app como se ve en tablet, en una columna centrada dentro de un iPad.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from capturas import TEXTOS, FONDOS, OSCURO, TIT, MED, envolver, ORIG, RAIZ

W, H = 2064, 2752


def hacer(i):
    fondo = FONDOS[i]
    claro = fondo == OSCURO
    tinta = '#FFFFFF' if claro else '#1D2A23'
    acento = '#EFC94C' if claro else '#4D6B3C'
    sub = '#E6EDDC' if claro else '#4A564F'
    img = Image.new('RGB', (W, H), fondo)
    d = ImageDraw.Draw(img)
    k = W / 1500
    deco = '#5A7A47' if claro else '#EADFCB'
    d.ellipse((W * 0.66, -W * 0.22, W * 1.2, W * 0.32), fill=deco)
    d.ellipse((-W * 0.22, H * 0.74, W * 0.28, H * 0.74 + W * 0.5), fill=deco)
    l1, l2, s = TEXTOS[i]
    y = int(100 * k)
    d.text((W / 2, y), l1, font=TIT(int(80 * k)), fill=tinta, anchor='ma')
    y += int(94 * k)
    d.text((W / 2, y), l2, font=TIT(int(80 * k)), fill=acento, anchor='ma')
    y += int(112 * k)
    for linea in envolver(d, s, MED(int(34 * k)), W - 300 * k):
        d.text((W / 2, y), linea, font=MED(int(34 * k)), fill=sub, anchor='ma')
        y += int(46 * k)
    # iPad
    arriba = y + int(40 * k)
    # Ancho para que la columna de la app llegue justo hasta abajo de la imagen
    cap = Image.open(ORIG / f'{i + 1}.jpg').convert('RGB')
    borde = int(26 * k)
    alto_vis = H - arriba - borde
    ancho_p = min(int(W * 0.92), int(alto_vis * cap.width / cap.height * 1032 / 680))
    alto_p = int(ancho_p * 2752 / 2064)
    radio = int(56 * k)
    x0 = (W - ancho_p - 2 * borde) // 2
    marco = (x0, arriba, x0 + ancho_p + 2 * borde, arriba + alto_p + 2 * borde)
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((marco[0], marco[1] + 24 * k, marco[2], marco[3] + 24 * k), radio, fill=(0, 0, 0, 90))
    sombra = sombra.filter(ImageFilter.GaussianBlur(30 * k))
    img.paste(sombra, (0, 0), sombra)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(marco, radio, fill='#1D2A23')
    # Pantalla: fondo crema y la app en una columna de 680 de 1032 puntos
    visible = min(alto_p, H - arriba - borde)
    pantalla = Image.new('RGB', (ancho_p, alto_p), '#EDE6D8')
    ancho_c = int(ancho_p * 680 / 1032)
    col = cap.resize((ancho_c, int(ancho_c * cap.height / cap.width)), Image.LANCZOS)
    xc = (ancho_p - ancho_c) // 2
    pantalla.paste(col.crop((0, 0, ancho_c, min(col.height, alto_p))), (xc, 0))
    if col.height < alto_p:  # el resto de la columna, del color de fondo de la app
        fondo_app = col.getpixel((ancho_c // 2, col.height - 2))
        ImageDraw.Draw(pantalla).rectangle((xc, col.height, xc + ancho_c - 1, alto_p), fill=fondo_app)
    dp = ImageDraw.Draw(pantalla)
    dp.line((xc - 1, 0, xc - 1, alto_p), fill='#D8D0C0', width=2)
    dp.line((xc + ancho_c, 0, xc + ancho_c, alto_p), fill='#D8D0C0', width=2)
    m = Image.new('L', pantalla.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho_p - 1, alto_p - 1), radio - borde, fill=255)
    img.paste(pantalla, (x0 + borde, arriba + borde), m)
    carpeta = RAIZ / 'app-store-ipad'
    carpeta.mkdir(exist_ok=True)
    img.save(carpeta / f'captura-{i + 1}.png')


for i in range(6):
    hacer(i)
print('ok')
