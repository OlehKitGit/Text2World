**Text2World** — Interactive Visual-Sound Cinema

**Text2World** is an open-source tool and format for creating non-linear interactive films, visual novels, art installations, and storytelling experiences where the viewer navigates between image-based scenes by clicking on interactive regions (ROIs), while being fully immersed thanks to background music that changes with every frame.

This is **cinema that you control with a single click**.

Live viewer example: http://108.175.8.222/ 

## Two versions — two purposes

The project is deliberately split into two independent builds:

| Folder      | Purpose                          | Capabilities                                    |
|-------------|----------------------------------|--------------------------------------------------|
| `/editor`   | Full-featured editor (creator)   | Draw, move, resize ROIs • add music • create links |
| `/viewer`   | Clean read-only version          | Nothing can be broken — only watch and click     |

**Use `/viewer/index.html` as the public link** — it starts in locked mode by default (editing is impossible).

## How to run

### Locally (development & editing)

```bash
git clone https://github.com/OlehKitGit/Text2World.git
cd Text2World

# Editor mode (draggable/resizable ROIs)
cd editor
node ../server.js
# → open http://localhost:3001

# Viewer mode (final film)
# simply open viewer/index.html in any browser
```

On a server (VPS, Railway, Render, Fly.io, etc.)

git clone https://github.com/OlehKitGit/Text2World.git
cd Text2World
node server.js

Images & music → uploaded to uploads/
Database (regions, links, music bindings) → data/database.json
Static files available at /uploads

Features

1. Each scene = image + optional looping MP3 soundtrack
2. Clickable regions with smooth navigation
3. Music changes automatically on every transition
4. Fully responsive on phones, tablets, and desktops
5. Works offline after first load
6. No heavy frameworks — pure vanilla JS + minimal jQuery UI (only in editor)

How to create your own interactive film

1. Open the editor: http://localhost:3001
2. Upload images (optionally attach music to each)
3. Draw interactive regions
4. Link them to other images
5. Press Lock Editing (or just close the editor)
6. Open /viewer/index.html — your film is ready to share

License
MIT License — do anything you want with the code:

Use it for personal or commercial projects
Create and sell interactive films
Fork, improve, redistribute

Made with love by @OlehKitGit
For everyone who believes stories can be more than linear.
Text2World is not just an application.
It’s the future of interactive visual storytelling.
One click at a time.













FolderPurposeWhat you can do/editorFull editor (for the creator)Draw, move, resize ROIs, add music & links/viewerClean read-only versionNothing can be broken — only watch & click
Use /viewer/index.html as the public link — it starts in locked mode by default (no editing possible).
