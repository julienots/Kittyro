// Validates game/models/: file names, glTF binary headers, sizes and JSON files.
// Usage: node tools/check-models.mjs   (exit code 1 on problems)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const root = new URL('../models/', import.meta.url).pathname;
const MAX = 15 * 1024 * 1024;
const problems = [];
const found = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const ext = extname(f).toLowerCase();
    const rel = p.slice(root.length);
    if (f === '.gitkeep' || f.toLowerCase() === 'readme.md') continue;
    if (ext === '.json') {
      try { JSON.parse(readFileSync(p, 'utf8')); } catch (e) { problems.push(`${rel}: JSON invalide (${e.message})`); }
      continue;
    }
    if (ext === '.gltf' || ext === '.fbx' || ext === '.obj' || ext === '.blend') { problems.push(`${rel}: format non pris en charge, exportez en .glb (glTF binaire)`); continue; }
    if (ext !== '.glb') { problems.push(`${rel}: fichier inattendu (seuls .glb et .json sont lus)`); continue; }
    const name = basename(f, ext);
    if (!/^[a-z0-9_]+$/.test(name)) problems.push(`${rel}: nom invalide — minuscules, chiffres et _ uniquement (ex. tree_oak.glb)`);
    const size = statSync(p).size;
    if (size > MAX) problems.push(`${rel}: trop lourd (${(size / 1048576).toFixed(1)} Mo > 15 Mo)`);
    const head = readFileSync(p).subarray(0, 4).toString('latin1');
    if (head !== 'glTF') problems.push(`${rel}: ce n'est pas un .glb valide (en-tête "${head}")`);
    if (!rel.startsWith('override/') && !rel.startsWith('world/') && !rel.startsWith('character/')) problems.push(`${rel}: placez-le dans models/override/, models/world/ ou models/character/`);
    if (rel.startsWith('character/') && name !== 'player') problems.push(`${rel}: le personnage doit s'appeler character/player.glb`);
    if (rel.startsWith('character/') && !readFileSync(p).includes('"skins"')) problems.push(`${rel}: ce modèle n'est pas riggé (pas de squelette) — utilisez « Rig » dans Tripo avant l'export`);
    found.push(`${rel} (${(size / 1024).toFixed(0)} Ko)`);
  }
};
if (existsSync(root)) walk(root);
const placements = existsSync(join(root, 'placements.json')) ? JSON.parse(readFileSync(join(root, 'placements.json'), 'utf8')) : [];
for (const pl of Array.isArray(placements) ? placements : placements.placements ?? []) {
  if (!existsSync(join(root, 'world', `${pl.model}.glb`))) problems.push(`placements.json: le modèle "${pl.model}" n'existe pas dans models/world/`);
  if (!Number.isFinite(pl.x) || !Number.isFinite(pl.z) || typeof pl.region !== 'string') problems.push(`placements.json: entrée incomplète ${JSON.stringify(pl)} (model, region, x, z requis)`);
}
console.log(`Modèles trouvés (${found.length}):\n  ${found.join('\n  ') || '(aucun)'}`);
if (problems.length) {
  console.error(`\n${problems.length} problème(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nTout est bon ✔');
