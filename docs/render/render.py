"""Draws frames.ts's JSON lines as the pane looks in a terminal: braille cells as round dots,
the pane's words beneath in a monospace face, all in a bordered pane. Writes a GIF (through
ffmpeg, with one shared palette) or, for the gallery, one PNG of every scene.

    python3 docs/render/render.py hero.jsonl docs/images/hero.gif
    python3 docs/render/render.py gallery.jsonl docs/images/scenes.png --gallery
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CELL_W, CELL_H = 10, 20
DOT_R = 1.7
TERMINAL = (13, 17, 23)
PANEL = (10, 15, 26)
BORDER = (59, 63, 70)
TITLE = (201, 209, 217)
STYLES = {
    'heading': ((124, 252, 0), 'bold'),
    'entry': ((230, 230, 230), 'regular'),
    'dim': ((139, 148, 158), 'regular'),
    'art': ((139, 148, 158), 'italic'),
}
FONTS = {
    'regular': ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 15),
    'bold': ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 15),
    'italic': ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Oblique.ttf', 15),
}
ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'


def cells(b64, count):
    raw = bytearray()
    for i in range(0, len(b64), 4):
        n = [0 if c == '=' else ALPHABET.index(c) for c in b64[i:i + 4]]
        v = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3]
        raw += bytes(((v >> 16) & 255, (v >> 8) & 255, v & 255))
    out = []
    for i in range(count):
        at = i * 12
        code = int.from_bytes(raw[at:at + 4], 'little')
        fg = int.from_bytes(raw[at + 4:at + 8], 'little')
        out.append((code, ((fg >> 16) & 255, (fg >> 8) & 255, fg & 255)))
    return out


# Braille dot bits by (column, row) within a cell.
DOTS = [(0, 0, 0x01), (0, 1, 0x02), (0, 2, 0x04), (1, 0, 0x08), (1, 1, 0x10), (1, 2, 0x20), (0, 3, 0x40), (1, 3, 0x80)]


def draw_screen(draw, frame, ox, oy):
    columns, rows = frame['columns'], frame['rows']
    draw.rectangle([ox, oy, ox + columns * CELL_W - 1, oy + rows * CELL_H - 1], fill=PANEL)
    for i, (code, fg) in enumerate(cells(frame['cells'], columns * rows)):
        x = ox + (i % columns) * CELL_W
        y = oy + (i // columns) * CELL_H
        if 0x2800 <= code <= 0x28FF:
            bits = code - 0x2800
            for dx, dy, bit in DOTS:
                if bits & bit:
                    cx = x + CELL_W * (0.3 + 0.4 * dx)
                    cy = y + CELL_H * (0.14 + 0.24 * dy)
                    draw.ellipse([cx - DOT_R, cy - DOT_R, cx + DOT_R, cy + DOT_R], fill=fg)
        elif code != 0x20:
            draw.text((x, y + 1), chr(code), font=FONTS['regular'], fill=fg)


def pane(frame, body_rows):
    """One frame inside a pane with its title in the top border, as Claude Code draws one."""
    columns = frame['columns']
    pad = 14
    width = columns * CELL_W + 2 * pad + 4
    height = body_rows * CELL_H + 2 * pad + 14
    image = Image.new('RGB', (width, height), TERMINAL)
    draw = ImageDraw.Draw(image)
    left, top = pad // 2, pad // 2 + 4
    draw.rounded_rectangle([left, top, width - pad // 2, height - pad // 2], radius=8, outline=BORDER, width=1)
    title = f" {frame['title']} "
    draw.rectangle([left + 14, top - 8, left + 14 + len(title) * 9, top + 8], fill=TERMINAL)
    draw.text((left + 14, top - 9), title, font=FONTS['bold'], fill=TITLE)
    ox, oy = pad + 2, pad + 6
    draw_screen(draw, frame, ox, oy)
    y = oy + frame['rows'] * CELL_H
    for line in frame['lines']:
        colour, face = STYLES[line['style']]
        draw.text((ox, y + 1), line['text'], font=FONTS[face], fill=colour)
        y += CELL_H
    return image


def gif(frames, out, fps=10):
    body_rows = max(f['rows'] + len(f['lines']) for f in frames)
    work = Path(tempfile.mkdtemp())
    try:
        for i, frame in enumerate(frames):
            pane(frame, body_rows).save(work / f'f{i:04d}.png')
        palette = work / 'palette.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', str(work / 'f%04d.png'),
                        '-vf', 'palettegen=max_colors=128:stats_mode=full', str(palette)], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', str(work / 'f%04d.png'), '-i', str(palette),
                        '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', str(out)], check=True)
    finally:
        shutil.rmtree(work)


def gallery(frames, out, across=3):
    tiles = []
    for frame in frames:
        tiles.append(pane(frame, frame['rows']))
    w, h = tiles[0].size
    sheet = Image.new('RGB', (w * across, h * ((len(tiles) + across - 1) // across)), TERMINAL)
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % across) * w, (i // across) * h))
    sheet.save(out, optimize=True)


if __name__ == '__main__':
    source, out = sys.argv[1], sys.argv[2]
    frames = [json.loads(line) for line in Path(source).read_text().splitlines() if line.strip()]
    if '--gallery' in sys.argv:
        gallery(frames, out)
    else:
        gif(frames, out)
    print(out, Path(out).stat().st_size // 1024, 'KB', len(frames), 'frames')
