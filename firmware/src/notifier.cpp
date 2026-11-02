#include "notifier.h"
#include "modem.h"
#include "event_store.h"
#include "status.h"
#include "config.h"
#include "secrets.h"
#include <ArduinoJson.h>

static const char* DS_NAMES[] = { "PENDING", "SUBMITTED", "DELIVERED", "FAILED", "UNKNOWN" };
static const char* RC_NAMES[] = { "FAMILY", "INSURANCE", "EMERGENCY" };

// ---------------- message builders ----------------
static void mapsUrl(const EventRec& r, char* out, size_t n) {
  if (r.gpsValid) snprintf(out, n, "https://www.google.com/maps?q=%.6f,%.6f", r.lat, r.lon);
  else snprintf(out, n, "GPS location unavailable");
}
static void humanTime(const EventRec& r, char* out, size_t n) {
  if (r.dateIso[0]) snprintf(out, n, "%.10s %.8s UTC", r.dateIso, r.dateIso + 11);
  else snprintf(out, n, "time unknown");
}

static void buildSms(const EventRec& r, uint8_t recip, char* out, size_t n) {
  char url[96], when[32]; mapsUrl(r, url, sizeof(url)); humanTime(r, when, sizeof(when));
#if SHORT_SMS
  if (recip == RC_INSURANCE) snprintf(out, n, "ACCIDENT %s\n%s %s\n%s\n%s", r.id, VEHICLE_REG, OWNER_NAME, when, url);
  else snprintf(out, n, "EMERGENCY ALERT\n%s %s\n%s\n%s", VEHICLE_REG, OWNER_NAME, r.id, url);
#else
  if (recip == RC_INSURANCE)
    snprintf(out, n, "ACCIDENT NOTIFICATION\nAccident ID: %s\nVehicle: %s\nOwner: %s\nTime: %s\nLocation: %s",
             r.id, VEHICLE_REG, OWNER_NAME, when, url);
  else
    snprintf(out, n, "EMERGENCY VEHICLE ALERT\n\nA possible accident has been detected.\n\nVehicle: %s\nOwner: %s\n"
             "Accident ID: %s\nTime: %s\nLocation: %s\n\nPlease contact the vehicle owner and emergency services if assistance is needed.",
             VEHICLE_REG, OWNER_NAME, r.id, when, url);
#endif
}

// ---------------- store update helpers (never hold the lock across modem I/O) ----------------
static void updSlot(int ei, const char* id, int si, uint8_t status, int8_t triesInc, int16_t mr, bool setMr) {
  store.lock();
  EventRec& r = store.raw(ei);
  if (r.used && strcmp(r.id, id) == 0) {
    NotifSlot& s = r.slots[si];
    if (!(s.status == DS_DELIVERED && status != DS_DELIVERED)) s.status = status;
    s.tries += triesInc; if (setMr) s.mr = mr; s.lastActionMs = millis();
    store.save();
  }
  store.unlock();
}
static void updEvent(int ei, const char* id, bool uploaded, bool bumpTry, uint32_t nextMs) {
  store.lock();
  EventRec& r = store.raw(ei);
  if (r.used && strcmp(r.id, id) == 0) {
    if (uploaded) r.uploaded = 1;
    if (bumpTry && r.uploadTries < 250) r.uploadTries++;
    r.nextUploadMs = nextMs; store.save();
  }
  store.unlock();
}
static void markReported(int ei, const char* id, int si, uint8_t status) {
  store.lock();
  EventRec& r = store.raw(ei);
  if (r.used && strcmp(r.id, id) == 0) { r.slots[si].reported = status; store.save(); }
  store.unlock();
}

// ---------------- cloud ----------------
static bool uploadEvent(const EventRec& r) {
  JsonDocument d;
  d["accident_id"] = r.id;
  if (r.gpsValid) { d["latitude"] = r.lat; d["longitude"] = r.lon; }
  d["gps_valid"] = (bool)r.gpsValid;
  d["acceleration_g"] = r.peakG;
  JsonObject g = d["gyroscope_data"].to<JsonObject>();
  g["peak_x_dps"] = r.gx; g["peak_y_dps"] = r.gy; g["peak_z_dps"] = r.gz;
  if (r.dateIso[0]) d["accident_date"] = r.dateIso;
  d["accident_status"] = r.state == ST_CANCELLED ? "CANCELLED" : "EMERGENCY_DISPATCHED";
  d["cancellation_status"] = r.state == ST_CANCELLED ? "CANCELLED" : "NONE";
  String body; serializeJson(d, body);
  String out;
  int code = modem.httpPost(String(API_BASE_URL) + API_HOST_PATH_ACCIDENTS, body, out);
  return code == 200 || code == 201;      // 200 = already stored (idempotent retry) -> success
}

static bool reportNotif(const EventRec& r, const NotifSlot& s) {
  char msg[400] = "";
  if (s.type == NT_SMS) buildSms(r, s.recip, msg, sizeof(msg));
  JsonDocument d;
  d["accident_id"] = r.id; d["recipient_type"] = RC_NAMES[s.recip]; d["recipient_phone"] = s.phone;
  d["notification_type"] = s.type == NT_SMS ? "SMS" : "CALL";
  if (msg[0]) d["message"] = msg;
  d["delivery_status"] = DS_NAMES[s.status]; d["retry_count"] = s.tries;
  String body; serializeJson(d, body); String out;
  return modem.httpPost(String(API_BASE_URL) + API_HOST_PATH_NOTIF_STATUS, body, out) == 200;
}

static void heartbeat() {
  JsonDocument d; d["firmware_version"] = FW_VERSION; d["gps_valid"] = (bool)g_status.gpsValid;
  d["signal_quality"] = (int)g_status.csq; d["pending_events"] = (int)g_status.pending;
  String body, out; serializeJson(d, body);
  int code = modem.httpPost(String(API_BASE_URL) + API_HOST_PATH_HEARTBEAT, body, out);
  if (code != 200) return;
  JsonDocument resp; if (deserializeJson(resp, out)) return;
  for (JsonObject n : resp["retry_notifications"].as<JsonArray>()) {   // owner asked to retry a notification
    const char* aid = n["accident_id"]; const char* ph = n["recipient_phone"]; const char* ty = n["notification_type"];
    if (!aid || !ph) continue;
    store.lock();
    for (int i = 0; i < MAX_EVENTS; i++) {
      EventRec& r = store.raw(i);
      if (!r.used || strcmp(r.id, aid)) continue;
      for (int k = 0; k < r.nSlots; k++)
        if (!strcmp(r.slots[k].phone, ph) && r.slots[k].type == (strcmp(ty ? ty : "SMS", "CALL") ? NT_SMS : NT_CALL)
            && r.slots[k].status != DS_DELIVERED) { r.slots[k].status = DS_PENDING; r.slots[k].tries = 0; r.slots[k].reported = 255; }
    }
    store.save(); store.unlock();
  }
}

// ---------------- per-event processing ----------------
static void processSlots(int ei, const EventRec& r) {
  uint32_t now = millis();
  for (int si = 0; si < r.nSlots; si++) {
    const NotifSlot& s = r.slots[si];
    if (s.type == NT_SMS && s.status == DS_PENDING && s.tries < SMS_MAX_TRIES &&
        (s.lastActionMs == 0 || now - s.lastActionMs >= SMS_RETRY_BACKOFF_MS) && modem.registered()) {
      char text[420]; buildSms(r, s.recip, text, sizeof(text));
      int mr; String resp; SmsResult res = modem.sendSms(s.phone, text, mr, resp);
      if (res == SMS_OK) updSlot(ei, r.id, si, DS_SUBMITTED, 1, mr, true);        // accepted by the network, NOT yet delivered
      else if (res == SMS_UNKNOWN) updSlot(ei, r.id, si, DS_UNKNOWN, 1, -1, false); // never auto-resend: could duplicate
      else updSlot(ei, r.id, si, (s.tries + 1 >= SMS_MAX_TRIES) ? DS_FAILED : DS_PENDING, 1, -1, false);
    }
    // delivery report => DELIVERED / FAILED (only the network can tell us)
    if (s.type == NT_SMS && s.status == DS_SUBMITTED && s.mr >= 0) {
      int st;
      if (modem.deliveryFor(s.mr, st)) {
        if (st == 0) updSlot(ei, r.id, si, DS_DELIVERED, 0, s.mr, false);
        else if (st >= 64) updSlot(ei, r.id, si, DS_FAILED, 0, s.mr, false);
      } else if (now - s.lastActionMs > SMS_DELIVERY_WAIT_MS) {
        updSlot(ei, r.id, si, DS_UNKNOWN, 0, s.mr, false);                        // no report arrived
      }
    }
    if (s.type == NT_CALL && s.status == DS_PENDING && s.tries < CALL_MAX_TRIES && modem.registered()) {
      String resp; bool ok = modem.dial(s.phone, CALL_RING_MS, resp);
      updSlot(ei, r.id, si, ok ? DS_SUBMITTED : DS_FAILED, 1, -1, false);        // we can't know if it was answered
    }
  }
}

static void processEvent(int ei) {
  EventRec r; if (!store.get(ei, r)) return;
  uint32_t now = millis();
  if (r.state == ST_DISPATCHED) processSlots(ei, r);     // SMS/calls first: independent of cloud connectivity
  store.get(ei, r);
  if (!r.uploaded && modem.registered() && now >= r.nextUploadMs) {
    if (uploadEvent(r)) updEvent(ei, r.id, true, false, 0);
    else {
      uint32_t back = min((uint32_t)UPLOAD_BACKOFF_MAX_MS, (uint32_t)UPLOAD_BACKOFF_MIN_MS << min((int)r.uploadTries, 6));
      updEvent(ei, r.id, false, true, millis() + back);   // same accident_id on every retry => no duplicates
    }
    store.get(ei, r);
  }
  if (r.uploaded && r.state == ST_DISPATCHED)
    for (int si = 0; si < r.nSlots; si++)
      if (r.slots[si].reported != r.slots[si].status && r.slots[si].status != DS_PENDING)
        if (reportNotif(r, r.slots[si])) markReported(ei, r.id, si, r.slots[si].status);
}

static void task(void*) {
  modem.begin();
  bool ready = false; uint32_t lastTry = 0, lastHb = 0, lastCsq = 0;
  for (;;) {
    uint32_t now = millis();
    if (!ready && (lastTry == 0 || now - lastTry > 15000)) {
      lastTry = now;
      ready = modem.init() && modem.waitRegistered(MODEM_REG_TIMEOUT_MS);
      g_status.netReg = ready;
    }
    modem.pollUrc();
    if (ready) {
      for (int i = 0; i < MAX_EVENTS; i++) processEvent(i);
      if (now - lastCsq > 20000) {
        lastCsq = now; g_status.csq = modem.csq();
        String r; modem.at("AT+CEREG?", "OK", 1000, &r);
        if (r.indexOf(",1") < 0 && r.indexOf(",5") < 0) { ready = modem.waitRegistered(30000); g_status.netReg = ready; }  // connection recovery
      }
      if (now - lastHb > HEARTBEAT_MS) { lastHb = now; heartbeat(); }
    }
    g_status.pending = store.pending();
    vTaskDelay(pdMS_TO_TICKS(250));
  }
}

void notifierTaskStart() { xTaskCreatePinnedToCore(task, "modem", 12288, nullptr, 1, nullptr, 0); }
