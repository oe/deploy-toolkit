import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

const externalPackages = Object.keys(pkg.dependencies)

export default defineConfig({
  build: {
    target: 'node22',
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: format => format === 'es' ? 'index.js' : 'index.cjs',
    },
    rolldownOptions: {
      external: id => id.startsWith('node:') || builtinModules.includes(id) ||
        externalPackages.some(name => id === name || id.startsWith(`${name}/`)),
    },
  },
})
