# Sketchpad

A fast, free drawing app that runs entirely in the browser, inspired by [sketch.io/sketchpad](https://sketch.io/sketchpad/).
No build step and no dependencies: just static HTML, CSS and JavaScript.

**Live:** <https://karankotz.github.io/sketchpad/>


## Features

- Brush (pen pressure supported), highlighter and eraser
- Line, arrow, rectangle and ellipse (Shift to snap or constrain), with optional fill
- Text, paint-bucket fill and color picker
- Color palette, custom color, size and opacity
- Undo / redo (50 steps), clear, export to PNG
- Insert images via the button, paste (Ctrl/Cmd+V) or drag and drop
- Autosaves to the browser (localStorage)
- Works with mouse, touch and stylus, with a mobile layout and dark-mode UI

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| B / M / E | Brush / highlighter / eraser |
| L / A / R / O | Line / arrow / rectangle / ellipse |
| T / F / I | Text / fill / color picker |
| `[` / `]` | Smaller / larger brush |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo, redo |
| Ctrl/Cmd+S | Download PNG |

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Host it online

Any static host works. A few free options:

- **GitHub Pages**: push this folder to a GitHub repo, then Settings → Pages → deploy from the `main` branch, root folder.
- **Netlify**: drag the folder onto <https://app.netlify.com/drop>, or run `npx netlify-cli deploy --prod --dir .`
- **Vercel**: `npx vercel --prod` from this folder.
- **Cloudflare Pages**: `npx wrangler pages deploy .`

## Project layout

```
index.html   page structure
styles.css   layout and theme
app.js       drawing engine, tools, history, UI wiring
favicon.svg  app icon
```
