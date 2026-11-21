#!/usr/bin/env node
// CLI entrypoint for Pre-Results Radar Engine

import { RadarEngine } from '../src/engine.js';

const args = process.argv.slice(2);
const timeArgIdx = args.indexOf('--time');
const formatArgIdx = args.indexOf('--format');
const time = timeArgIdx !== -1 ? args[timeArgIdx + 1] : '08:00';
const format = formatArgIdx !== -1 ? args[formatArgIdx + 1] : null;

const engine = new RadarEngine();
engine.seedInitialData();

console.log(`\n=======================================================`);
console.log(`  PRE-RESULTS RADAR ENGINE (NSE/BSE MAIN BOARD)`);
console.log(`  Daily Automated Pipeline - Run Type: ${time} IST`);
console.log(`=======================================================\n`);

const radar = engine.generateRadar(time);

if (format === 'whatsapp') {
  console.log(engine.formatWhatsAppText(radar));
} else if (format === 'markdown') {
  console.log(engine.formatMarkdown(radar));
} else {
  console.log(`[Status] Run completed successfully.`);
  console.log(`Last Updated: ${radar.meta.last_updated}`);
  console.log(`Verified on:  ${radar.meta.verified_on}\n`);
  console.log(`Category A (Very Positive):       ${radar.categories.A.length} names`);
  console.log(`Category B (Decent Positive):     ${radar.categories.B.length} names`);
  console.log(`Category C (Tomorrow):            ${radar.categories.C.length} names`);
  console.log(`Category D (Turnaround · Risky):  ${radar.categories.D.length} names`);
  console.log(`Exclusions Cataloged:             ${radar.exclusions.length} names`);
  console.log(`Changes Logged:                   ${radar.changes_since_yesterday.length} items`);
  console.log(`\nArtifacts updated in brain directory.`);
}
