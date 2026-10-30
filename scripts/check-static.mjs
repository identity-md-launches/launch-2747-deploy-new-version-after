import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'dist');
const html=await readFile(resolve(dist,'index.html'),'utf8');
assert.match(html,/<title>Wheelkeepers[^<]+<\/title>/);
for(const marker of ['name="description"','property="og:title"','property="og:image"','rel="icon"'])assert.ok(html.includes(marker),`Missing ${marker}`);
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const name=resolve(dir,entry.name);if(entry.isDirectory())await walk(name);else files.push(name);}}
await walk(dist);
assert.ok(!files.some(f=>/(?:node_modules|\.map$|\.tgz$|\.env(?:\.|$))/.test(f)),'Unexpected packaging artifact in dist');
let references=0;
async function asset(url,from){
  if(/^(?:data:|https?:|#)/.test(url))return;
  assert.ok(!url.startsWith('/'),`Absolute local asset URL: ${url}`);
  const file=resolve(dirname(from),decodeURIComponent(url.split(/[?#]/)[0]));
  assert.ok(file.startsWith(dist+sep),`Asset escapes export: ${url}`);
  assert.ok((await stat(file)).isFile(),`Missing asset: ${url}`);references++;
}
for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))await asset(m[1],resolve(dist,'index.html'));
await asset(html.match(/property="og:image" content="([^"]+)"/)[1],resolve(dist,'index.html'));
for(const f of files.filter(f=>f.endsWith('.css'))){const css=await readFile(f,'utf8');for(const m of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g))await asset(m[1],f);}
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const changed=git(['diff','--name-only','--diff-filter=AM','-z']);
const modified=git(['diff','--name-only','-z']);
const added=git(['ls-files','--others','--exclude-standard','-z']);
const prohibited=['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb','foundry.toml','foundry.lock','remappings.txt','.gitmodules','.gitignore','vite.config.ts','next.config.ts','tsconfig.json','postcss.config.mjs','drizzle.config.ts','eslint.config.mjs','wrangler.local.jsonc'];
for(const name of modified)assert.ok(!prohibited.includes(name)&&!name.startsWith('lib/'),`Protected existing path changed: ${name}`);
const submitted=[...new Set([...changed,...added])].filter(f=>!f.startsWith('test/scratch/')&&!f.startsWith('.imd/'));
for(const name of submitted)assert.ok(!name.split('/').some(p=>['.git','.github','node_modules'].includes(p)||p.startsWith('.env')),`Forbidden path: ${name}`);
let bytes=0;for(const f of submitted)bytes+=(await stat(resolve(root,f))).size;
assert.ok(bytes<=8388608,`Submission additions exceed 8 MiB: ${bytes}`);
let exportBytes=0;for(const f of files)exportBytes+=(await stat(f)).size;
console.log(JSON.stringify({passed:true,exportFiles:files.length,relativeAssetReferences:references,exportBytes,submissionFiles:submitted.length,submissionBytes:bytes,limitBytes:8388608,protectedPathsUnchanged:true},null,2));
