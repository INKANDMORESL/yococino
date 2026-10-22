# Carrusel de Instagram «Así funciona Yococino» (1080x1350, 4:5).
# Genera las imágenes en web/instagram/ para publicarlas en yococino.app/instagram/.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'web' / 'instagram'
SALIDA.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1350
CREMA, BLANCO, TINTA, TINTA2 = '#FBFAF6', '#FFFFFF', '#1D2A23', '#4A564F'
OLIVA, HOJA, LIMON, LIMON_S = '#4D6B3C', '#E6EDDC', '#EFC94C', '#FBF1CC'
F = '/usr/share/fonts/opentype/inter/'
def fuente(n, t): return ImageFont.truetype(F + n, t)
TIT = lambda t: fuente('InterDisplay-ExtraBold.otf', t)
MED = lambda t: fuente('Inter-Medium.otf', t)
SEMI = lambda t: fuente('Inter-SemiBold.otf', t)
EMOJI = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109)


def emoji(img, ch, x, y, tam):
    capa = Image.new('RGBA', (140, 140), (0, 0, 0, 0))
    ImageDraw.Draw(capa).text((0, 0), ch, font=EMOJI, embedded_color=True)
    capa = capa.crop(capa.getbbox()).resize((tam, tam), Image.LANCZOS)
    img.paste(capa, (x, y), capa)


def envolver(d, texto, f, ancho):
    lineas, actual = [], ''
    for p in texto.split():
        prueba = (actual + ' ' + p).strip()
        if d.textlength(prueba, font=f) <= ancho: actual = prueba
        else: lineas.append(actual); actual = p
    lineas.append(actual)
    return lineas


def parrafo(d, xy, texto, f, color, ancho, interl=1.3):
    x, y = xy
    for l in envolver(d, texto, f, ancho):
        d.text((x, y), l, font=f, fill=color)
        y += int(f.size * interl)
    return y


def marca(img, d, abajo=True):
    logo = Image.open(RAIZ / 'web' / 'icono.png').convert('RGBA').resize((64, 64), Image.LANCZOS)
    m = Image.new('L', (64, 64), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 63, 63), 16, fill=255)
    y = H - 110 if abajo else 60
    img.paste(logo, (80, y), m)
    d.text((160, y + 10), 'yo', font=TIT(36), fill=OLIVA)
    d.text((160 + d.textlength('yo', font=TIT(36)), y + 10), 'cocino', font=TIT(36), fill=TINTA)


def puntos(d, i, total):
    x0 = W - 80 - total * 26
    for k in range(total):
        c = OLIVA if k == i else '#D5D2C6'
        d.ellipse((x0 + k * 26, H - 85, x0 + k * 26 + 14, H - 71), fill=c)


PASOS = [
    ('1', '📝', 'Cuéntanos cómo eres', 'Una encuesta rápida: qué te gusta, qué no comes, tus alergias, tu objetivo y cuánto tiempo tienes para cocinar.'),
    ('2', '🍽️', 'Tu menú de 30 días', 'Desayuno, comida, merienda y cena pensados para ti. Siempre tienes 30 días por delante: se renueva solo.'),
    ('3', '👩‍🍳', 'Cocina paso a paso', 'Recetas sencillas con modo cocinar. ¿No te apetece un plato o te falta un ingrediente? Lo cambias en un toque.'),
    ('4', '🛒', 'La compra, hecha', 'La lista se crea sola con tu menú y para todos los que coméis en casa. Solo tienes que ir al súper.'),
]
TOTAL = len(PASOS) + 3


def portada():
    img = Image.new('RGB', (W, H), OLIVA); d = ImageDraw.Draw(img)
    d.ellipse((620, -180, 1300, 500), fill='#5A7A47')
    d.ellipse((-260, 980, 340, 1580), fill='#5A7A47')
    d.rounded_rectangle((80, 150, 80 + d.textlength('ASÍ FUNCIONA', font=SEMI(30)) + 48, 210), 30, fill=LIMON)
    d.text((104, 162), 'ASÍ FUNCIONA', font=SEMI(30), fill=TINTA)
    y = 270
    for l in ['Tu menú,', 'hecho para ti,', 'sin pensar.']:
        d.text((80, y), l, font=TIT(112), fill=BLANCO); y += 128
    parrafo(d, (80, y + 40), 'Menús, recetas y lista de la compra en una sola app. Te lo contamos en 4 pasos.', MED(40), '#E6EDDC', 880)
    for i, e in enumerate(['🥗', '🍳', '🍲']):
        emoji(img, e, 80 + i * 150, 1010, 120)
    d.text((W - 80 - d.textlength('Desliza →', font=SEMI(34)), H - 100), 'Desliza →', font=SEMI(34), fill=BLANCO)
    return img


def paso(i, num, em, titulo, texto):
    img = Image.new('RGB', (W, H), CREMA); d = ImageDraw.Draw(img)
    d.rounded_rectangle((60, 60, W - 60, H - 150), 48, fill=BLANCO)
    d.ellipse((120, 130, 250, 260), fill=OLIVA)
    d.text((185, 195), num, font=TIT(76), fill=BLANCO, anchor='mm')
    d.text((120 + 150, 165), f'PASO {num} DE 4', font=SEMI(30), fill=OLIVA)
    emoji(img, em, W - 330, 140, 200)
    y = 400
    for l in envolver(d, titulo, TIT(92), 820):
        d.text((120, y), l, font=TIT(92), fill=TINTA); y += 104
    d.rounded_rectangle((120, y + 30, 220, y + 42), 6, fill=LIMON)
    y = parrafo(d, (120, y + 90), texto, MED(44), TINTA2, 840, 1.38)
    detalle(img, d, num, max(y + 40, 860))
    marca(img, d); puntos(d, i, TOTAL)
    return img


DETALLE = {
    '1': ('chips', ['Sin gluten', 'Más verdura', '20 minutos', 'Sin marisco']),
    '2': ('filas', [('Desayuno', 'Porridge de avena con manzana'), ('Comida', 'Lentejas estofadas con verduras'), ('Cena', 'Tortilla de espinacas')]),
    '3': ('chips', ['Modo cocinar', 'Cambiar plato', 'Cambiar ingrediente']),
    '4': ('filas', [('✓', 'Tomates'), ('✓', 'Espinacas frescas'), ('✓', 'Huevos camperos')]),
}


def detalle(img, d, num, y):
    tipo, datos = DETALLE[num]
    if tipo == 'chips':
        x = 120
        for c in datos:
            w = d.textlength(c, font=SEMI(36)) + 60
            if x + w > W - 120: x = 120; y += 96
            d.rounded_rectangle((x, y, x + w, y + 76), 38, fill=HOJA)
            d.text((x + 30, y + 18), c, font=SEMI(36), fill=OLIVA)
            x += w + 18
    else:
        for a, b in datos:
            d.rounded_rectangle((120, y, W - 120, y + 76), 22, fill=CREMA)
            if a == '✓':
                d.rounded_rectangle((146, y + 18, 186, y + 58), 10, fill=OLIVA)
                d.line((155, y + 38, 164, y + 48, 178, y + 28), fill=BLANCO, width=6)
                d.text((210, y + 18), b, font=SEMI(36), fill=TINTA)
            else:
                d.text((150, y + 22), a.upper(), font=SEMI(28), fill=OLIVA)
                d.text((360, y + 18), b, font=SEMI(34), fill=TINTA)
            y += 88


def extras(i):
    img = Image.new('RGB', (W, H), HOJA); d = ImageDraw.Draw(img)
    d.text((80, 110), 'Y además…', font=TIT(96), fill=TINTA)
    items = [
        ('🧺', 'Cocina con lo que tienes', 'Dinos qué hay en la nevera y te damos ideas.'),
        ('🧒', 'Versión Peques', 'Cada receta adaptada para los niños de casa.'),
        ('📈', 'Tu progreso', 'Sigue tu evolución y la de tu familia.'),
        ('🚫', 'Tus alergias, siempre fuera', 'Nunca verás un plato con lo que no puedes comer.'),
    ]
    y = 280
    for em, t, s in items:
        d.rounded_rectangle((80, y, W - 80, y + 210), 36, fill=BLANCO)
        emoji(img, em, 120, y + 55, 100)
        d.text((260, y + 45), t, font=TIT(44), fill=TINTA)
        parrafo(d, (260, y + 108), s, MED(34), TINTA2, 700, 1.3)
        y += 240
    marca(img, d); puntos(d, i, TOTAL)
    return img


def final(i):
    img = Image.new('RGB', (W, H), LIMON); d = ImageDraw.Draw(img)
    d.ellipse((560, -240, 1340, 540), fill='#F3D56E')
    y = 230
    for l in ['Pruébala', 'gratis', '7 días']:
        d.text((80, y), l, font=TIT(140), fill=TINTA); y += 156
    parrafo(d, (80, y + 30), 'Sin compromiso. Te preparamos tu primer menú en un minuto.', MED(44), TINTA, 880)
    d.rounded_rectangle((80, 930, W - 80, 1070), 70, fill=TINTA)
    d.text((W // 2, 1000), 'yococino.app', font=TIT(64), fill=BLANCO, anchor='mm')
    d.text((W // 2, 1120), 'Enlace en la bio', font=SEMI(36), fill=TINTA, anchor='mm')
    marca(img, d); puntos(d, i, TOTAL)
    return img


imgs = [portada()] + [paso(k + 1, *p) for k, p in enumerate(PASOS)] + [extras(len(PASOS) + 1), final(len(PASOS) + 2)]
for k, im in enumerate(imgs, 1):
    im.save(SALIDA / f'como-funciona-{k}.jpg', quality=92)
print(len(imgs), 'imágenes en', SALIDA)
