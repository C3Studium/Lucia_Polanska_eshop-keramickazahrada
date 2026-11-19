module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    /* Zálohy pro starší Safari (dvh/svh, inset, overflow: clip) — viz soubor. */
    "./postcss-stare-safari.js": {},
  },
}
