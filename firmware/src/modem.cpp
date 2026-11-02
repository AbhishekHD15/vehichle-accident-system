#include "modem.h"
#include "pins.h"
#include "config.h"
#include "secrets.h"

Modem modem;
static HardwareSerial& SER = Serial2;
HardwareSerial& Modem::serial() { return SER; }

void Modem::begin() { SER.begin(MODEM_BAUD, SERIAL_8N1, PIN_MODEM_RX, PIN_MODEM_TX); }
void Modem::flushIn() { while (SER.available()) SER.read(); }

// Status report in text mode (CNMI ds=1):  +CDS: <fo>,<mr>,<ra>,<tora>,<scts>,<dt>,<st>
void Modem::parseLine(const String& line) {
  if (!line.startsWith("+CDS:")) return;
  int c1 = line.indexOf(',');
  int c2 = line.indexOf(',', c1 + 1);
  int last = line.lastIndexOf(',');
  if (c1 < 0 || c2 < 0 || last < 0) return;
  int mr = line.substring(c1 + 1, c2).toInt();
  int st = line.substring(last + 1).toInt();
  reports_[nextReport_] = { mr, st, true };
  nextReport_ = (nextReport_ + 1) % 8;
}

void Modem::pollUrc() {
  while (SER.available()) {
    char c = SER.read();
    if (c == '\n') { urcLine_.trim(); if (urcLine_.length()) parseLine(urcLine_); urcLine_ = ""; }
    else if (urcLine_.length() < 160) urcLine_ += c;
  }
}

bool Modem::deliveryFor(int mr, int& st) {
  for (auto& r : reports_) if (r.used && r.mr == mr) { st = r.st; return true; }
  return false;
}

bool Modem::waitFor(const char* expect, uint32_t to, String* out) {
  uint32_t t0 = millis(); String buf, line;
  while (millis() - t0 < to) {
    while (SER.available()) {
      char c = SER.read(); buf += c;
      if (c == '\n') { line.trim(); if (line.length()) parseLine(line); line = ""; } else line += c;
    }
    if (buf.indexOf(expect) >= 0) { if (out) *out = buf; return true; }
    if (buf.indexOf("ERROR") >= 0) { if (out) *out = buf; return false; }
    vTaskDelay(2);
  }
  if (out) *out = buf;
  return false;
}

// A prefix match (e.g. "+CMGS:") can arrive before the rest of the line: read until the newline.
void Modem::finishLine(String& buf, int from) {
  uint32_t t0 = millis();
  while (buf.indexOf('\n', from) < 0 && millis() - t0 < 800) {
    while (SER.available()) buf += (char)SER.read();
    vTaskDelay(2);
  }
}

bool Modem::at(const char* cmd, const char* expect, uint32_t to, String* out) {
  flushIn(); SER.print(cmd); SER.print("\r");
  return waitFor(expect, to, out);
}

bool Modem::init() {
  for (int i = 0; i < 10; i++) { if (at("AT", "OK", 500)) break; if (i == 9) return false; vTaskDelay(300); }
  at("ATE0");
  at("AT+CMEE=2");                                   // verbose error codes
  if (!at("AT+CPIN?", "READY", 3000)) return false;  // SIM must be ready
  at("AT+CMGF=1");                                   // SMS text mode
  at("AT+CSCS=\"GSM\"");
  at("AT+CSMP=49,167,0,0");                          // request SMS status reports (SMS-SUBMIT fo=49)
  at("AT+CNMI=2,1,0,1,0");                           // route status reports to the host as +CDS
  char cmd[96]; snprintf(cmd, sizeof(cmd), "AT+CGDCONT=1,\"IP\",\"%s\"", MODEM_APN);
  at(cmd);
  at("AT+CTZU=1");                                   // network time sync (needed for certificate validity checks)
  return true;
}

bool Modem::waitRegistered(uint32_t to) {
  uint32_t t0 = millis();
  while (millis() - t0 < to) {
    String r;
    const char* q[] = { "AT+CEREG?", "AT+CREG?", "AT+CGREG?" };
    for (auto c : q) {
      if (at(c, "OK", 1000, &r)) {
        int p = r.indexOf(',');                      // +CxREG: <n>,<stat>
        if (p > 0) { int stat = r.substring(p + 1).toInt(); if (stat == 1 || stat == 5) { registered_ = true; return true; } }
      }
    }
    vTaskDelay(2000);
  }
  registered_ = false; return false;
}

int Modem::csq() {
  String r; if (!at("AT+CSQ", "OK", 1000, &r)) return -1;
  int p = r.indexOf("+CSQ:"); return p < 0 ? -1 : r.substring(p + 5).toInt();
}

SmsResult Modem::sendSms(const char* number, const char* text, int& mr, String& resp) {
  mr = -1; flushIn();
  SER.printf("AT+CMGS=\"%s\"\r", number);
  if (!waitFor(">", 8000, &resp)) { SER.write(0x1B); return SMS_FAIL; }   // ESC aborts
  SER.print(text); SER.write(0x1A);                                       // Ctrl+Z sends
  if (waitFor("+CMGS:", 60000, &resp)) {
    int p = resp.indexOf("+CMGS:"); finishLine(resp, p); mr = resp.substring(p + 6).toInt();
    waitFor("OK", 2000, nullptr);
    return SMS_OK;
  }
  // "ERROR"/"+CMS ERROR" => modem rejected it. Pure timeout => we cannot know: UNKNOWN (never auto-resend: could duplicate)
  return resp.indexOf("ERROR") >= 0 ? SMS_FAIL : SMS_UNKNOWN;
}

bool Modem::dial(const char* number, uint32_t ringMs, String& resp) {
  char cmd[40]; snprintf(cmd, sizeof(cmd), "ATD%s;", number);
  if (!at(cmd, "OK", 15000, &resp)) { at("ATH"); return false; }
  uint32_t t0 = millis(); String r;
  while (millis() - t0 < ringMs) {
    if (waitFor("NO CARRIER", 500, &r) || r.indexOf("BUSY") >= 0 || r.indexOf("NO ANSWER") >= 0) break;
  }
  at("ATH", "OK", 3000);                                                   // hang up: never ring forever
  resp += r; return true;
}

bool Modem::provisionCaCert(const char* pem) {
  char cmd[64]; snprintf(cmd, sizeof(cmd), "AT+CCERTDOWN=\"%s\",%d", SSL_CA_FILE, (int)strlen(pem));
  flushIn(); SER.print(cmd); SER.print("\r");
  if (!waitFor(">", 5000, nullptr)) return false;
  SER.print(pem);
  return waitFor("OK", 10000, nullptr);
}

int Modem::httpPost(const String& url, const String& body, String& out) {
  out = "";
  at("AT+HTTPTERM", "OK", 1000);                     // clean state (ignore error if not initialised)
  if (!at("AT+HTTPINIT", "OK", 5000)) return -1;
  int status = -2; String r;
  auto fail = [&](int code) { at("AT+HTTPTERM", "OK", 3000); return code; };
  String cmd = "AT+HTTPPARA=\"URL\",\"" + url + "\"";
  if (!at(cmd.c_str(), "OK", 3000)) return fail(-3);
  if (!at("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK", 2000)) return fail(-4);
  // One custom header carries the device credential: "Authorization: Device <id>:<key>"
  cmd = String("AT+HTTPPARA=\"USERDATA\",\"Authorization: Device ") + DEVICE_ID + ":" + DEVICE_KEY + "\"";
  if (!at(cmd.c_str(), "OK", 2000)) return fail(-5);
#if SSL_ENABLE
  at("AT+CSSLCFG=\"sslversion\",0,4");               // TLS 1.2
  at("AT+CSSLCFG=\"authmode\",0,1");                 // 1 = verify server certificate
  at("AT+CSSLCFG=\"cacert\",0,\"" SSL_CA_FILE "\"");
  at("AT+CSSLCFG=\"enableSNI\",0,1");
  if (!at("AT+HTTPPARA=\"SSLCFG\",0", "OK", 2000)) return fail(-6);
#endif
  char dcmd[40]; snprintf(dcmd, sizeof(dcmd), "AT+HTTPDATA=%d,10000", (int)body.length());
  if (!at(dcmd, "DOWNLOAD", 3000)) return fail(-7);
  SER.print(body);
  if (!waitFor("OK", 12000, nullptr)) return fail(-8);
  if (!at("AT+HTTPACTION=1", "+HTTPACTION:", 60000, &r)) return fail(-9);
  int p = r.indexOf("+HTTPACTION:");
  finishLine(r, p);
  int c1 = r.indexOf(',', p), c2 = r.indexOf(',', c1 + 1);
  if (c1 < 0 || c2 < 0) return fail(-10);
  status = r.substring(c1 + 1, c2).toInt();
  int len = r.substring(c2 + 1).toInt();
  if (len > 0 && len < 2000) {
    char rc[40]; snprintf(rc, sizeof(rc), HTTP_READ_CMD_FMT, len);
    if (at(rc, "+HTTPREAD: 0", 8000, &r)) {
      int s = r.indexOf('{'), e = r.lastIndexOf('}');
      if (s >= 0 && e > s) out = r.substring(s, e + 1);
    }
  }
  at("AT+HTTPTERM", "OK", 3000);
  return status;   // 200/201 = success. <0 = modem/network failure, 60x = modem-level HTTP error
}
