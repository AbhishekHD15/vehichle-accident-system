# A7672S AT-command verification checklist

The firmware only uses commands from the SIMCom A76XX-series command set, but **syntax and behaviour differ between module
firmware versions**. Verify each item with the passthrough mode (hold the button at power-up, then type in the serial monitor
with line ending "CR"). Consult the *A76XX Series AT Command Manual* matching `AT+CGMR`.

| Feature | Commands used (modem.cpp) | Check |
|---|---|---|
| Basic | `AT`, `ATE0`, `AT+CMEE=2`, `AT+CPIN?` | SIM READY |
| Network | `AT+CGDCONT=1,"IP","<apn>"`, `AT+CEREG?`/`CREG?`/`CGREG?`, `AT+CSQ` | registers (stat 1 or 5) |
| SMS | `AT+CMGF=1`, `AT+CSCS="GSM"`, `AT+CMGS="<n>"` + text + Ctrl-Z → `+CMGS: <mr>` | **long (>160 char) text-mode messages**: if not concatenated, set `SHORT_SMS 1` |
| Delivery reports | `AT+CSMP=49,167,0,0`, `AT+CNMI=2,1,0,1,0` → `+CDS: <fo>,<mr>,<ra>,<tora>,<scts>,<dt>,<st>` | send to a test phone; confirm a +CDS line arrives and `<st>`=0. Some operators never return reports → status stays SUBMITTED/UNKNOWN (by design) |
| Voice call | `ATD<n>;`, `ATH` | rings the phone, hangs up after `CALL_RING_MS` |
| HTTP(S) | `AT+HTTPINIT`, `AT+HTTPPARA="URL"/"CONTENT"/"USERDATA"/"SSLCFG"`, `AT+HTTPDATA=<len>,<ms>` → `DOWNLOAD`, `AT+HTTPACTION=1` → `+HTTPACTION: 1,<code>,<len>`, `AT+HTTPREAD=0,<len>`, `AT+HTTPTERM` | run against `https://<api>/health` first (use GET via `HTTPACTION=0`) |
| TLS | `AT+CSSLCFG="sslversion"/"authmode"/"cacert"/"enableSNI",0,…`, `AT+CCERTDOWN="ca.pem",<len>` | authmode 1 + CA file ⇒ server certificate validated. **Do not ship with validation disabled** |
| Clock | `AT+CTZU=1` | certificate validation needs a valid modem clock (`AT+CCLK?`) |

Points most likely to need adjustment: the `USERDATA` header syntax (firmware sends one header,
`Authorization: Device <id>:<key>`, accepted by the backend), the `SSLCFG` binding command, and `HTTPREAD` format
(`HTTP_READ_CMD_FMT`). Upload the CA certificate once (root CA of your API host's chain, e.g. ISRG Root X1 for Let's Encrypt)
via `modem.provisionCaCert(pem)` (call it once from a temporary sketch/passthrough).
