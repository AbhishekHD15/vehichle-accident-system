#pragma once
#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "config.h"
#include "pins.h"

struct GpsSnapshot { bool valid; double lat, lon; char iso[24]; uint8_t sats; };

class GpsMgr {
 public:
  void begin() { ser_.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX); }
  void poll() { while (ser_.available()) gps_.encode(ser_.read()); }   // call every loop; non-blocking
  GpsSnapshot snapshot() {
    GpsSnapshot s{}; s.iso[0] = 0;
    s.sats = gps_.satellites.isValid() ? gps_.satellites.value() : 0;
    // Valid only with a real fix that is recent enough. Never fabricate coordinates.
    s.valid = gps_.location.isValid() && gps_.location.age() < GPS_MAX_AGE_MS &&
              fabs(gps_.location.lat()) > 1e-6 && fabs(gps_.location.lng()) > 1e-6;
    if (s.valid) { s.lat = gps_.location.lat(); s.lon = gps_.location.lng(); }
    if (gps_.date.isValid() && gps_.time.isValid() && gps_.date.year() >= 2024)
      snprintf(s.iso, sizeof(s.iso), "%04d-%02d-%02dT%02d:%02d:%02dZ", gps_.date.year(), gps_.date.month(),
               gps_.date.day(), gps_.time.hour(), gps_.time.minute(), gps_.time.second());
    return s;
  }
 private:
  HardwareSerial ser_{1};   // UART1 for GPS, UART2 for the modem
  TinyGPSPlus gps_;
};
