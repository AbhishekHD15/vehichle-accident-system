#pragma once
#include <Arduino.h>

#define MAX_EVENTS 6
#define MAX_SLOTS  6

enum : uint8_t { ST_DETECTED = 0, ST_CANCELLED = 1, ST_DISPATCHED = 2 };
enum : uint8_t { DS_PENDING = 0, DS_SUBMITTED = 1, DS_DELIVERED = 2, DS_FAILED = 3, DS_UNKNOWN = 4 };
enum : uint8_t { RC_FAMILY = 0, RC_INSURANCE = 1, RC_EMERGENCY = 2 };
enum : uint8_t { NT_SMS = 0, NT_CALL = 1 };

struct NotifSlot {
  char phone[16];
  uint8_t recip, type, status, tries, reported, pad;
  int16_t mr;                // SMS message reference from +CMGS (for delivery reports)
  uint32_t lastActionMs;     // runtime only
};

struct EventRec {
  uint8_t used, state, gpsValid, uploaded;
  char id[24];
  float lat, lon, peakG, gx, gy, gz;
  char dateIso[24];          // UTC from GPS, empty if unknown (server then stamps receipt time)
  uint8_t nSlots, uploadTries, pad[2];
  NotifSlot slots[MAX_SLOTS];
  uint32_t seq, nextUploadMs; // nextUploadMs runtime only
};

// Flash-backed (NVS) queue so events survive resets / power loss. Thread-safe via a mutex.
class EventStore {
 public:
  void begin();
  uint32_t nextCounter();               // persistent, never reused => unique accident ids
  int add(const EventRec& r);           // returns slot index
  bool get(int i, EventRec& out);       // copy
  void save();
  void lock();
  void unlock();
  EventRec& raw(int i) { return recs_[i]; }   // only while holding lock()
  int pending();                         // events not yet fully processed
 private:
  EventRec recs_[MAX_EVENTS];
  uint32_t seq_ = 0;
  SemaphoreHandle_t mtx_ = nullptr;
};
extern EventStore store;
bool eventFinished(const EventRec& r);
