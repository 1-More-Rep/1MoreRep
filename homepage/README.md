# 1MoreRep — Homepage (`1morerep.de`)

A standalone, **frontend-only** marketing landing page for 1MoreRep. No build step, no
backend, no dependencies — it's plain HTML/CSS/JS. Just host this folder.

The web app itself is separate and lives at **app.1morerep.de**; every call-to-action
here links there.

## Contents

```
homepage/
├── index.html            # the page
├── styles.css            # all styling (design system + sections)
├── main.js               # tiny vanilla JS (scroll reveal, mobile menu, etc.)
├── favicon.svg           # lightning mark (matches the app icon)
├── icon-192.png          # apple-touch-icon (reused from the app)
├── icon-512.png          # icon
├── og.png                # social share image (replace with a real 1200×630 if you like)
├── robots.txt
├── sitemap.xml
└── nginx.conf.example    # ready-to-use static server block for 1morerep.de
```

## Preview locally

It's static — open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080 --directory homepage
# then open http://localhost:8080
```

## Deploy with nginx

1. Copy the folder's contents to the server, e.g. `/var/www/1morerep`.
2. Point a TLS cert at `1morerep.de` (e.g. `certbot --nginx -d 1morerep.de -d www.1morerep.de`).
3. Use `nginx.conf.example` as the server block (adjust `root` and cert paths), then:

```bash
nginx -t && systemctl reload nginx
```

That's it — `1morerep.de` serves the homepage; `app.1morerep.de` serves the app.

## Customising

- **Brand color** lives in `:root { --brand: … }` in `styles.css` (currently `#e2553a`,
  matching the app's `themeColor`).
- **Copy/links**: edit `index.html`. All app links use `https://app.1morerep.de`.
- **Social image**: `og.png` is the app icon as a placeholder — swap in a 1200×630 image
  for nicer link previews.
