# Portfolio — Design Studio

Suraj Lagmavar's product design portfolio: a cinematic dark site with a playful "messy desk" homepage hero and a full case study for each project.

Plain HTML, CSS and JavaScript with no build step. Matter.js (desk physics), GSAP (scroll animation), Lenis (smooth scroll) and Three.js (optional 3D models on project pages) load from a CDN, so you need an internet connection.

## Preview it

```bash
cd ~/portfolio
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open http://127.0.0.1:4173 in Chrome. Press `Ctrl+C` in the terminal to stop.

Don't open `index.html` by double-clicking it. The 3D parts need a local server to load.

## Files

```
index.html            Homepage: hero, work, process, design lab, about, contact
work/regen.html       REGEN case study
work/helmet.html      Helmet case study
work/chair.html       Standing Chair case study
work/prithvi.html     PRITHVI+ Kiosk case study
css/style.css         All styling. Colours and fonts are at the top in :root
js/main.js            Smooth scroll, loader, page transitions, cursor, reveals
js/desk.js            Homepage hero: the throwable desk (physics)
js/stage.js           3D viewer (lighting, model loading, rotation)
js/project.js         Project page features: hotspots, exploded views, lightbox
js/compare-slider.js  Reusable sketch → render drag slider (project pages)
assets/img/…          Images, one folder per project
assets/models/        Your .glb 3D models go here
```

## Things to replace

1. **Contact details.** Email (surajlagmavar@gmail.com) and LinkedIn are set in `index.html` and the footer of every page in `work/`.
2. **Draft copy.** All text is a first draft. Anything marked `EDIT` in the HTML (skills, experience, project specs, research) needs your real details. Don't publish invented facts.
3. **REGEN CAD and prototype images.** Add `cad-01.jpg`, `proto-01.jpg` and `test-01.jpg` to `assets/img/regen/`, then replace the placeholder text inside each `frame__box` with `<img src="../assets/img/regen/cad-01.jpg" alt="…">`.

## The homepage desk

The hero is a messy designer's desk. Suraj's projects, sticky notes, a pencil, a ruler and a sketch sheet drop in with real physics. Visitors can grab and throw anything, and clicking a product opens its case study. Scrolling tilts the desk so everything slides left, out of the way of the intro text. "↻ drop them again" re-drops everything.

- Everything inside `<div class="desk">` in `index.html` is one physics object. `data-x` sets where it lands (0 = left, 1 = right).
- To add a project, copy one of the `<a class="desk__item …">` lines and point it at the new page and image. To change a sticky note, edit its text.
- Items marked `data-extra` are hidden on phones to keep the desk tidy.
- With reduced motion turned on, the items sit in a neat row and don't move.

## Adding your 3D models

The site checks for these files on its own:

| File | Where it shows |
|---|---|
| `assets/models/regen.glb`, `helmet.glb`, `chair.glb`, `prithvi.glb` | Intro of that project page (the product becomes drag-to-rotate) |

Export notes:
- Use the **glTF binary (.glb)** format. If your CAD tool can't export it, import the model into Blender (free) and use File → Export → glTF 2.0 (.glb).
- Keep each file under about 10 MB. In Blender, tick *Compression* (Draco) when you export.
- Apply your materials before exporting. The site adds the lighting and centres and scales the model for you.

## Adding the next project

1. Copy one of the project pages, e.g. `work/chair.html`, to something like `work/rebox.html`.
2. Swap the text and image paths. Keep the 7 chapters: Product → Features → Problem → Research → Ideation → CAD & Prototyping → Final.
3. Hotspot positions are `--x` / `--y` percentages on the image. Adjust them until the dots sit on the right parts.
4. In `index.html`, turn that project's card from `<article class="card … is-soon" data-cursor="Soon">` into `<a class="card …" href="work/rebox.html" data-cursor="View">` and change the badge text.
5. Update the "Next" link at the bottom of the previous project page (`prithvi.html`) to point to the new page.

## Sketch → render sliders and exploded views (project pages)

Every project page (`work/helmet.html`, `regen.html`, `chair.html`, `prithvi.html`) has:

- **A Design Evolution slider** (chapter 05) for dragging between the initial sketch and the final render. It works with mouse, touch and keyboard. The code is `js/compare-slider.js`.
- **A looping exploded view** (chapter 06) on Helmet, Chair and PRITHVI+. The parts slide together and apart like a GIF, with numbered labels and a Pause button. The parts were cut out of your exploded renders and live in `assets/img/<project>/exploded/`.

**Sketches.** The Helmet slider uses a side-view sketch from Suraj's helmet sketch sheet, lined up with the final render (`assets/img/helmet/sketch.jpg`). The full sheet is in the Ideation chapter (`sketch-sheet-01.jpg`). Until these files exist, the other two sliders show a labelled placeholder on the sketch side:

| Project | Save your sketch as |
|---|---|
| Standing Chair | `assets/img/chair/sketch.jpg` |
| PRITHVI+ | `assets/img/prithvi/sketch.jpg` |

Export each sketch at the same angle, scale and framing as that page's final render (`helmet/render-side.png`, `chair/render-01.jpg`, `prithvi/cad-front.png`). If a sketch sits slightly off, nudge it on its `<img>`, e.g. `style="--x:-1%; --y:0.5%; --s:1.02"`. Using PNG? Change the `src`.

The other empty "Add image" boxes (sketch sheets, CAD, prototype, testing) name the file they expect. Save the image there and replace the placeholder text with an `<img>`.

## Images

On the dark background, renders look best as PNGs with a **transparent background**. KeyShot can export these: tick *Include alpha* when you render. Use them with the `card--stage` style, as the REGEN and PRITHVI+ cards do. Renders on a white background work as full-bleed card images.

## Publishing later

This is a public portfolio, so it doesn't need a login. When you're ready, any free static host works: Netlify (drag the folder onto app.netlify.com/drop), GitHub Pages, or Vercel. After that you can buy a domain and connect it in the host's settings.
