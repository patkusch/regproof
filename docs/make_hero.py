"""Regenerate docs/hero.png from a running RegProof server.

Start the app first (npm run build && npm run start, or npm run dev), then:

    python docs/make_hero.py                      # http://localhost:3000
    python docs/make_hero.py http://localhost:3457

Needs Playwright for Python and its Chromium (pip install playwright;
playwright install chromium). Pillow is used only to shrink the file.

What it does, in order, all against the real app in its dark theme:
  1. Resets the demo, so the picture never depends on earlier clicks.
  2. Opens the Cohorts tab and hides every cohort card except COH-14 and
     COH-15. Those two both lack the same clause (Art. 30(3)(b), subcontracting),
     which makes them the clearest pair to compare. Nothing is edited: the
     other thirteen cards are only hidden for the crop.
  3. Opens COH-15's proposed amendment, types "agent" as the approver and
     presses "Resolve & approve", so the refusal on screen is the app's own.
  4. Captures the tab bar, the approver box and the two cards at 2x.
  5. Resets the demo again.
"""

import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
OUT = Path(__file__).with_name("hero.png")
KEEP = ("COH-14", "COH-15")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 1200, "height": 900},
        device_scale_factor=2,
        color_scheme="dark",
    )
    page = ctx.new_page()
    page.request.post(f"{BASE}/api/reset")
    page.goto(BASE, wait_until="networkidle")
    page.get_by_text("Cohorts built").wait_for()

    # Keep two cohort cards, hide the rest for the crop.
    page.evaluate(
        """(keep) => {
          const grid = document.querySelector('div.grid.md\\\\:grid-cols-2');
          for (const card of grid.children) {
            if (!keep.some((id) => card.textContent.includes(id))) card.style.display = 'none';
          }
        }""",
        list(KEEP),
    )

    card = page.locator("div.rounded-2xl", has_text="COH-15").last
    card.get_by_text("View proposed amendment").click()
    page.get_by_placeholder("Your name (required to approve)").fill("agent")
    card.get_by_role("button", name="Resolve & approve").click()
    page.get_by_text("The agent may not approve its own work").wait_for()

    # Bounding boxes are relative to the viewport; the clip is relative to the
    # page. Scroll to the top so the two agree.
    page.evaluate("window.scrollTo(0, 0)")
    top = page.locator("nav").bounding_box()
    grid = page.locator("div.grid.md\\:grid-cols-2").bounding_box()
    clip = {
        "x": top["x"] - 16,
        "y": top["y"] - 16,
        "width": top["width"] + 32,
        "height": grid["y"] + grid["height"] - top["y"] + 32,
    }
    png = page.screenshot(clip=clip, full_page=True)
    page.request.post(f"{BASE}/api/reset")
    browser.close()

# Flat dark UI: an 8-bit palette keeps it small with no visible loss.
img = Image.open(io.BytesIO(png)).convert("RGB")
img = img.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
img.save(OUT, optimize=True)
print(f"wrote {OUT} {img.size[0]}x{img.size[1]} {OUT.stat().st_size // 1024} KB")
