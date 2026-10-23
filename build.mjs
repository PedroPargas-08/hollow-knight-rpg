// Build mínimo com esbuild: gera dist/index.html + dist/assets/app.{js,css}.
// Uso: `node build.mjs` (produção) ou `node build.mjs --serve` (desenvolvimento).
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const serve = process.argv.includes('--serve');
const port = Number(process.env.PORT ?? 5173);

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });

const options = {
  entryPoints: { app: 'src/main.tsx' },
  bundle: true,
  outdir: 'dist/assets',
  format: 'esm',
  jsx: 'automatic',
  target: 'es2020',
  minify: !serve,
  sourcemap: serve,
  define: { 'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production') },
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const server = await ctx.serve({ servedir: 'dist', port });
  console.log(`Valdrim (dev) em http://localhost:${server.port}`);
} else {
  const result = await esbuild.build({ ...options, metafile: true });
  const out = Object.entries(result.metafile.outputs).map(([f, m]) => `${f} ${(m.bytes / 1024).toFixed(1)} KB`);
  console.log('Build concluído:\n  ' + out.join('\n  '));
}
