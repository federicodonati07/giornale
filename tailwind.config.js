// tailwind.config.js
const {heroui} = require("@heroui/theme");
const { defaultTheme, fontFamily } = require('tailwindcss');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./node_modules/@heroui/theme/dist/components/(button|card|ripple|spinner).js"
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--font-merriweather)', ...defaultTheme.fontFamily.serif],
        montserrat: ['var(--font-montserrat)', ...fontFamily.sans],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};