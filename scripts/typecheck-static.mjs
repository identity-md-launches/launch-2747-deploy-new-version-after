import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const i = args.indexOf('--toolchain');
const toolchain = resolve(i < 0 ? root : args[i + 1]);
const require = createRequire(resolve(toolchain, 'package.json'));
const ts = require('typescript');
const modules = resolve(toolchain, 'node_modules');
const config = ts.parseJsonConfigFileContent({
  compilerOptions: {
    target: 'ES2022', lib: ['DOM', 'DOM.Iterable', 'ES2022'], strict: true,
    module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', noEmit: true,
    skipLibCheck: true, esModuleInterop: true, types: ['node'],
    typeRoots: [resolve(modules, '@types')],
    paths: { '@/*': [resolve(root, '*')], 'react': [resolve(modules, '@types/react')],
      'react/*': [resolve(modules, '@types/react/*')], 'react-dom/*': [resolve(modules, '@types/react-dom/*')],
      'lucide-react': [resolve(modules, 'lucide-react')] },
  },
  files: [resolve(root, 'web/main.tsx')],
}, ts.sys, root);
const program = ts.createProgram(config.fileNames, config.options);
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: x => x, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else console.log('Static frontend typecheck passed (strict, noEmit; React entry and all transitive game modules).');
