/**
 * Tailwind 3.4.x — NO migrar a v4 (reglas Nexora: incompatibilidad InsForge MCP + @layer vs tokens --mc-*).
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
