// IoT Vehicle Accident Detection — ESP32 firmware
//  core 1 (loop): 200 Hz IMU sampling + non-blocking accident state machine + GPS parsing + button + buzzer
//  core 0 tasks : modem (SMS / call / HTTPS / retries) and OLED — so slow modem work never blocks detection.
#include <Arduino.h>
#include <Wire.h>
#include "pins.h"
#include "config.h"
#include "secrets.h"
#include "imu.h"
#include "gps_mgr.h"
#include "event_store.h"
#include "accident_fsm.h"
#include "notifier.h"
#include "modem.h"
#include "ui.h"

static Imu imu;
static GpsMgr gps;
static AccidentFsm fsm;
static uint32_t nextSampleUs = 0;
static bool btnDown = false, btnRaw = false; static uint32_t btnChangeMs = 0;

// Hold the button while powering up => USB<->modem AT passthrough (use it to verify AT commands).
static void atPassthrough() {
  Serial.println("\n[AT passthrough] type AT commands; reset to exit");
  modem.begin();
  for (;;) {
    while (Serial.available()) modem.serial().write(Serial.read());
    while (modem.serial().available()) Serial.write(modem.serial().read());
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  buzzerBegin();
  delay(300);
  if (digitalRead(PIN_BUTTON) == LOW) { delay(1500); if (digitalRead(PIN_BUTTON) == LOW) atPassthrough(); }

  Wire.begin(PIN_IMU_SDA, PIN_IMU_SCL, 400000);      // IMU bus
  uiTaskStart();                                     // OLED bus (Wire1) + task
  store.begin();
  gps.begin();

  if (!imu.begin(Wire)) Serial.println("IMU not found on 0x68 — check wiring");
  else {
    Serial.printf("IMU WHO_AM_I=0x%02X -> %s\n", imu.whoAmI(), imu.variant());
    Serial.println(imu.calibrate() ? "IMU calibrated (stationary)" : "IMU calibration skipped/failed: using stored values");
  }
  notifierTaskStart();
  nextSampleUs = micros();
  Serial.printf("Device %s ready. Pending events: %d\n", DEVICE_ID, store.pending());
}

void loop() {
  uint32_t nowMs = millis();
  gps.poll();

  // --- debounced button; edge = a fresh press ---
  bool raw = digitalRead(PIN_BUTTON) == LOW, edge = false;
  if (raw != btnRaw) { btnRaw = raw; btnChangeMs = nowMs; }
  if (nowMs - btnChangeMs >= BUTTON_DEBOUNCE_MS && btnDown != btnRaw) { btnDown = btnRaw; edge = btnDown; }

  // --- fixed-rate sampling (no delay(): GPS parsing and button stay responsive) ---
  static bool pendingEdge = false;
  if (edge) pendingEdge = true;                     // keep the press until the next sample consumes it
  if ((int32_t)(micros() - nextSampleUs) >= 0) {
    nextSampleUs += SAMPLE_PERIOD_US;
    if ((int32_t)(micros() - nextSampleUs) > 50 * SAMPLE_PERIOD_US) nextSampleUs = micros();  // resync after a stall
    ImuSample s;
    if (imu.read(s)) { fsm.update(s, pendingEdge, btnDown, gps, nowMs); pendingEdge = false; }
  }

  static uint32_t lastSlow = 0;
  if (nowMs - lastSlow > 500) {
    lastSlow = nowMs; GpsSnapshot g = gps.snapshot();
    g_status.gpsValid = g.valid; g_status.sats = g.sats;
  }
  buzzerUpdate(fsm.buzzer(), nowMs);
}
