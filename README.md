# Sketchpad

A fast, free drawing app that runs entirely in the browser, inspired by [sketch.io/sketchpad](https://sketch.io/sketchpad/).
No build step and no dependencies: just static HTML, CSS and JavaScript.

**Live:** <https://karankotz.github.io/sketchpad/>

## Features

- **AI system design assistant** (click **Design AI**): describe a system and it designs it with you on the board. It asks about requirements, offers ready-made frameworks, draws the architecture, then suggests the next improvement (add a cache, then pick a caching strategy, and so on) as clickable choices. It searches the web for current facts like managed-service limits and pricing
- **Frameworks and components**: six reference architectures (classic web app, microservices, event-driven, serverless, data pipeline, real-time chat) and 24 building blocks (load balancer, cache, queue, database and more) you can drop in without AI
- **Live collaboration**: click **Share**, enter your name, and send the link. Anyone who opens it just types a name to join and draw with you in real time, with live cursors and avatars
- Brush (pen pressure supported), highlighter and eraser
- 37 shapes in a picker (press **S**), grouped into:
  - **Lines & connectors**: line, arrow, double arrow, elbow connector
  - **Basic**: rectangle, rounded rectangle, ellipse, triangles, diamond, polygons, star, heart, plus, block arrow, speech bubble, cloud, lightning
  - **Flowchart**: terminator, process, decision, data, document, predefined process, manual input, delay, preparation
  - **Architecture**: database, queue, server, cloud service, actor, user, component, folder/package, note, web app, mobile app
- Shape fill (none, light tint or solid) and dashed lines, for architecture and flow diagrams. Hold Shift to snap lines or make shapes square
- Text, paint-bucket fill and color picker
- Color palette, custom color, size and opacity
- Undo / redo (only your own changes, even on a shared board), clear, export to PNG
- Insert images via the button, paste (Ctrl/Cmd+V) or drag and drop
- Autosaves to the browser (localStorage)
- Works with mouse, touch and stylus, with a mobile layout and dark-mode UI

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| B / M / E | Brush / highlighter / eraser |
| S | Open the shape picker |
| L / A / R / O | Line / arrow / rectangle / ellipse |
| T / F / I | Text / fill / color picker |
| `[` / `]` | Smaller / larger brush |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo, redo |
| Ctrl/Cmd+S | Download PNG |

## Run locally

Serve the folder (it uses ES modules, so opening `index.html` as a file won't work):

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

## How the design assistant works

The assistant is a Claude agent (Claude Opus 5.5 by default, Sonnet 5.5 optional) that runs in your browser with **your own Anthropic API key**. Add the key in the assistant's settings; it goes straight from the browser to the Anthropic API and is never sent anywhere else. Usage is billed to your Anthropic account.

- It has two tools of its own: `update_diagram`, which edits the architecture on the board, and `ask_user`, which shows the clickable next-step choices
- It uses Anthropic's server-side web search and web fetch tools for current information (turn this off in settings if web search isn't enabled for your organization)
- A diagram is a single board item, so each revision is one undo step and it syncs to everyone on a live board. The assistant sees your changes, including undo, on its next turn
- The conversation lives in your tab only; collaborators see the diagram but not your chat

Keep in mind:

- Don't save your key on a shared computer ("Remember the key" stores it in this browser's localStorage)
- To offer the assistant to visitors without their own key, put a small proxy that holds your key in front of the API (for example a Cloudflare Worker), with rate limits, since every request costs you money

## How live collaboration works

Browsers connect directly to each other over WebRTC using [Trystero](https://github.com/dmotz/trystero).
Public Nostr relays are only used so peers can find each other; drawing data goes straight between browsers.
There's no server to run, so the app stays a static site.

Every drawing action is a small operation (stroke, shape, text, fill, image, clear) in a shared log.
Peers order the log the same way (Lamport clock, then op id), so every board ends up identical.
When someone joins, peers exchange their full logs and merge them.

Limitations:

- A board only lives in the browsers of people who have opened it. If everyone leaves, the next visitor sees whatever their own browser saved.
- Some strict networks (certain corporate or mobile networks) block direct peer connections. Fixing that needs a TURN relay server.
- Anyone with the link can join and draw, so share it only with people you trust.

## Project layout

```
index.html   page structure and dialogs
styles.css   layout and theme
app.js       drawing engine, operation log, tools, UI wiring
collab.js    joining, presence, live cursors and syncing
diagram.js   architecture diagrams: components, templates, layout and drawing
assistant.js the AI design assistant: chat panel, agent loop and tools
favicon.svg  app icon
```
