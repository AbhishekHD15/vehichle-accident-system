#pragma once
#include <Arduino.h>

enum FsmState : uint8_t { FSM_MONITORING, FSM_VALIDATING, FSM_COUNTDOWN, FSM_WAIT_GPS, FSM_COOLDOWN };

// Shared, read-mostly status for the OLED task (single writers, tearing-tolerant scalars).
struct SystemStatus {
  volatile uint8_t fsm = FSM_MONITORING;
  volatile int countdownSec = 0;
  volatile bool gpsValid = false;
  volatile uint8_t sats = 0;
  volatile int csq = -1;
  volatile bool netReg = false;
  volatile uint8_t pending = 0;
  volatile float lastG = 0;
  volatile uint8_t lastResult = 0;   // 0 none, 1 cancelled, 2 dispatched
  char accidentId[24] = "";
};
extern SystemStatus g_status;
