// A static entry for the existing React game; the Worker build stays configured as before.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readdir, rm } from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const toolchain = resolve(option('--toolchain') || root);
const require = createRequire(resolve(toolchain, 'package.json'));
const { build } = await import(require.resolve('vite'));
const dependencies = ['react', 'react-dom', 'lucide-react'];
const aliases = dependencies.map(name => ({ find: name, replacement: resolve(toolchain, 'node_modules', name) }));
await access(resolve(root, 'public/share.png'));
await build({
  configFile: false,
  root: resolve(root, 'web'), publicDir: resolve(root, 'public'), base: './',
  resolve: { alias: [{ find: '@', replacement: root }, ...aliases], dedupe: dependencies },
  define: { 'process.env.NODE_ENV': '"production"', '__WHEELKEEPERS_STATIC__': 'true' },
  css: { postcss: { plugins: [] } },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true, sourcemap: false, target: 'es2022' },
});
// Vite emits the referenced fonts with content hashes. Keep their licenses,
// and remove the redundant public copies from the finished upload.
for (const name of await readdir(resolve(root, 'dist/fonts'))) {
  if (name.endsWith('.woff2')) await rm(resolve(root, 'dist/fonts', name));
}
console.log('Static export ready in dist/. All runtime assets are local; live features use the existing public API.');
