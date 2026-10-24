// Build com esbuild: dist/index.html + dist/assets/app.{js,css}.
// Uso: `node build.mjs` (produção) · `node build.mjs --serve` (dev) · FAKE_SUPABASE=1 (somente testes de interface).
// Variáveis PÚBLICAS lidas de process.env ou de .env.local: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.
// NUNCA coloque a chave service_role aqui: tudo que entra neste bundle é público.
import * as esbuild from 'esbuild';
import { cp, mkdir, rm, readFile } from 'node:fs/promises';

const serve = process.argv.includes('--serve');
const fake = process.env.FAKE_SUPABASE === '1';
const port = Number(process.env.PORT ?? 5173);

async function loadEnvFile(file) {
  try {
    const out = {};
    for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    return out;
  } catch { return {}; }
}
const file = await loadEnvFile('.env.local');
const env = (k) => process.env[k] ?? file[k] ?? '';
if (env('SUPABASE_SERVICE_ROLE_KEY') || file.SUPABASE_SERVICE_ROLE_KEY) console.warn('Aviso: service_role NÃO é usada pelo frontend e não será incluída no bundle.');

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });

const options = {
  entryPoints: { app: 'src/main.tsx' }, bundle: true, outdir: 'dist/assets', format: 'esm', jsx: 'automatic', target: 'es2020',
  minify: !serve, sourcemap: serve, logLevel: 'info',
  alias: fake ? { '@supabase/supabase-js': './tests/fakes/supabase-js.ts' } : {},
  define: {
    'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production'),
    'process.env.SUPABASE_URL': JSON.stringify(fake ? 'https://fake.supabase.test' : env('SUPABASE_URL')),
    'process.env.SUPABASE_PUBLISHABLE_KEY': JSON.stringify(fake ? 'fake-publishable-key' : env('SUPABASE_PUBLISHABLE_KEY')),
  },
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const server = await ctx.serve({ servedir: 'dist', port });
  console.log(`Valdrim (dev) em http://localhost:${server.port}`);
} else {
  const result = await esbuild.build({ ...options, metafile: true });
  console.log('Build concluído' + (fake ? ' (CLIENTE FALSO — só para testes)' : '') + ':\n  ' + Object.entries(result.metafile.outputs).map(([f, m]) => `${f} ${(m.bytes / 1024).toFixed(1)} KB`).join('\n  '));
}
