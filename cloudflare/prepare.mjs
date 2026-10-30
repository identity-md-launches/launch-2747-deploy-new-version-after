// Standalone Cloudflare package. No API token, paid service or ChatGPT sign-in.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'outputs','cloudflare');
const args=process.argv.slice(2);
const arg=(name)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const domain=arg('--domain')?.toLowerCase();
if(domain&&!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))throw new Error('Use an exact domain hostname without a scheme, path or wildcard.');
const origin=arg('--preview-url')||'http://127.0.0.1:8789';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Use the local built production preview.');
const response=await fetch(origin,{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error(`Production preview returned ${response.status}.`);
const html=await response.text();
if(!html.includes('Wheelkeepers')||html.includes('@vite/client'))throw new Error('Build and start the production preview first.');
const original=JSON.parse(await fs.readFile(path.join(root,'dist/server/wrangler.json'),'utf8'));
await fs.mkdir(out,{recursive:true});
await fs.cp(path.join(root,'dist/server'),path.join(out,'server'),{recursive:true});
await fs.cp(path.join(root,'dist/client'),path.join(out,'client'),{recursive:true});
await fs.cp(path.join(root,'drizzle'),path.join(out,'migrations'),{recursive:true});
await fs.writeFile(path.join(out,'client/index.html'),html);
const config={...original,name:'squeek-wheelkeepers',main:'./server/index.js',workers_dev:!domain,
  assets:{directory:'./client',binding:'ASSETS',run_worker_first:['/api/*']},
  d1_databases:[{binding:'DB',database_name:'wheelkeepers-leaderboard',database_id:arg('--database-id')||original.d1_databases[0].database_id,migrations_dir:'./migrations'}]};
delete config.topLevelName;
delete config.routes;
if(domain)config.routes=[{pattern:domain,custom_domain:true}];
if(arg('--account-id'))config.account_id=arg('--account-id');
await fs.writeFile(path.join(out,'wrangler.json'),JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({directory:out,staticShell:true,apiRoutes:'/api/*',domain:domain||null,databaseConfigured:!!arg('--database-id')}));
