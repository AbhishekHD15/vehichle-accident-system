# Testing

## Automated (backend)
`cd accident-cloud && pytest -q` — covers authentication & refresh rotation, device authentication, accident creation,
idempotent re-upload, "dispatched never becomes cancelled", GPS validation, retrieval/filters, RBAC isolation, claim
submission and status transitions (rejection reason, audit history), notification tracking/retry/masking, vehicle rules.

## Hardware integration procedure (do in order; record the result of each step — nothing is "verified" until you do)
1. **GPS**: monitor shows `GPS: FIX` outdoors; coordinates plausible; indoors shows "no fix" (never a fake location).
2. **IMU**: boot log prints WHO_AM_I + variant and "IMU calibrated". At rest |a| ≈ 1.00 g (add a debug print if needed).
3. **Detection FSM (bench)**: place on a padded drop rig / strike by hand against a cushion. Log peak g, jerk, gyro, tilt
   and tune `IMPACT_G`, `JERK_G_PER_S`, `GYRO_DPS_THRESHOLD`, `ORIENT_CHANGE_DEG`, `MIN_SCORE`. Also test false positives:
   knocking the enclosure, dropping on a desk, carrying while walking, and (static) vibration. **No real crash tests.**
4. **Cancellation**: trigger → press button within 10 s → OLED "CANCELLED", **no SMS/call**; dashboard shows CANCELLED.
   Hold the button *before* triggering → it must not cancel (must be released first). After the countdown ends the button does nothing.
5. **SMS**: let one alert dispatch to test numbers; check text, map link, one SMS per number, separate insurance text;
   dashboard shows SUBMITTED then DELIVERED (if the carrier sends reports).
6. **Modem/HTTPS**: heartbeat appears (device "Online" in admin). Pull the antenna → event queues; reconnect → uploads once.
7. **Upload**: event visible in `/docs` or DB; re-sending the same id creates no duplicate.
8. **Database**: `SELECT accident_id, accident_status FROM accidents;`
9. **Website**: owner/family/insurance/admin each see only what they should.
10. **Claims**: owner submits; insurance moves it IN_PROGRESS → APPROVED/REJECTED (reason required) → SETTLED; history is recorded.
