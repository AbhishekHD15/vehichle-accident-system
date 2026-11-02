#pragma once
void uiTaskStart();                 // OLED runs on its own task + I2C bus so it never delays sensor sampling
void buzzerBegin();
void buzzerUpdate(int mode, unsigned long now);   // non-blocking beep patterns
