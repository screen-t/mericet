"""One-off script to (re)generate the static Open Graph fallback image.

Not part of the build — run manually and commit the resulting PNG whenever
the brand mark changes (mirrors how the PWA icons were generated earlier).

Usage: python generate-og-image.py
"""
from PIL import Image
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(SCRIPT_DIR, "..", "public")
LOGO_PATH = os.path.join(PUBLIC_DIR, "logo.png")
OUTPUT_PATH = os.path.join(PUBLIC_DIR, "og-default.png")

WIDTH, HEIGHT = 1200, 630
# Same brand navy used for the dark PWA splash screen background.
BACKGROUND = (7, 15, 29, 255)
LOGO_TARGET_WIDTH = 480

canvas = Image.new("RGBA", (WIDTH, HEIGHT), BACKGROUND)

logo = Image.open(LOGO_PATH).convert("RGBA")
scale = LOGO_TARGET_WIDTH / logo.width
logo = logo.resize((LOGO_TARGET_WIDTH, round(logo.height * scale)), Image.LANCZOS)

x = (WIDTH - logo.width) // 2
y = (HEIGHT - logo.height) // 2
canvas.paste(logo, (x, y), logo)

canvas.convert("RGB").save(OUTPUT_PATH, "PNG")
print(f"Wrote {OUTPUT_PATH} ({WIDTH}x{HEIGHT})")
