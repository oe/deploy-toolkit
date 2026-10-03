import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

const externalPackages = Object.keys(pkg.dependencies)

export default defineConfig({
  build: {
    target: 'node20',
    sourcemap: true,
    minify: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        utils: 'src/utils.ts',
        'ssh/index': 'src/ssh/index.ts',
        'ssh/cmd': 'src/ssh/cmd.ts',
        'ssh/download': 'src/ssh/download.ts',
        'ssh/upload': 'src/ssh/upload.ts',
        'ssh/script': 'src/ssh/script.ts',
        'ssh/sshexec': 'src/ssh/sshexec.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rolldownOptions: {
      output: { exports: 'named' },
      external: id => id.startsWith('node:') || builtinModules.includes(id) ||
        externalPackages.some(name => id === name || id.startsWith(`${name}/`)),
    },
  },
})
