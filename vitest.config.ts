import { defineConfig } from 'vitest/config'
import path from 'path'

// Tests unitaires : logique pure (aucun accès à la base ni au réseau)
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
})
