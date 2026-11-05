#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPSPlus.h>
#include <math.h>
#include <Preferences.h>

Preferences prefs;

// ---------- PIN CONFIGURATION ----------

#define MPU_SDA       21
#define MPU_SCL       22
#define MPU_ADDR      0x68

#define OLED_SDA      19
#define OLED_SCL      18
#define OLED_ADDR     0x3C

#define GPS_RX        32
#define GPS_TX        33

#define MODEM_RX      16
#define MODEM_TX      17

#define BUZZER_PIN    25
#define BUTTON_PIN    26

// ---------- SETTINGS ----------

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64

// Your SMS phone number
const char PHONE_NUMBER[] = "+918310678885";

// Impact threshold (g). 1.30 triggers on strong bump, raise to ~2.5 for real crashes.
const float IMPACT_THRESHOLD_G = 2.0;

// Time window driver can press button to cancel false alarm
const unsigned long CANCEL_WINDOW_MS = 10000;

// ============================================================
// CLOUD CONFIG — UPDATE THESE WHEN CLOUDFLARE URL CHANGES
// ============================================================
// Your SIM APN:
//   Airtel  -> "airtelgprs.com"
//   Jio     -> "jionet"
//   Vi      -> "www"
//   BSNL    -> "bsnlnet"
const char MODEM_APN[]   = "airtelgprs.com";

// Cloudflare Tunnel URL (update this each time you restart cloudflared)
const char CLOUD_HOST[]  = "evaluating-parade-headquarters-jerusalem.trycloudflare.com";
const char CLOUD_PATH[]  = "/api/v1/device/accidents";

// Device credentials from your admin dashboard
const char DEVICE_ID[]     = "ESP01";
const char DEVICE_KEY[]    = "rEnXY4iquz0ss5Be6G3tgytk59NXHpbn-oScPDG8rfo";
const char OWNER_NAME[]    = "Rahul";
const char VEHICLE_MODEL[] = "Innova";
// ============================================================

// ---------- OBJECTS ----------

TwoWire OLED_I2C = TwoWire(1);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &OLED_I2C, -1);

TinyGPSPlus gps;

HardwareSerial GPS_Serial(1);
HardwareSerial Modem_Serial(2);

// ---------- STATE ----------

bool oledReady    = false;
bool mpuReady     = false;
bool modemReady   = false;
bool alarmPending = false;
bool alarmSent    = false;

unsigned long alarmStart     = 0;
unsigned long lastDisplay    = 0;
unsigned long lastSensorRead = 0;

float axG = 0, ayG = 0, azG = 0;
float totalG = 1.0;

// Accident ID counter (increments each event, survives resets only if you use NVS)
int accidentCounter = 1;

// ---------- OLED ----------

void showStatus(const char *line1,
                const char *line2 = "",
                const char *line3 = "") {
  if (!oledReady) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("VEHICLE SAFETY");
  display.println("----------------");
  display.println(line1);
  display.println(line2);
  display.println(line3);
  display.display();
}

// ---------- MPU6050 RAW READ ----------

bool readMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0)  return false;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)6) != 6) return false;

  int16_t ax = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t ay = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t az = (int16_t)((Wire.read() << 8) | Wire.read());

  axG    = ax / 16384.0;
  ayG    = ay / 16384.0;
  azG    = az / 16384.0;
  totalG = sqrt(axG * axG + ayG * ayG + azG * azG);
  return true;
}

// ---------- MODEM COMMAND ----------

String modemCommand(const String &command, unsigned long timeout = 2000) {
  while (Modem_Serial.available()) Modem_Serial.read(); // flush

  Serial.print("MODEM >> ");
  Serial.println(command);
  Modem_Serial.print(command);
  Modem_Serial.print("\r\n");

  String response;
  unsigned long started = millis();
  while (millis() - started < timeout) {
    while (Modem_Serial.available()) response += (char)Modem_Serial.read();
    delay(5);
  }

  Serial.print("MODEM << ");
  Serial.println(response);
  return response;
}

// ---------- SEND SMS ----------

bool sendSingleSMS(const char *targetNum, const String &message) {
  Serial.print("\n[SMS] Trying destination: ");
  Serial.println(targetNum);

  // 1. Flush UART buffer
  while (Modem_Serial.available()) Modem_Serial.read();

  // 2. Ensure Text Mode & GSM Charset & LTE Packet Domain
  modemCommand("AT+CMGF=1", 1000);
  modemCommand("AT+CSCS=\"GSM\"", 1000);
  modemCommand("AT+CSMP=17,167,0,0", 1000);
  modemCommand("AT+CGSMS=1", 1000);          // Required for Jio LTE
  modemCommand("AT+CPMS=\"SM\",\"SM\",\"SM\"", 1000); // Set SIM SMS memory

  // Check SMS service center
  String sca = modemCommand("AT+CSCA?", 1000);
  Serial.println("[SMS] Current SMSC: " + sca);
  if (sca.indexOf("+") < 0) {
    // If SMSC is missing, set standard Jio SMSC
    modemCommand("AT+CSCA=\"+917010075009\",145", 1000);
  }

  // 3. Send AT+CMGS with Carriage Return ONLY (\r)
  while (Modem_Serial.available()) Modem_Serial.read();
  Modem_Serial.print("AT+CMGS=\"");
  Modem_Serial.print(targetNum);
  Modem_Serial.print("\"\r");
  Modem_Serial.flush();

  // 4. Wait for '>' prompt
  String prompt = "";
  unsigned long started = millis();
  while (millis() - started < 7000) {
    while (Modem_Serial.available()) {
      char c = (char)Modem_Serial.read();
      prompt += c;
      Serial.write(c);
      if (c == '>') break;
    }
    if (prompt.indexOf('>') >= 0) break;
    delay(10);
  }

  if (prompt.indexOf('>') < 0) {
    Serial.println("\n[SMS] ERROR: No '>' prompt from modem. Response: " + prompt);
    return false;
  }

  Serial.println("\n[SMS] Got '>' prompt. Writing message...");
  delay(150);

  // 5. Send message text
  Modem_Serial.print(message);
  Modem_Serial.flush();
  delay(300);

  // 6. Send Ctrl+Z (ASCII 26) to commit
  Modem_Serial.write((uint8_t)26);
  Modem_Serial.flush();

  // 7. Wait up to 35s for network delivery confirmation (+CMGS:)
  String response = "";
  started = millis();
  while (millis() - started < 35000) {
    while (Modem_Serial.available()) {
      char c = (char)Modem_Serial.read();
      response += c;
      Serial.write(c);
    }
    if (response.indexOf("+CMGS:") >= 0) {
      Serial.println("\n[SMS] SUCCESS! Delivered to mobile network.");
      return true;
    }
    if (response.indexOf("ERROR") >= 0 || response.indexOf("+CMS ERROR") >= 0) {
      Serial.println("\n[SMS] FAILED with error: " + response);
      return false;
    }
    delay(20);
  }

  Serial.println("\n[SMS] TIMEOUT: No response from network.");
  return false;
}

bool sendSMS(const String &message) {
  if (String(PHONE_NUMBER).indexOf('X') >= 0) {
    Serial.println("Set PHONE_NUMBER before sending SMS.");
    showStatus("SMS NOT SENT", "Set phone number", "in the code");
    return false;
  }

  // First try with formatted number (e.g. +918310678885)
  if (sendSingleSMS(PHONE_NUMBER, message)) {
    return true;
  }

  // If first attempt failed and number starts with '+91', retry with 10 digits directly
  String rawNum = String(PHONE_NUMBER);
  if (rawNum.startsWith("+91")) {
    String tenDigits = rawNum.substring(3);
    Serial.println("\n[SMS] Retrying with 10-digit format: " + tenDigits);
    if (sendSingleSMS(tenDigits.c_str(), message)) {
      return true;
    }
  }

  return false;
}

// ---------- GPS MESSAGE (Kept strictly under 140 chars for single-part GSM SMS) ----------

String makeAccidentMessage() {
  String msg = "CRASHSENSE ALERT!\nVehicle: Innova (KA13AB1234)\nOwner: Rahul";
  if (gps.location.isValid() && gps.location.age() < 10000) {
    double lat = gps.location.lat();
    double lon = gps.location.lng();
    msg += "\nMap: https://maps.google.com/?q=" + String(lat, 5) + "," + String(lon, 5);
  } else {
    msg += "\nLocation: GPS searching satellites";
  }
  return msg;
}

// ---------- CLOUD SEND VIA A7672S HTTP ----------

bool sendToCloud(float lat, float lon, float gForce) {
  Serial.println("\n--- Sending to Cloud Dashboard ---");
  showStatus("Sending to cloud...", "Please wait");

  // Build accident ID: ACC-ESP01-NNNNN
  char accId[30];
  int currentId = accidentCounter++;
  prefs.putInt("counter", accidentCounter);
  sprintf(accId, "ACC-ESP01-%05d", currentId);

  // Build JSON body with vehicle model & owner description
  char jsonBody[280];
  if (lat != 0.0 && lon != 0.0) {
    sprintf(jsonBody,
      "{\"accident_id\":\"%s\",\"latitude\":%.6f,\"longitude\":%.6f,"
      "\"gps_valid\":true,\"acceleration_g\":%.2f,\"accident_status\":\"DETECTED\","
      "\"description\":\"Innova - Owner: Rahul\"}",
      accId, lat, lon, gForce);
  } else {
    sprintf(jsonBody,
      "{\"accident_id\":\"%s\",\"latitude\":null,\"longitude\":null,"
      "\"gps_valid\":false,\"acceleration_g\":%.2f,\"accident_status\":\"DETECTED\","
      "\"description\":\"Innova - Owner: Rahul\"}",
      accId, gForce);
  }

  int bodyLen = strlen(jsonBody);
  Serial.print("JSON: ");
  Serial.println(jsonBody);

  String r;

  // -- Step 1: Ensure data connection --
  // Set APN (safe to repeat)
  modemCommand("AT+CGDCONT=1,\"IP\",\"" + String(MODEM_APN) + "\"", 1000);

  // Open network (ignore error if already open)
  r = modemCommand("AT+NETOPEN", 5000);
  // NETOPEN returns "OK" or "Network already opened" or "+NETOPEN: 0" — all acceptable

  // -- Step 2: Close any previous HTTP session --
  modemCommand("AT+HTTPTERM", 1000);
  delay(500);

  // -- Step 3: Init HTTP --
  r = modemCommand("AT+HTTPINIT", 2000);
  if (r.indexOf("OK") < 0) {
    Serial.println("HTTPINIT failed: " + r);
    return false;
  }

  // -- Step 4: Set full HTTPS URL --
  String url = "https://" + String(CLOUD_HOST) + String(CLOUD_PATH);
  r = modemCommand("AT+HTTPPARA=\"URL\",\"" + url + "\"", 2000);
  if (r.indexOf("OK") < 0) { Serial.println("URL set failed."); modemCommand("AT+HTTPTERM", 500); return false; }

  // -- Step 5: Set Content-Type --
  modemCommand("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 1000);

  // -- Step 6: Set Device Auth Header --
  // The backend accepts: Authorization: Device <ID>:<KEY>
  String authHeader = "Authorization: Device " + String(DEVICE_ID) + ":" + String(DEVICE_KEY);
  modemCommand("AT+HTTPPARA=\"USERDATA\",\"" + authHeader + "\"", 1000);

  // -- Step 6B: Configure SSL for Cloudflare (TLS 1.2 + SNI + No Cert Check) --
  modemCommand("AT+CSSLCFG=\"sslversion\",0,4", 1000);
  modemCommand("AT+CSSLCFG=\"authmode\",0,0", 1000);
  modemCommand("AT+CSSLCFG=\"enableSNI\",0,1", 1000);
  modemCommand("AT+HTTPPARA=\"SSLCFG\",0", 1000);

  // -- Step 7: Send body length, wait for DOWNLOAD prompt --
  while (Modem_Serial.available()) Modem_Serial.read();
  Serial.print("MODEM >> AT+HTTPDATA=");
  Serial.println(bodyLen);
  Modem_Serial.print("AT+HTTPDATA=");
  Modem_Serial.print(bodyLen);
  Modem_Serial.print(",10000\r\n");

  String prompt = "";
  unsigned long started = millis();
  while (millis() - started < 5000) {
    while (Modem_Serial.available()) {
      char c = (char)Modem_Serial.read();
      prompt += c;
    }
    if (prompt.indexOf("DOWNLOAD") >= 0) break;
    delay(10);
  }
  Serial.print("MODEM << ");
  Serial.println(prompt);

  if (prompt.indexOf("DOWNLOAD") < 0) {
    Serial.println("No DOWNLOAD prompt from modem: " + prompt);
    modemCommand("AT+HTTPTERM", 500);
    return false;
  }

  // -- Step 8: Send JSON body --
  Serial.println("MODEM >> Sending JSON body...");
  Modem_Serial.print(jsonBody);
  delay(1500); // give modem time to absorb data

  // -- Step 9: Execute HTTP POST (action=1) --
  Serial.println("MODEM >> AT+HTTPACTION=1");
  while (Modem_Serial.available()) Modem_Serial.read();
  Modem_Serial.print("AT+HTTPACTION=1\r\n");

  r = "";
  started = millis();
  while (millis() - started < 30000) { // wait up to 30s for cellular TLS + HTTP response
    while (Modem_Serial.available()) {
      r += (char)Modem_Serial.read();
    }
    if (r.indexOf("+HTTPACTION:") >= 0) break;
    delay(10);
  }
  Serial.print("MODEM << ");
  Serial.println(r);

  // Response contains: +HTTPACTION: 1,<status_code>,<data_len>
  bool success = false;
  if (r.indexOf("+HTTPACTION: 1,201") >= 0 ||
      r.indexOf("+HTTPACTION: 1,200") >= 0) {
    success = true;
    Serial.println("Cloud upload SUCCESS (accident_id=" + String(accId) + ")");
    showStatus("Dashboard updated!", accId, "Check website now");
  } else if (r.indexOf("+HTTPACTION: 1,") >= 0) {
    // Extract status code for debug
    int idx = r.indexOf("+HTTPACTION: 1,") + 15;
    String code = r.substring(idx, idx + 3);
    Serial.println("Cloud returned HTTP " + code);
    showStatus("Cloud error", ("HTTP: " + code).c_str(), "Check Serial");
  } else {
    Serial.println("No HTTPACTION response.");
    showStatus("Cloud timeout", "No response", "Check modem/SIM");
  }

  // -- Step 10: Terminate HTTP --
  modemCommand("AT+HTTPTERM", 1000);
  return success;
}

// ---------- CANCEL BUTTON ----------

bool buttonPressed() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(30);
    return digitalRead(BUTTON_PIN) == LOW;
  }
  return false;
}

// ---------- SETUP ----------

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("\nVehicle Safety System Starting");

  // Load persistent accident counter
  prefs.begin("crashsense", false);
  accidentCounter = prefs.getInt("counter", 1);
  if (accidentCounter < 1) accidentCounter = 1;
  Serial.print("Next Accident Counter: ");
  Serial.println(accidentCounter);

  // MPU I2C
  Wire.begin(MPU_SDA, MPU_SCL);
  Wire.setClock(100000);
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() == 0) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x6B);
    Wire.write(0x00);
    mpuReady = (Wire.endTransmission() == 0);
  }
  Serial.println(mpuReady ? "Accelerometer OK." : "Accelerometer not found!");

  // OLED I2C
  OLED_I2C.begin(OLED_SDA, OLED_SCL, 100000);
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR, false, false);
  if (oledReady) { showStatus("Starting system..."); }
  else { Serial.println("OLED init failed."); }

  // GPS UART
  GPS_Serial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("GPS UART started.");

  // Modem UART
  Modem_Serial.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(1500);

  String modemResponse = modemCommand("AT", 2000);
  modemReady = modemResponse.indexOf("OK") >= 0;

  if (modemReady) {
    modemCommand("ATE0",    1000);
    modemCommand("AT+CMEE=2", 1000); // Verbose error codes (+CMS ERROR)
    modemCommand("AT+CMGF=1", 1000); // SMS Text Mode
    modemCommand("AT+CSCS=\"GSM\"", 1000); // GSM character set
    modemCommand("AT+CGSMS=1", 1000); // Route SMS over Packet Domain (LTE) for Jio & 4G
    modemCommand("AT+CPMS=\"SM\",\"SM\",\"SM\"", 1000); // Preferred SMS storage on SIM
    modemCommand("AT+CSMP=17,167,0,0", 1000);
    Serial.println("Modem OK (SMS initialized for 4G/Jio).");
  } else {
    Serial.println("Modem not responding. Check UART/power.");
  }

  showStatus(
    mpuReady   ? "Sensor ready"       : "Sensor error",
    modemReady ? "Modem responding"   : "Modem error",
    "GPS searching..."
  );

  Serial.println("System ready.");
}

// ---------- MAIN LOOP ----------

void loop() {
  // Always parse GPS
  while (GPS_Serial.available()) gps.encode(GPS_Serial.read());

  // Read sensor every 100ms
  if (millis() - lastSensorRead >= 100) {
    lastSensorRead = millis();

    if (mpuReady && readMPU()) {
      Serial.printf("AX:%.2f AY:%.2f AZ:%.2f Total:%.2f g\n", axG, ayG, azG, totalG);

      if (!alarmPending && !alarmSent && totalG >= IMPACT_THRESHOLD_G) {
        alarmPending = true;
        alarmStart   = millis();
        digitalWrite(BUZZER_PIN, HIGH);
        showStatus("IMPACT DETECTED!", "Press button to", "cancel in 10s");
        Serial.printf("Impact detected! %.2fg\n", totalG);
      }
    }
  }

  // Alarm countdown
  if (alarmPending) {
    digitalWrite(BUZZER_PIN, HIGH);

    if (buttonPressed()) {
      // Driver cancelled — false alarm
      alarmPending = false;
      digitalWrite(BUZZER_PIN, LOW);
      showStatus("ALERT CANCELLED", "Driver responded");
      Serial.println("Alarm cancelled by driver.");
      delay(1000);

    } else if (millis() - alarmStart >= CANCEL_WINDOW_MS) {
      // 10 seconds passed — real accident
      alarmPending = false;

      // Get GPS coordinates
      float lat = 0.0, lon = 0.0;
      bool  gpsOk = false;
      if (gps.location.isValid() && gps.location.age() < 10000) {
        lat   = gps.location.lat();
        lon   = gps.location.lng();
        gpsOk = true;
      }

      float impactG = totalG; // capture peak G at time of alarm

      // 1. Send SMS alert to phone number
      showStatus("Sending SMS...");
      String smsMsg = makeAccidentMessage();
      Serial.println(smsMsg);
      bool smsSent = sendSMS(smsMsg);

      // 2. Send accident data to website dashboard via 4G HTTP
      showStatus("Sending to cloud...");
      bool cloudSent = sendToCloud(lat, lon, impactG);

      // Update OLED with result
      alarmSent = true;
      if (smsSent && cloudSent) {
        digitalWrite(BUZZER_PIN, LOW);
        showStatus("SMS + Dashboard", "both updated!", "System monitoring");
      } else if (cloudSent) {
        digitalWrite(BUZZER_PIN, LOW);
        showStatus("Dashboard updated", "SMS failed", "Check modem");
      } else if (smsSent) {
        digitalWrite(BUZZER_PIN, LOW);
        showStatus("SMS sent", "Cloud failed", "Check internet");
      } else {
        digitalWrite(BUZZER_PIN, HIGH); // keep buzzer on if both failed
        showStatus("BOTH FAILED", "Buzzer ON", "Check modem/SIM");
      }
    }
  }

  // Normal idle display
  if (!alarmPending && !alarmSent && millis() - lastDisplay >= 1000) {
    lastDisplay = millis();
    if (gps.location.isValid() && gps.location.age() < 10000) {
      showStatus(mpuReady ? "Monitoring" : "Sensor error", "GPS: FIXED", "Ready");
    } else {
      showStatus(mpuReady ? "Monitoring" : "Sensor error", "GPS: SEARCHING", "Keep antenna clear");
    }
  }

  delay(5);
}

