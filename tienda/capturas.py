# Capturas para Google Play (1080x1920) y App Store (1290x2796) a partir de capturas reales de la app.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent
ORIG = RAIZ / 'capturas-originales'
F = '/usr/share/fonts/opentype/inter/'
TIT = lambda t: ImageFont.truetype(F + 'InterDisplay-ExtraBold.otf', t)
MED = lambda t: ImageFont.truetype(F + 'Inter-Medium.otf', t)

TEXTOS = [
    ('Tu menú,', 'hecho para ti', 'Cada día sabes qué comer, sin pensar.'),
    ('30 días de menú,', 'siempre por delante', 'Se renueva solo. Cambia platos en un toque.'),
    ('Recetas caseras', 'que apetecen', 'De temporada, sanas y con todos sus datos.'),
    ('Paso a paso,', 'con temporizador', 'Modo cocinar: la pantalla no se apaga.'),
    ('La compra,', 'hecha sola', 'Para todos los de casa, con las cantidades sumadas.'),
    ('Más de 400 recetas', 'para elegir', 'Filtra por carne, pescado, legumbres… y guarda las de TikTok.'),
]
FONDOS = ['#4D6B3C', '#F4ECDE', '#4D6B3C', '#F4ECDE', '#4D6B3C', '#F4ECDE']
OSCURO = '#4D6B3C'


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


def hacer(i, W, H, carpeta):
    fondo = FONDOS[i]
    claro = fondo == OSCURO
    tinta = '#FFFFFF' if claro else '#1D2A23'
    acento = '#EFC94C' if claro else '#4D6B3C'
    sub = '#E6EDDC' if claro else '#4A564F'
    img = Image.new('RGB', (W, H), fondo)
    d = ImageDraw.Draw(img)
    k = W / 1080
    # Círculos decorativos
    deco = '#5A7A47' if claro else '#EADFCB'
    d.ellipse((W * 0.62, -W * 0.25, W * 1.3, W * 0.43), fill=deco)
    d.ellipse((-W * 0.3, H * 0.78, W * 0.35, H * 0.78 + W * 0.65), fill=deco)
    l1, l2, s = TEXTOS[i]
    y = int(110 * k)
    d.text((W / 2, y), l1, font=TIT(int(84 * k)), fill=tinta, anchor='ma')
    y += int(98 * k)
    d.text((W / 2, y), l2, font=TIT(int(84 * k)), fill=acento, anchor='ma')
    y += int(118 * k)
    for linea in envolver(d, s, MED(int(36 * k)), W - 160 * k):
        d.text((W / 2, y), linea, font=MED(int(36 * k)), fill=sub, anchor='ma')
        y += int(48 * k)
    # Móvil con la captura
    cap = Image.open(ORIG / f'{i + 1}.jpg').convert('RGB')
    arriba = y + int(40 * k)
    alto_disp = H - arriba + int(260 * k)  # el móvil se sale un poco por abajo
    ancho_m = int(W * 0.78)
    alto_m = int(ancho_m * cap.height / cap.width)
    if alto_m > alto_disp:
        alto_m = alto_disp
    borde = int(22 * k)
    radio = int(70 * k)
    x0 = (W - ancho_m - 2 * borde) // 2
    marco = (x0, arriba, x0 + ancho_m + 2 * borde, arriba + alto_m + 2 * borde)
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((marco[0], marco[1] + 24 * k, marco[2], marco[3] + 24 * k), radio, fill=(0, 0, 0, 90))
    sombra = sombra.filter(ImageFilter.GaussianBlur(30 * k))
    img.paste(sombra, (0, 0), sombra)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(marco, radio, fill='#1D2A23')
    pantalla = cap.resize((ancho_m, int(ancho_m * cap.height / cap.width)), Image.LANCZOS).crop((0, 0, ancho_m, alto_m))
    m = Image.new('L', pantalla.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho_m - 1, alto_m - 1), radio - borde, fill=255)
    img.paste(pantalla, (x0 + borde, arriba + borde), m)
    carpeta.mkdir(parents=True, exist_ok=True)
    img.save(carpeta / f'captura-{i + 1}.png')


for i in range(6):
    hacer(i, 1080, 1920, RAIZ / 'google-play')
    hacer(i, 1290, 2796, RAIZ / 'app-store')
print('ok')
