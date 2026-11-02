#pragma once
// Wiring from the project specification. Verify against your board before powering up.
#define PIN_GPS_RX      32   // ESP32 RX  <- GPS TX
#define PIN_GPS_TX      33   // ESP32 TX  -> GPS RX
#define PIN_IMU_SDA     21
#define PIN_IMU_SCL     22
#define PIN_OLED_SDA    19
#define PIN_OLED_SCL    18
#define PIN_MODEM_RX    16   // ESP32 RX  <- A7672S TXD
#define PIN_MODEM_TX    17   // ESP32 TX  -> A7672S RXD
#define PIN_BUZZER      25
#define PIN_BUTTON      26   // wired to GND, INPUT_PULLUP (pressed = LOW)
