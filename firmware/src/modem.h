#pragma once
#include <Arduino.h>

enum SmsResult { SMS_OK, SMS_FAIL, SMS_UNKNOWN };

// A7672S / SIM7672S driver using only standard SIMCom A76XX-series AT commands.
// All methods block and must be called from the modem task ONLY (never from the sensor loop).
// !! Verify every command against the AT Command Manual for the firmware on your module (AT+CGMR). !!
class Modem {
 public:
  void begin();
  bool init();                                     // echo off, text mode, CNMI/CSMP for delivery reports, APN
  bool waitRegistered(uint32_t timeoutMs);         // AT+CEREG? / AT+CREG? / AT+CGREG?
  int  csq();                                      // AT+CSQ rssi (0..31, 99 unknown)
  SmsResult sendSms(const char* number, const char* text, int& mr, String& resp);
  bool dial(const char* number, uint32_t ringMs, String& resp);
  int  httpPost(const String& url, const String& body, String& respBody);  // returns HTTP status or <0
  bool provisionCaCert(const char* pem);           // one-time: store server CA in modem file system
  void pollUrc();                                  // drain unsolicited lines (+CDS delivery reports)
  bool deliveryFor(int mr, int& st);               // true if a +CDS for this reference was seen
  bool at(const char* cmd, const char* expect = "OK", uint32_t timeoutMs = 1000, String* out = nullptr);
  bool registered() const { return registered_; }
  HardwareSerial& serial();
 private:
  bool waitFor(const char* expect, uint32_t timeoutMs, String* out);
  void parseLine(const String& line);
  void flushIn();
  void finishLine(String& buf, int from);
  bool registered_ = false;
  struct Report { int mr; int st; bool used; } reports_[8] = {};
  int nextReport_ = 0;
  String urcLine_;
};
extern Modem modem;
