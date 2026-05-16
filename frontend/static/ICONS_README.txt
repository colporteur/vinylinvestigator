PWA icons needed: icon-192.png (192x192) and icon-512.png (512x512).

For v1 you can generate them quickly from the favicon.svg using any of:

  - https://realfavicongenerator.net (drop in favicon.svg, download the PNGs)
  - https://www.pwabuilder.com/imageGenerator
  - macOS: `sips -s format png -z 192 192 favicon.svg --out icon-192.png` (requires librsvg)
  - ImageMagick: `convert -density 1024 -resize 192x192 favicon.svg icon-192.png`

Place both PNG files in this same /static/ directory. The PWA install prompt
will not appear without them.
