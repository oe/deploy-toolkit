import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Give require consumers an entirely CommonJS declaration graph under NodeNext.
async function copyDeclarations(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) await copyDeclarations(filename)
    else if (entry.name.endsWith('.d.ts')) {
      const source = await readFile(filename, 'utf8')
      const commonjs = source.replace(/(from\s+['"])(\.[^'"]+)\.js(['"])/g, '$1$2.cjs$3')
      await writeFile(filename.replace(/\.d\.ts$/, '.d.cts'), commonjs)
    }
  }
}

await copyDeclarations('dist')
