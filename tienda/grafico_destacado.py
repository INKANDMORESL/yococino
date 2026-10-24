# Gráfico destacado de Google Play (1024x500).
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
RAIZ = Path(__file__).resolve().parent.parent
W, H = 1024, 500
OLIVA, TINTA, LIMON, BLANCO = '#4D6B3C', '#1D2A23', '#EFC94C', '#FFFFFF'
F = '/usr/share/fonts/opentype/inter/'
TIT = lambda t: ImageFont.truetype(F + 'InterDisplay-ExtraBold.otf', t)
MED = lambda t: ImageFont.truetype(F + 'Inter-Medium.otf', t)
EMOJI = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109)
def emoji(img, ch, x, y, tam):
    capa = Image.new('RGBA', (140, 140), (0, 0, 0, 0))
    ImageDraw.Draw(capa).text((0, 0), ch, font=EMOJI, embedded_color=True)
    capa = capa.crop(capa.getbbox()).resize((tam, tam), Image.LANCZOS)
    img.paste(capa, (x, y), capa)
img = Image.new('RGB', (W, H), OLIVA); d = ImageDraw.Draw(img)
d.ellipse((640, -220, 1240, 380), fill='#5A7A47'); d.ellipse((-200, 330, 260, 790), fill='#5A7A47')
logo = Image.open(RAIZ / 'web' / 'icono.png').convert('RGBA').resize((96, 96), Image.LANCZOS)
m = Image.new('L', (96, 96), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 95, 95), 24, fill=255)
img.paste(logo, (70, 70), m)
d.text((186, 82), 'yo', font=TIT(64), fill=LIMON); d.text((186 + d.textlength('yo', font=TIT(64)), 82), 'cocino', font=TIT(64), fill=BLANCO)
d.text((70, 215), 'Tu menú de 30 días,', font=TIT(56), fill=BLANCO)
d.text((70, 280), 'hecho para ti.', font=TIT(56), fill=BLANCO)
d.text((70, 370), 'Recetas paso a paso y la lista de la compra, sola.', font=MED(28), fill='#E6EDDC')
for i, e in enumerate(['🥘', '🥗', '🍳', '🛒']):
    emoji(img, e, 690 + (i % 2) * 150, 120 + (i // 2) * 150, 120)
img.save(RAIZ / 'tienda' / 'grafico-destacado.png')
print('ok')
