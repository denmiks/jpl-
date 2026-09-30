JPL Folder.io
=============
Files
-----
index.html    the page structure (what is on the screen)
style.css     colors, folder look, animations, layout
app.js        everything that happens: folders, polaroid spread, weekly/monthly/yearly,
              photobooth (camera, 4 cuts, frame colors, stickers), download
supabase.sql  run once in Supabase to create the shared tables + photo bucket

Where to change things
----------------------
- New button or text:     index.html
- New color or animation: style.css  (colors are at the top, in :root)
- New feature:            app.js  (sections are labeled with /* comments */)
- Supabase URL / key:     the SB object at the very top of app.js
- Sticker list:           the STK array in app.js
- Frame colors:           the COLORS array in app.js

Sharing photos between people (Supabase)
----------------------------------------
Until you fill in SB, everything is stored in the browser on that one device.
To make it shared, so that anyone who opens the site sees everyone else's photos:

1. Create a free project at https://supabase.com (no card needed)
2. Open SQL Editor (left sidebar, near the top), New query, paste in supabase.sql, Run
3. Settings -> API Keys -> copy the Project URL and the publishable key
   (it starts sb_publishable_. If you only see the old "anon" key, that one works too)
4. In app.js, edit the first line to look like:

     const SB={url:'https://YOURPROJECT.supabase.co',key:'sb_publishable_...',bucket:'photos'};

5. Reload the page. The first time it loads, anything already on this device is
   pushed up to the shared wall, once.

Check it worked: Table Editor should list folders and photos, and Storage ->
Buckets should list a public bucket named "photos". If the gallery says
"Shared library could not load" then the URL or key is wrong, or supabase.sql
was not run.

Notes
-----
- Everyone can upload, edit and delete. There is no login, so be aware that
  anyone who has the link can remove photos. To lock that down, add a password
  or a login step and tighten the policies in supabase.sql.
- Photos are resized to 1200px on the long side before upload, so large phone
  photos do not fill the free storage.
- Free tier is about 1 GB of photos with generous bandwidth. That is thousands
  of phone photos, but delete the odd folder if you get near it.

How to open
-----------
Double-click index.html, or run:  python3 -m http.server
in this folder and open http://localhost:8000
If the camera is blocked, use "Upload photos".

"Download strip" saves a PNG in any browser. VS Code's Simple Browser blocks
downloads, so test that one in a real browser window.
