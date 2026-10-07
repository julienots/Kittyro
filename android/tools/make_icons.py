"""Draw the Mossy Meadows launcher icon procedurally (no external assets)."""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

def icon(size):
    S = 1024
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # rounded square background: sky gradient
    sky = Image.new('RGBA', (S, S))
    sd = ImageDraw.Draw(sky)
    for y in range(S):
        t = y / S
        c = (int(143 + (255 - 143) * t * 0.6), int(211 + (244 - 211) * t * 0.6), int(255 - 40 * t), 255)
        sd.line([(0, y), (S, y)], fill=c)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=255)
    im.paste(sky, (0, 0), mask)
    # sun
    d.ellipse([690, 120, 890, 320], fill=(255, 214, 102, 255))
    # clouds
    for x, y, r in [(170, 230, 70), (240, 210, 90), (320, 240, 70)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 240))
    # floating island: soil layers
    d.ellipse([90, 520, 934, 760], fill=(122, 82, 50, 255))
    d.polygon([(120, 640), (904, 640), (700, 930), (330, 930)], fill=(154, 106, 66, 255))
    d.polygon([(260, 800), (764, 800), (640, 960), (400, 960)], fill=(110, 76, 48, 255))
    # grass top
    d.ellipse([80, 470, 944, 690], fill=(143, 207, 95, 255))
    d.ellipse([110, 460, 914, 640], fill=(166, 217, 126, 255))
    # house
    d.rectangle([420, 400, 640, 560], fill=(255, 241, 214, 255))
    d.polygon([(390, 410), (530, 290), (670, 410)], fill=(216, 102, 90, 255))
    d.rectangle([505, 470, 560, 560], fill=(138, 90, 58, 255))
    d.rectangle([440, 430, 485, 470], fill=(255, 240, 192, 255))
    d.rectangle([585, 430, 625, 470], fill=(255, 240, 192, 255))
    # tree
    d.rectangle([230, 430, 260, 540], fill=(122, 82, 50, 255))
    d.ellipse([160, 300, 330, 460], fill=(92, 168, 74, 255))
    d.ellipse([200, 270, 320, 390], fill=(124, 196, 90, 255))
    # sprout & flowers in front
    d.ellipse([700, 520, 740, 560], fill=(255, 143, 171, 255))
    d.ellipse([760, 540, 795, 575], fill=(255, 255, 255, 255))
    d.ellipse([300, 560, 335, 595], fill=(255, 209, 102, 255))
    d.line([(690, 600), (690, 520)], fill=(79, 158, 70, 255), width=14)
    d.ellipse([640, 490, 695, 525], fill=(108, 191, 76, 255))
    d.ellipse([688, 470, 745, 510], fill=(108, 191, 76, 255))
    im = im.filter(ImageFilter.SMOOTH)
    return im.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    res = sys.argv[1]
    for name, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        os.makedirs(f'{res}/mipmap-{name}', exist_ok=True)
        icon(size).save(f'{res}/mipmap-{name}/ic_launcher.png')
    if len(sys.argv) > 2:
        icon(512).save(sys.argv[2])
