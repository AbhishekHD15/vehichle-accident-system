#pragma once
#include "imu.h"
#include "gps_mgr.h"
#include "status.h"

enum BuzzMode : uint8_t { BUZ_OFF, BUZ_COUNTDOWN, BUZ_CANCELLED, BUZ_DISPATCHED };

// Non-blocking accident state machine:
// MONITORING -> VALIDATING -> COUNTDOWN -> (cancel => COOLDOWN) | WAIT_GPS -> dispatch => COOLDOWN
// Distinct outcomes: detected, cancellation requested, cancelled, emergency dispatched.
class AccidentFsm {
 public:
  void update(const ImuSample& s, bool buttonPressedEdge, bool buttonDown, GpsMgr& gps, uint32_t nowMs);
  BuzzMode buzzer() const { return buzz_; }
 private:
  void startCountdown(uint32_t now, bool buttonDown);
  void finish(bool cancelled, GpsMgr& gps, uint32_t now);
  void resetBaseline(const ImuSample& s);

  FsmState st_ = FSM_MONITORING;
  BuzzMode buzz_ = BUZ_OFF;
  // detection state
  float prevMag_ = 1.0f; uint32_t prevT_ = 0; bool havePrev_ = false;
  float gvec_[3] = {0, 0, 1};           // slow gravity estimate (orientation baseline)
  float preG_[3] = {0, 0, 1};           // baseline frozen when the window opens
  float recent_[3] = {0, 0, 0}; int recentN_ = 0;
  uint32_t winStart_ = 0; float peakG_ = 0, maxJerk_ = 0, maxGyro_ = 0, pgx_ = 0, pgy_ = 0, pgz_ = 0; int overCount_ = 0;
  // event state
  uint32_t cdStart_ = 0, gpsWaitStart_ = 0, cooldownStart_ = 0, lastBeep_ = 0;
  bool armed_ = false;                  // button may cancel only when it was released at countdown start
  bool cancelRequested_ = false;
  char id_[24] = "";
};
