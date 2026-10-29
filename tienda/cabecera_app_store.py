# Imágenes de la App Store (iOS 27): cabecera de la ficha (3840x1646, 21:9) y resultado de búsqueda (3840x2560, 3:2).
# Usa los móviles de las capturas de tienda/app-store. Sin precios ni direcciones web (normas de Apple). Sin transparencias.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
RAIZ = Path(__file__).resolve().parent.parent
OLIVA, TINTA, LIMON, BLANCO, CLARO = '#4D6B3C', '#1D2A23', '#EFC94C', '#FFFFFF', '#5A7A47'
F = '/usr/share/fonts/opentype/inter/'
TIT = lambda t: ImageFont.truetype(F + 'InterDisplay-ExtraBold.otf', t)
MED = lambda t: ImageFont.truetype(F + 'Inter-Medium.otf', t)

def movil(n: int, alto: int) -> Image.Image:
    cap = Image.open(RAIZ / 'tienda' / 'app-store' / f'captura-{n}.png').convert('RGB')
    m = cap.crop((112, 492, 1178, 2282))  # el móvil dentro de la captura
    r = m.resize((round(m.width * alto / m.height), alto), Image.LANCZOS)
    mascara = Image.new('L', r.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, r.width - 1, r.height - 1), round(r.width * 0.075), fill=255)
    capa = Image.new('RGBA', r.size, (0, 0, 0, 0))
    capa.paste(r, (0, 0), mascara)
    return capa

def pegar(fondo: Image.Image, capa: Image.Image, x: int, y: int):
    sombra = Image.new('RGBA', (capa.width + 160, capa.height + 160), (0, 0, 0, 0))
    a = capa.split()[3].point(lambda v: 90 if v else 0)
    sombra.paste((10, 20, 10, 255), (80, 100), a)
    sombra = sombra.filter(ImageFilter.GaussianBlur(40))
    fondo.alpha_composite(sombra, (x - 80, y - 80))
    fondo.alpha_composite(capa, (x, y))

def marca(d: ImageDraw.ImageDraw, img: Image.Image, x: int, y: int, tam: int):
    logo = Image.open(RAIZ / 'web' / 'icono.png').convert('RGBA').resize((tam, tam), Image.LANCZOS)
    m = Image.new('L', (tam, tam), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, tam - 1, tam - 1), round(tam * 0.24), fill=255)
    img.paste(logo, (x, y), m)
    f = TIT(round(tam * 0.68))
    d.text((x + tam + 40, y + tam * 0.1), 'yo', font=f, fill=LIMON)
    d.text((x + tam + 40 + d.textlength('yo', font=f), y + tam * 0.1), 'cocino', font=f, fill=BLANCO)

def fondo(w: int, h: int) -> Image.Image:
    img = Image.new('RGBA', (w, h), OLIVA)
    d = ImageDraw.Draw(img)
    d.ellipse((w * 0.55, -h * 0.55, w * 1.25, h * 0.75), fill=CLARO)
    d.ellipse((-w * 0.12, h * 0.62, w * 0.25, h * 1.5), fill=CLARO)
    return img

# Cabecera 21:9. En el iPhone se ve recortada por los lados y con botones arriba: todo va en el centro
# (entre x≈700 y x≈3140) y nada importante en la franja de arriba.
W, H = 3840, 1646
img = fondo(W, H); d = ImageDraw.Draw(img)
X = 820
marca(d, img, X, 380, 140)
d.text((X, 620), 'Tu menú del mes,', font=TIT(136), fill=BLANCO)
d.text((X, 785), 'hecho para ti', font=TIT(136), fill=LIMON)
d.text((X + 4, 1000), 'Recetas caseras y de temporada,', font=MED(60), fill='#E6EDDC')
d.text((X + 4, 1085), 'y tu lista de la compra preparada.', font=MED(60), fill='#E6EDDC')
pegar(img, movil(3, 1060), 2070, 420)
pegar(img, movil(1, 1180), 2370, 330)
img.convert('RGB').save(RAIZ / 'tienda' / 'app-store-cabecera' / 'cabecera-3840x1646.png')

# Resultado de búsqueda 3:2
W, H = 3840, 2560
img = fondo(W, H); d = ImageDraw.Draw(img)
t1, t2 = '¿No sabes qué cocinar?', 'Tu menú de 30 días, hecho para ti'
f1, f2 = TIT(200), MED(110)
d.text(((W - d.textlength(t1, font=f1)) / 2, 170), t1, font=f1, fill=BLANCO)
d.text(((W - d.textlength(t2, font=f2)) / 2, 430), t2, font=f2, fill=LIMON)
pegar(img, movil(1, 1750), 330, 780)
pegar(img, movil(5, 1750), 2467, 780)
pegar(img, movil(3, 1900), 1354, 680)
img.convert('RGB').save(RAIZ / 'tienda' / 'app-store-cabecera' / 'busqueda-3840x2560.png')
print('ok')
