import {
  gpsUsable,
  project,
  distance,
  angle,
  maneuverProgress,
  upcomingEnforcement,
  indexEnforcement,
  miles,
} from './model.js';

/** Foreground navigation state, independent of GPS and rendering for deterministic replay. */
export class NavigationSession {
  constructor({
    onUpdate = () => {},
    onSpeak = () => {},
    onReroute = () => {},
    now = () => Date.now(),
  } = {}) {
    Object.assign(this, { onUpdate, onSpeak, onReroute, now });
    this.active = false;
  }
  start(route, records = [], replay = false) {
    this.active = true;
    this.route = route;
    this.records = records;
    this.replay = replay;
    this.index = indexEnforcement(records, route);
    this.hintM = null;
    this.offRouteSince = null;
    this.lastReroute = -Infinity;
    this.spoken = new Set();
    this.alerted = new Set();
    this.lastFix = null;
  }
  setRoute(route) {
    this.route = route;
    this.hintM = null;
    this.offRouteSince = null;
    this.spoken.clear();
    this.index = indexEnforcement(this.records, route);
  }
  setRecords(records) {
    this.records = records;
    if (this.route) this.index = indexEnforcement(records, this.route);
  }
  stop() {
    this.active = false;
  }
  tick() {
    if (this.active && this.lastFix && !gpsUsable(this.lastFix, this.now()))
      this.onUpdate({
        state: 'gps-lost',
        message: 'GPS is stale. Guidance and alerts paused.',
      });
  }
  update(fix) {
    if (!this.active) return;
    this.lastFix = fix;
    if (!gpsUsable(fix, this.now())) {
      this.onUpdate({
        state: 'gps-lost',
        message: 'Waiting for an accurate GPS fix (50 m or better).',
      });
      return;
    }
    const m = project(fix.point, this.route.geometry, { hintM: this.hintM });
    const headingWrong =
      Number.isFinite(fix.heading) &&
      fix.speed > 3 &&
      m &&
      angle(fix.heading, m.bearing) > 85;
    if (!m || m.crossM > Math.max(35, fix.accuracy) || headingWrong) {
      this.offRouteSince ??= this.now();
      this.onUpdate({
        state: 'off-route',
        message: 'Off route. Checking your position…',
        fix,
      });
      if (
        !this.replay &&
        this.now() - this.offRouteSince >= 4000 &&
        this.now() - this.lastReroute >= 20000
      ) {
        this.lastReroute = this.now();
        this.onReroute(fix.point);
      }
      return;
    }
    this.offRouteSince = null;
    this.hintM = m.offsetM;
    const remainingM = Math.max(0, m.totalM - m.offsetM);
    if (
      remainingM < 35 &&
      distance(fix.point, this.route.geometry.at(-1)) < 40 &&
      !this.route.stepsTruncated
    ) {
      this.active = false;
      this.onSpeak('You have arrived at your destination.');
      this.onUpdate({ state: 'arrived', fix, matched: m });
      return;
    }
    const maneuver = maneuverProgress(this.route, m);
    const stage =
      maneuver.distanceM <= 60
        ? 'now'
        : maneuver.distanceM <= 250
          ? 'near'
          : maneuver.distanceM <= 800
            ? 'ahead'
            : null;
    const key = `${maneuver.index}:${stage}`;
    if (stage && !this.spoken.has(key) && maneuver.step) {
      this.spoken.add(key);
      this.onSpeak(
        `${stage === 'now' ? 'Now' : `In ${miles(maneuver.distanceM)}`}, ${maneuver.step.instruction}`,
      );
    }
    const alerts = upcomingEnforcement(
      this.records,
      this.route,
      m,
      this.now(),
      this.index,
    );
    const upcoming = alerts[0] || null;
    if (upcoming && !this.alerted.has(upcoming.record.id)) {
      this.alerted.add(upcoming.record.id);
      this.onSpeak(
        `${upcoming.record.type === 'work-zone' ? 'Potential work-zone enforcement area' : 'Mapped enforcement camera'} ahead in ${miles(upcoming.distanceM)}. Follow posted signs.`,
      );
    }
    this.onUpdate({
      state: 'driving',
      fix,
      matched: m,
      maneuver,
      remainingM,
      remainingS: (this.route.durationS * remainingM) / Math.max(1, m.totalM),
      upcoming,
    });
  }
}
