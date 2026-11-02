#include "ui.h"
#include "pins.h"
#include "status.h"
#include "accident_fsm.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

static Adafruit_SSD1306 oled(128, 64, &Wire1, -1);

static void drawTask(void*) {
  bool ok = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  for (;;) {
    if (ok) {
      oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE); oled.setTextSize(1); oled.setCursor(0, 0);
      switch (g_status.fsm) {
        case FSM_COUNTDOWN:
          oled.setTextSize(2); oled.println("ACCIDENT!"); oled.setTextSize(1);
          oled.printf("Press button to cancel\n"); oled.setTextSize(3); oled.printf("  %d s", g_status.countdownSec); break;
        case FSM_WAIT_GPS: oled.setTextSize(2); oled.println("SENDING"); oled.setTextSize(1); oled.println("Acquiring GPS..."); break;
        case FSM_VALIDATING: oled.println("Impact detected"); oled.println("Validating..."); break;
        default:
          oled.println(g_status.fsm == FSM_COOLDOWN ? (g_status.lastResult == 1 ? "ALERT CANCELLED" : "ALERT DISPATCHED") : "Monitoring");
          oled.printf("GPS: %s (%u sat)\n", g_status.gpsValid ? "FIX" : "no fix", g_status.sats);
          oled.printf("Net: %s CSQ:%d\n", g_status.netReg ? "OK" : "offline", g_status.csq);
          oled.printf("Queue: %u pending\n", g_status.pending);
          if (g_status.accidentId[0]) oled.printf("%s\n", g_status.accidentId);
      }
      oled.display();
    }
    vTaskDelay(pdMS_TO_TICKS(250));
  }
}

void uiTaskStart() {
  Wire1.begin(PIN_OLED_SDA, PIN_OLED_SCL, 400000);   // OLED on its own I2C bus (per wiring spec)
  xTaskCreatePinnedToCore(drawTask, "oled", 4096, nullptr, 1, nullptr, 0);
}

void buzzerBegin() { pinMode(PIN_BUZZER, OUTPUT); digitalWrite(PIN_BUZZER, LOW); }

void buzzerUpdate(int mode, unsigned long now) {   // assumes an ACTIVE buzzer (on = HIGH)
  bool on = false;
  switch (mode) {
    case BUZ_COUNTDOWN: on = (now % 400) < 200; break;
    case BUZ_CANCELLED: on = (now % 1000) < 120; break;
    case BUZ_DISPATCHED: on = (now % 1000) < 700; break;
    default: on = false;
  }
  digitalWrite(PIN_BUZZER, on ? HIGH : LOW);
}
