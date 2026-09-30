Our Photo Folders
=================
Files
-----
index.html  the page structure (what is on the screen)
style.css   colors, folder look, animations, layout
app.js      everything that happens: folders, polaroid spread, weekly/monthly/yearly,
            photobooth (camera, 4 cuts, frame colors, stickers), download

Where to change things
----------------------
- New button or text:     index.html
- New color or animation: style.css  (colors are at the top, in :root)
- New feature:            app.js  (sections are labeled with /* comments */)
- Sticker list:           the STK array in app.js
- Frame colors:           the COLORS array in app.js

How to open
-----------
Double-click index.html. Photos are saved in your browser on that device only.
If the camera is blocked, use "Upload photos", or run:  python3 -m http.server
in this folder and open http://localhost:8000

"Download strip" works on the claude.ai page. In your own copy it will tell you
to press and hold (or right-click) the strip to save it.
