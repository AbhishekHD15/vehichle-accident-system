#pragma once
// Copy to secrets.h (git-ignored) and fill in. NEVER commit secrets.h.
// The ESP32 only holds the DEVICE credential created by the admin dashboard — never DB credentials.
#define DEVICE_ID        "ESP01"                       // as registered in the admin dashboard
#define DEVICE_KEY       "paste-device-key-here"
#define API_BASE_URL     "https://YOUR-API.example.com/api/v1"
#define API_HOST_PATH_ACCIDENTS     "/device/accidents"
#define API_HOST_PATH_HEARTBEAT     "/device/heartbeat"
#define API_HOST_PATH_NOTIF_STATUS  "/device/notifications/status"

#define VEHICLE_REG      "KA-13-AB-1234"
#define OWNER_NAME       "Vehicle Owner"

// Phone numbers in international format. Keep SMS independent of the cloud.
static const char* FAMILY_NUMBERS[]     = { "+919999999991", "+919999999992" };
static const int   FAMILY_COUNT         = 2;              // max 3
static const char* INSURANCE_NUMBER     = "+919999999993";
static const char* EMERGENCY_CALL_NUMBERS[] = { "+919999999991" };  // set count 0 to disable calls
static const int   EMERGENCY_CALL_COUNT = 1;              // max 2
