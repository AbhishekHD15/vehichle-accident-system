#include "accident_fsm.h"
#include "config.h"
#include "event_store.h"
#include "secrets.h"
#include <math.h>

SystemStatus g_status;

static float angleDeg(const float a[3], const float b[3]) {
  float da = sqrtf(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]), db = sqrtf(b[0]*b[0] + b[1]*b[1] + b[2]*b[2]);
  if (da < 0.01f || db < 0.01f) return 0;
  float c = (a[0]*b[0] + a[1]*b[1] + a[2]*b[2]) / (da * db);
  c = fmaxf(-1.f, fminf(1.f, c));
  return acosf(c) * 57.29578f;
}

void AccidentFsm::resetBaseline(const ImuSample& s) { gvec_[0] = s.ax; gvec_[1] = s.ay; gvec_[2] = s.az; }

void AccidentFsm::startCountdown(uint32_t now, bool buttonDown) {
  st_ = FSM_COUNTDOWN; cdStart_ = now; buzz_ = BUZ_COUNTDOWN;
  armed_ = !buttonDown;            // a button already held at trigger time can never cancel/confirm anything
  cancelRequested_ = false;
  snprintf(id_, sizeof(id_), "ACC-%s-%06lu", DEVICE_ID, (unsigned long)store.nextCounter());  // unique, persistent counter
  strncpy(g_status.accidentId, id_, sizeof(g_status.accidentId) - 1);
}

void AccidentFsm::finish(bool cancelled, GpsMgr& gps, uint32_t now) {
  EventRec r; memset(&r, 0, sizeof(r));
  strncpy(r.id, id_, sizeof(r.id) - 1);
  r.peakG = peakG_; r.gx = pgx_; r.gy = pgy_; r.gz = pgz_;
  GpsSnapshot g = gps.snapshot();
  r.gpsValid = g.valid; r.lat = g.valid ? (float)g.lat : 0; r.lon = g.valid ? (float)g.lon : 0;
  strncpy(r.dateIso, g.iso, sizeof(r.dateIso) - 1);
  if (cancelled) {
    r.state = ST_CANCELLED;           // NO SMS, NO CALL: only a cloud record of the cancellation
    g_status.lastResult = 1; buzz_ = BUZ_CANCELLED;
  } else {
    r.state = ST_DISPATCHED;
    int n = 0;
    auto add = [&](const char* ph, uint8_t recip, uint8_t type) {
      if (n >= MAX_SLOTS) return;
      NotifSlot& s = r.slots[n++]; strncpy(s.phone, ph, sizeof(s.phone) - 1);
      s.recip = recip; s.type = type; s.status = DS_PENDING; s.mr = -1;
    };
    for (int i = 0; i < FAMILY_COUNT && i < 3; i++) add(FAMILY_NUMBERS[i], RC_FAMILY, NT_SMS);
    add(INSURANCE_NUMBER, RC_INSURANCE, NT_SMS);                     // separate insurance message
    for (int i = 0; i < EMERGENCY_CALL_COUNT && i < 2; i++) add(EMERGENCY_CALL_NUMBERS[i], RC_EMERGENCY, NT_CALL);
    r.nSlots = n;
    g_status.lastResult = 2; buzz_ = BUZ_DISPATCHED;
  }
  store.add(r);                       // persisted to flash; the modem task takes over from here
  st_ = FSM_COOLDOWN; cooldownStart_ = now;
}

void AccidentFsm::update(const ImuSample& s, bool pressEdge, bool buttonDown, GpsMgr& gps, uint32_t now) {
  // --- orientation baseline: slow low-pass while monitoring ---
  if (st_ == FSM_MONITORING || st_ == FSM_COOLDOWN) {
    const float a = 0.005f;
    gvec_[0] += a * (s.ax - gvec_[0]); gvec_[1] += a * (s.ay - gvec_[1]); gvec_[2] += a * (s.az - gvec_[2]);
  }
  float jerk = 0;
  if (havePrev_ && s.t_us != prevT_) jerk = fabsf(s.mag - prevMag_) / ((s.t_us - prevT_) * 1e-6f);
  prevMag_ = s.mag; prevT_ = s.t_us; havePrev_ = true;
  float gyroMag = sqrtf(s.gx*s.gx + s.gy*s.gy + s.gz*s.gz);
  g_status.fsm = st_;

  switch (st_) {
    case FSM_COOLDOWN:
      if (now - cooldownStart_ > 3000 && buzz_ != BUZ_OFF) buzz_ = BUZ_OFF;
      if (now - cooldownStart_ >= COOLDOWN_MS) { st_ = FSM_MONITORING; g_status.accidentId[0] = 0; }
      break;

    case FSM_MONITORING:
      if (s.mag >= IMPACT_G) {                                   // possible impact: open a validation window
        st_ = FSM_VALIDATING; winStart_ = now;
        memcpy(preG_, gvec_, sizeof(preG_));
        peakG_ = s.mag; maxJerk_ = jerk; maxGyro_ = gyroMag; overCount_ = 1;
        pgx_ = fabsf(s.gx); pgy_ = fabsf(s.gy); pgz_ = fabsf(s.gz); recentN_ = 0; recent_[0] = recent_[1] = recent_[2] = 0;
      }
      break;

    case FSM_VALIDATING: {
      if (s.mag > peakG_) peakG_ = s.mag;
      if (s.mag >= IMPACT_G) overCount_++;
      maxJerk_ = fmaxf(maxJerk_, jerk); maxGyro_ = fmaxf(maxGyro_, gyroMag);
      pgx_ = fmaxf(pgx_, fabsf(s.gx)); pgy_ = fmaxf(pgy_, fabsf(s.gy)); pgz_ = fmaxf(pgz_, fabsf(s.gz));
      if (now - winStart_ > VALIDATION_MS - 80) {                // last 80 ms: average post-impact attitude
        recent_[0] += s.ax; recent_[1] += s.ay; recent_[2] += s.az; recentN_++;
      }
      if (now - winStart_ >= VALIDATION_MS) {
        float post[3] = {0, 0, 1};
        if (recentN_ > 0) for (int k = 0; k < 3; k++) post[k] = recent_[k] / recentN_;
        float tilt = angleDeg(preG_, post);
        int score = 2;                                           // base: peak exceeded IMPACT_G
        if (overCount_ >= MIN_IMPACT_SAMPLES) score++;           // sustained, not a 1-sample spike
        if (maxJerk_ >= JERK_G_PER_S) score++;                   // sudden change
        if (maxGyro_ >= GYRO_DPS_THRESHOLD) score++;             // violent rotation
        if (tilt >= ORIENT_CHANGE_DEG) score++;                  // vehicle attitude changed
        g_status.lastG = peakG_;
        if (score >= MIN_SCORE) { startCountdown(now, buttonDown); }
        else { st_ = FSM_MONITORING; }                           // rejected as false positive
      }
      break;
    }

    case FSM_COUNTDOWN: {
      uint32_t el = now - cdStart_;
      g_status.countdownSec = (int)((CANCEL_WINDOW_MS > el ? CANCEL_WINDOW_MS - el : 0) / 1000) + 1;
      if (!buttonDown) armed_ = true;                            // must be released first
      if (pressEdge && armed_ && el >= BUTTON_ARM_GUARD_MS) cancelRequested_ = true;   // "cancellation requested"
      if (cancelRequested_) { finish(true, gps, now); break; }   // -> "cancelled" (no SMS)
      if (el >= CANCEL_WINDOW_MS) { st_ = FSM_WAIT_GPS; gpsWaitStart_ = now; }
      break;
    }

    case FSM_WAIT_GPS: {
      // Alert is now committed: button presses are ignored (a dispatched alert is never silently cancelled).
      GpsSnapshot g = gps.snapshot();
      if (g.valid || now - gpsWaitStart_ >= GPS_FIX_TIMEOUT_MS) finish(false, gps, now);   // -> "emergency dispatched"
      break;
    }
  }
  g_status.fsm = st_;
}
