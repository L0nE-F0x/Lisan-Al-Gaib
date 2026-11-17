# Lisan al-Gaib — Imperial Archives

An unofficial, non-commercial fan atlas of Arrakis and the Known Universe, following **Frank Herbert's six Dune novels only**.

**Live:** https://lisan-al-gaib.netlify.app

- **Archives** (`/`): landing page with the six books, the powers of the Imperium, Shai-Hulud, and a countdown to *Dune: Part Three*.
- **Arrakis** (`/arrakis/`): a procedurally generated globe that unrolls into a flat map. Places, rulers and people change with the year, from the Atreides arrival to Leto II's green Arrakis and the burning of Rakis.
- **Known Universe** (`/universe/`): a galaxy map spanning 15,000 years, showing who held which world, who was where, and what happened.

All three pages support touch, keyboard and screen readers, and accept shareable links (`?year=…&focus=…`). Sound is off by default.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run validate   # check the lore dataset (ids, dates, lifespans, contrast)
npm run build      # validate + typecheck + build to dist/
```

Netlify builds from `main` automatically (see `netlify.toml`).

## Layout

| Path | What |
| --- | --- |
| `src/data/` | Lore dataset (typed) + timeline-aware query helpers. Canon: Herbert's novels and appendices only. |
| `src/shared/` | Design system, site shell, procedural globe, timeline, detail sheet, search, gestures, audio. |
| `src/hub`, `src/arrakis`, `src/universe` | The three pages. |
| `scripts/validate-data.ts` | Dataset validator (runs in the build). |
| `dev/og.html` | Renders `public/og.jpg` (screenshot it at 1200×630 with the dev server running). |

## Credits

- Simplex noise: Ian McEwan, Stefan Gustavson (Ashima Arts), MIT.
- Fonts: Cinzel, Rajdhani, JetBrains Mono via Fontsource (OFL).
- Every image and sound is original or procedurally generated.

Dune and related names are trademarks of their respective owners. This project is not affiliated with or endorsed by Herbert Properties LLC, Legendary Entertainment, Warner Bros. or any licensee.
