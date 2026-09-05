# Self-hosted fonts

## AbyssinicaSIL-Ethiopic.woff2

Abyssinica SIL, subset to the Ethiopic blocks and converted to WOFF2.

- **Source**: [google/fonts `ofl/abyssinicasil`](https://github.com/google/fonts/tree/main/ofl/abyssinicasil)
- **Licence**: SIL Open Font License 1.1 — see `OFL.txt` (Reserved Font Names
  "Abyssinica" and "SIL", so a modified font may not be shipped under that name;
  subsetting without renaming is permitted).
- **Size**: 268 kB TTF → 77 kB WOFF2, 495 glyphs.

### Why self-hosted

Ethiopic is part of Temari's identity — the wordmark ተማሪ and every Subject's
Amharic title — not a fallback. The previous `@font-face` resolved through
`local('Nyala'), local('Kefa')` before a webfont, so the wordmark rendered in a
different typeface on Windows, macOS and Linux. Pinning one file makes the
identity the same everywhere.

The `unicode-range` in `src/index.css` restricts this face to the Ethiopic
blocks, so the file is only fetched when Ethiopic is actually rendered and Latin
text never blocks on it.

### Regenerating

```bash
# Fetch upstream, then:
python3 -m fontTools.subset AbyssinicaSIL-Regular.ttf \
  --unicodes="U+1200-137F,U+1380-139F,U+2D80-2DDF,U+AB00-AB2F" \
  --layout-features='*' --flavor=woff2 \
  --output-file=AbyssinicaSIL-Ethiopic.woff2
```

Keep the `unicode-range` in `index.css` in sync with the `--unicodes` above.
