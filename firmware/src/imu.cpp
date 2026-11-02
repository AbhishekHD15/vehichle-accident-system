#include "imu.h"
#include "config.h"
#include <Preferences.h>
#include <math.h>

bool Imu::wr(uint8_t reg, uint8_t v) {
  w_->beginTransmission(addr_); w_->write(reg); w_->write(v);
  return w_->endTransmission() == 0;
}
bool Imu::rd(uint8_t reg, uint8_t* buf, size_t n) {
  w_->beginTransmission(addr_); w_->write(reg);
  if (w_->endTransmission(false) != 0) return false;
  if (w_->requestFrom((int)addr_, (int)n) != (int)n) return false;
  for (size_t i = 0; i < n; i++) buf[i] = w_->read();
  return true;
}

bool Imu::begin(TwoWire& w, uint8_t addr) {
  w_ = &w; addr_ = addr;
  if (!rd(0x75, &who_, 1)) return false;                 // WHO_AM_I
  switch (who_) {
    case 0x68: variant_ = "MPU6050"; break;
    case 0x72: variant_ = "MPU6050 (clone/variant)"; break;
    case 0x98: variant_ = "MPU6050 (clone/variant)"; break;
    case 0x70: variant_ = "MPU6500"; break;
    case 0x71: variant_ = "MPU9250"; break;
    case 0x73: variant_ = "MPU9255"; break;
    default:   variant_ = "UNKNOWN (accel/gyro registers assumed MPU-compatible)"; break;
  }
  wr(0x6B, 0x80); delay(100);                            // device reset
  wr(0x6B, 0x01); delay(10);                             // wake, PLL clock
  wr(0x19, 0x00);                                        // SMPLRT_DIV
  wr(0x1A, 0x01);                                        // CONFIG: gyro DLPF 184 Hz
  wr(0x1B, 0x18);                                        // GYRO +-2000 dps
  wr(0x1C, 0x18);                                        // ACCEL +-16 g
  if (who_ == 0x70 || who_ == 0x71 || who_ == 0x73) wr(0x1D, 0x01);  // ACCEL_CONFIG2 (6500/9250 only): 184 Hz DLPF
  delay(50);
  Preferences p; p.begin("imu", true);                   // restore saved calibration if any
  accScale_ = p.getFloat("as", 1.0f);
  gBias_[0] = p.getFloat("gx", 0); gBias_[1] = p.getFloat("gy", 0); gBias_[2] = p.getFloat("gz", 0);
  p.end();
  return true;
}

bool Imu::read(ImuSample& s) {
  uint8_t b[14];
  if (!rd(0x3B, b, 14)) return false;
  auto i16 = [&](int i) { return (int16_t)((b[i] << 8) | b[i + 1]); };
  s.ax = i16(0) / ACC_LSB_PER_G * accScale_;
  s.ay = i16(2) / ACC_LSB_PER_G * accScale_;
  s.az = i16(4) / ACC_LSB_PER_G * accScale_;
  s.gx = i16(8) / GYRO_LSB_PER_DPS - gBias_[0];
  s.gy = i16(10) / GYRO_LSB_PER_DPS - gBias_[1];
  s.gz = i16(12) / GYRO_LSB_PER_DPS - gBias_[2];
  s.mag = sqrtf(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
  s.t_us = micros();
  return true;
}

bool Imu::calibrate() {
  accScale_ = 1.0f; gBias_[0] = gBias_[1] = gBias_[2] = 0;
  double sa[3] = {0}, sg[3] = {0}, qa = 0, qg = 0; int n = 0;
  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    uint8_t b[14];
    if (!rd(0x3B, b, 14)) continue;
    auto i16 = [&](int k) { return (int16_t)((b[k] << 8) | b[k + 1]); };
    float a[3] = { i16(0) / ACC_LSB_PER_G, i16(2) / ACC_LSB_PER_G, i16(4) / ACC_LSB_PER_G };
    float g[3] = { i16(8) / GYRO_LSB_PER_DPS, i16(10) / GYRO_LSB_PER_DPS, i16(12) / GYRO_LSB_PER_DPS };
    for (int k = 0; k < 3; k++) { sa[k] += a[k]; sg[k] += g[k]; qa += a[k] * a[k]; qg += g[k] * g[k]; }
    n++; delay(5);
  }
  Preferences p;
  if (n < CALIBRATION_SAMPLES / 2) { p.begin("imu", true); accScale_ = p.getFloat("as", 1.0f); p.end(); return false; }
  double ma[3], mg[3];
  for (int k = 0; k < 3; k++) { ma[k] = sa[k] / n; mg[k] = sg[k] / n; }
  double magMean = sqrt(ma[0] * ma[0] + ma[1] * ma[1] + ma[2] * ma[2]);
  double varA = qa / n - (ma[0] * ma[0] + ma[1] * ma[1] + ma[2] * ma[2]);
  double varG = qg / n - (mg[0] * mg[0] + mg[1] * mg[1] + mg[2] * mg[2]);
  bool still = sqrt(max(varA, 0.0)) < CAL_MAX_ACC_STD_G && sqrt(max(varG, 0.0)) < CAL_MAX_GYRO_STD_DPS
               && magMean > 0.8 && magMean < 1.2;
  if (!still) {  // moving or implausible: keep previously stored calibration
    p.begin("imu", true);
    accScale_ = p.getFloat("as", 1.0f);
    gBias_[0] = p.getFloat("gx", 0); gBias_[1] = p.getFloat("gy", 0); gBias_[2] = p.getFloat("gz", 0);
    p.end();
    return false;
  }
  accScale_ = (float)(1.0 / magMean);
  for (int k = 0; k < 3; k++) gBias_[k] = (float)mg[k];
  p.begin("imu", false);
  p.putFloat("as", accScale_); p.putFloat("gx", gBias_[0]); p.putFloat("gy", gBias_[1]); p.putFloat("gz", gBias_[2]);
  p.end();
  return true;
}
