/**
 * src/test/setup.ts
 * Configuración global de Vitest — se ejecuta antes de cada archivo de test.
 */
 
// @testing-library/react configura automáticamente el entorno de test.
// No necesita importación explícita — vitest + jsdom lo resuelve.
 
// Necesario para React 19 — suprime warnings de act() en tests unitarios
// @ts-expect-error — IS_REACT_ACT_ENVIRONMENT no está en el tipo de globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;