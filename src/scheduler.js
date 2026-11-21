// Pre-Results Radar Automated Scheduler (IST Daily Jobs)
// 07:45 IST -> Build C + prune all already-reported names
// 08:00 IST -> Full refresh of A/B/D + One-week overview by day + Changes + Exclusions + Dashboard link

import { RadarEngine } from './engine.js';

export class RadarScheduler {
  constructor(engine) {
    this.engine = engine;
    this.intervalId = null;
  }

  start() {
    console.log('[Scheduler] Daily IST schedule monitoring initialized.');
    console.log('[Scheduler] Targets: 07:45 IST (Build C + Prune) & 08:00 IST (Full Refresh).');

    // Check time every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkAndTrigger();
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkAndTrigger() {
    const now = new Date();
    const istTimeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    const [hour, minute] = istTimeStr.split(':').map(Number);

    // 07:45 IST Trigger
    if (hour === 7 && minute === 45) {
      console.log('[Scheduler] 07:45 IST Triggered: Building Category C and pruning reported names...');
      this.engine.generateRadar('07:45');
    }

    // 08:00 IST Trigger
    if (hour === 8 && minute === 0) {
      console.log('[Scheduler] 08:00 IST Triggered: Executing Full Refresh of A/B/D, Overview, Changes & Exclusions...');
      this.engine.generateRadar('08:00');
    }
  }
}
