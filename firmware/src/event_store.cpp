#include "event_store.h"
#include <Preferences.h>

EventStore store;

static bool slotFinal(const NotifSlot& s) {
  return s.status == DS_DELIVERED || s.status == DS_FAILED || s.status == DS_SUBMITTED || s.status == DS_UNKNOWN;
}

bool eventFinished(const EventRec& r) {
  if (!r.used) return true;
  if (!r.uploaded) return false;
  if (r.state != ST_DISPATCHED) return true;
  for (int i = 0; i < r.nSlots; i++)
    if (!slotFinal(r.slots[i]) || r.slots[i].reported != r.slots[i].status) return false;
  return true;
}

void EventStore::begin() {
  mtx_ = xSemaphoreCreateMutex();
  memset(recs_, 0, sizeof(recs_));
  Preferences p; p.begin("evt", true);
  size_t n = p.getBytesLength("recs");
  if (n == sizeof(recs_)) p.getBytes("recs", recs_, sizeof(recs_));
  p.end();
  for (auto& r : recs_) { r.nextUploadMs = 0; for (auto& s : r.slots) s.lastActionMs = 0; if (r.seq > seq_) seq_ = r.seq; }
}

uint32_t EventStore::nextCounter() {
  Preferences p; p.begin("evt", false);
  uint32_t c = p.getUInt("ctr", 0) + 1;
  p.putUInt("ctr", c);
  p.end();
  return c;
}

void EventStore::lock() { xSemaphoreTake(mtx_, portMAX_DELAY); }
void EventStore::unlock() { xSemaphoreGive(mtx_); }

void EventStore::save() {   // call while holding the lock
  Preferences p; p.begin("evt", false);
  p.putBytes("recs", recs_, sizeof(recs_));
  p.end();
}

int EventStore::add(const EventRec& r) {
  lock();
  int idx = -1;
  for (int i = 0; i < MAX_EVENTS; i++) if (!recs_[i].used) { idx = i; break; }
  if (idx < 0) {  // evict: oldest finished event, else oldest cancelled, else oldest overall
    uint32_t best = 0xFFFFFFFF;
    for (int pass = 0; pass < 3 && idx < 0; pass++)
      for (int i = 0; i < MAX_EVENTS; i++) {
        bool ok = pass == 0 ? eventFinished(recs_[i]) : pass == 1 ? recs_[i].state == ST_CANCELLED : true;
        if (ok && recs_[i].seq < best) { best = recs_[i].seq; idx = i; }
      }
  }
  recs_[idx] = r; recs_[idx].used = 1; recs_[idx].seq = ++seq_;
  save();
  unlock();
  return idx;
}

bool EventStore::get(int i, EventRec& out) {
  lock(); out = recs_[i]; unlock(); return out.used;
}

int EventStore::pending() {
  int n = 0; lock();
  for (auto& r : recs_) if (r.used && !eventFinished(r)) n++;
  unlock(); return n;
}
