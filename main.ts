// Entry program for the makefun-frontend-01 bounty (Node 22, standard library only).
//
// What it does, and all it does: take the static frontend in app/ and the three
// screenshots in screenshots/, copy both into the output directory, and write
// the judge's dossier next to them with buildDossier from the vendored
// make.fun library. The library file under vendor/ is the kit's own copy and
// must stay untouched — the scorer rebuilds the dossier with its copy and
// compares the two byte for byte, so any drift fails the entry.
//
// The grader runs this twice in a sandbox with no network and expects both
// runs to produce identical bytes; copying files and serialising the dossier
// are both deterministic, so that holds. Locally, MAKEFUN_OUTPUT_DIR points
// the output somewhere writable instead of /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });

const shotsDir = join(outputDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const localShots = join(repoDir, 'screenshots');
if (existsSync(localShots)) {
  cpSync(localShots, shotsDir, { recursive: true });
}

// The caps below mirror the gate's own limits, so an oversized entry fails
// here with the scorer's wording instead of silently producing a dossier
// the scorer would refuse: at most 3 screenshots of 256 KiB each, at most
// 993 files and 16 MiB under app/, and dossier text capped at 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
