# Hardware notes

## Pins (from the spec)
| Component | ESP32 |
|---|---|
| GPS TX → ESP32 RX | GPIO 32 · GPS RX ← ESP32 TX GPIO 33 (UART1, 9600 baud) |
| MPU SDA/SCL | GPIO 21 / 22 (I²C bus 0, 0x68) |
| OLED SDA/SCL | GPIO 19 / 18 (I²C bus 1 = `Wire1`, 0x3C) |
| A7672S TXD → ESP32 RX | GPIO 16 · A7672S RXD ← ESP32 TX GPIO 17 (UART2) |
| Buzzer | GPIO 25 (assumes ACTIVE buzzer, HIGH = on; a passive buzzer needs `tone`/LEDC) |
| Button | GPIO 26 to GND, internal pull-up (pressed = LOW) |

## Modem power — do not skip
The A7672S can draw ~2 A bursts during transmission. **Never power it from the ESP32 3.3 V pin or USB-UART
adapter.** Use a regulated supply that matches your modem board's datasheet (many boards want 5 V / ≥2 A, bare
modules 3.4–4.2 V / ≥2 A) with a bulk capacitor (≥470 µF) near the modem. Common ground with the ESP32.
Check UART logic levels of your breakout (1.8 V vs 3.3 V) — add a level shifter if the board is 1.8 V.
Brown-outs/resets during SMS or HTTP almost always mean inadequate power.
Vehicle supply: use an automotive-rated buck converter with load-dump/transient protection.

## MPU WHO_AM_I = 0x70
`0x68` is the I²C **address**; WHO_AM_I (register 0x75) of a genuine MPU6050 is 0x68. A value of **0x70 identifies an
MPU-6500** (0x71 = MPU-9250). Accel/gyro registers used here (0x6B, 0x1A–0x1C, 0x3B…) are identical; the driver also writes
ACCEL_CONFIG2 (0x1D) only on 6500/9250 parts. The variant is printed at boot. Range: ±16 g / ±2000 dps (a real crash can
exceed 16 g → readings saturate at the top, which still reads as a very large impact).

## Mounting
Rigidly fix the IMU to the vehicle body (not a flexible dashboard). Run calibration with the vehicle stationary at boot.
