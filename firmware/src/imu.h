#pragma once
#include <Arduino.h>
#include <Wire.h>

struct ImuSample { float ax, ay, az, gx, gy, gz, mag; uint32_t t_us; };

// Register-level driver for MPU6050 / MPU6500 / MPU9250-class parts. WHO_AM_I decides the variant
// (the spec's board returned 0x70 = MPU-6500, which is register-compatible for accel/gyro).
class Imu {
 public:
  bool begin(TwoWire& w, uint8_t addr = 0x68);
  const char* variant() const { return variant_; }
  uint8_t whoAmI() const { return who_; }
  bool calibrate();                 // stationary calibration; falls back to stored values
  bool read(ImuSample& s);
 private:
  bool wr(uint8_t reg, uint8_t v);
  bool rd(uint8_t reg, uint8_t* buf, size_t n);
  TwoWire* w_ = nullptr; uint8_t addr_ = 0x68, who_ = 0; const char* variant_ = "unknown";
  float accScale_ = 1.0f;           // multiplies g so |a| = 1 g at rest
  float gBias_[3] = {0, 0, 0};
  static constexpr float ACC_LSB_PER_G = 2048.0f;   // +-16 g
  static constexpr float GYRO_LSB_PER_DPS = 16.4f;  // +-2000 dps
};
