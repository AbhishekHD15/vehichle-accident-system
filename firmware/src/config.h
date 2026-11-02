#pragma once
// ===================== Tunable parameters =====================
// !! Detection thresholds are PLACEHOLDERS. Calibrate them with controlled bench tests
// !! (drop-pad / hand-shake rig). Never crash-test a real vehicle.
#define FW_VERSION              "1.0.0"

// ---- MPU6050 / MPU6500 sampling & detection ----
#define SAMPLE_PERIOD_US        5000     // 200 Hz
#define IMPACT_G                4.0f     // magnitude that opens a validation window
#define JERK_G_PER_S            150.0f   // sudden change in acceleration
#define GYRO_DPS_THRESHOLD      250.0f   // violent rotation
#define ORIENT_CHANGE_DEG       45.0f    // orientation change (tilt / rollover) across the event
#define VALIDATION_MS           400      // observation window after first threshold crossing
#define MIN_IMPACT_SAMPLES      3        // samples >= IMPACT_G inside window (impact duration ~15 ms)
#define MIN_SCORE               4        // 2 base points + at least 2 supporting indicators
#define COOLDOWN_MS             30000    // ignore new triggers after an event
#define CALIBRATION_SAMPLES     400      // ~2 s, vehicle must be stationary
#define CAL_MAX_ACC_STD_G       0.05f
#define CAL_MAX_GYRO_STD_DPS    3.0f

// ---- Driver cancellation ----
#define CANCEL_WINDOW_MS        10000
#define BUTTON_DEBOUNCE_MS      40
#define BUTTON_ARM_GUARD_MS     300      // ignore presses right after the alarm starts (accidental / held)

// ---- GPS ----
#define GPS_BAUD                9600
#define GPS_FIX_TIMEOUT_MS      15000    // max extra wait for a fix after the countdown
#define GPS_MAX_AGE_MS          120000   // a fix older than this is not "valid"

// ---- Modem ----
#define MODEM_BAUD              115200   // configurable: check with AT+IPR?
#define MODEM_APN               "internet"       // <-- set your operator's APN
#define MODEM_REG_TIMEOUT_MS    60000
#define SMS_MAX_TRIES           3
#define SMS_RETRY_BACKOFF_MS    30000
#define SMS_DELIVERY_WAIT_MS    600000   // how long to wait for a delivery report
#define CALL_RING_MS            25000
#define CALL_MAX_TRIES          1        // never call indefinitely
#define UPLOAD_BACKOFF_MIN_MS   10000
#define UPLOAD_BACKOFF_MAX_MS   600000
#define HEARTBEAT_MS            60000
#define SHORT_SMS               0        // 1 => force single-part (<=160 chars) messages

// ---- AT command variants (VERIFY against the A76XX AT command manual for YOUR firmware) ----
#define HTTP_READ_CMD_FMT       "AT+HTTPREAD=0,%d"
#define SSL_ENABLE              1        // 1 = HTTPS with server certificate validation
#define SSL_CA_FILE             "ca.pem" // uploaded once with provisionCaCert()
