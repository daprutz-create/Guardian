# GUARDIAN v3 — WiFi Network Security & Remote Management App
### Android · React Native

---

## What This App Does

**SCAN TAB**
- Scans all 254 hosts on your current WiFi subnet
- Detects open ports (20+ port types)
- Live threat level indicator (Clear / Medium / High)
- **Continuous Scan Mode** — runs non-stop, re-scanning automatically
- Devices sorted by threat level

**DEVICE DETAIL (tap any device)**
- 🔬 DEEP PROBE — fingerprint vendor, test credentials, UPnP, full vuln report
- 🔍 Fingerprinting — identifies TP-Link, Netgear, Hikvision, ASUS, and 20+ vendors
- 📡 UPnP Discovery — model, manufacturer, serial, all advertised services
- 🔑 Default Credential Check — tests 14 common default passwords
- ⚠️ Vulnerability Report — scored 0-100, categorised critical/high/medium/low
- 🌐 View Web UI — opens device admin interface in built-in browser
- ⚡ Remote Control — shutdown/restart/sleep (requires agent setup)

**REQUEST DESIGNER**
- Fully customisable access requests sent to device owners
- Choose: View / File Access / Remote Control / Full Access
- Custom name, message, reason, timeout
- Save preset profiles
- Preview before sending
- Consent-based: device owner sees and approves/denies

**SECURITY TAB**
- 10-point home network hardening checklist
- Severity-rated recommendations

**SETTINGS TAB**
- Default request profile management
- Pre-approved devices list
- Agent setup instructions

---

## Install Requirements

### On your computer:
1. **Node.js v18+** → https://nodejs.org
2. **JDK 17** → https://adoptium.net
3. **Android Studio** → https://developer.android.com/studio
   - Install: Android SDK, SDK Platform API 33+, AVD

```bash
npm install -g react-native-cli
```

### Environment variables (add to ~/.bashrc or ~/.zshrc):
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

---

## Running on Your Phone

### Step 1 — Enable Developer Mode on Android
- Settings → About Phone → tap Build Number **7 times**
- Settings → Developer Options → enable **USB Debugging**

### Step 2 — Connect phone via USB
```bash
adb devices   # should list your phone
```

### Step 3 — Install and run
```bash
# In this project folder:
npm install
npm start          # keep this terminal open

# In a NEW terminal:
npm run android    # builds and installs to your phone (~5 min first time)
```

---

## Build a Standalone APK

```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

Transfer the APK to your phone (via USB, email, or cloud) and install it.
You may need to enable "Install from unknown sources" in Android Settings.

---

## Enable Remote Control on Your Own Devices

For full remote shutdown/restart/sleep functionality:

**Windows PC:**
1. Settings → System → Remote Desktop → Enable
2. BIOS → Enable Wake on LAN
3. Device Manager → Network Adapter → Power Management → Allow wake

**Android Tablet/Phone:**
1. Settings → Developer Options → Enable USB Debugging
2. Enable Wireless ADB debugging (Android 11+)

**Linux:**
```bash
sudo apt install openssh-server
sudo systemctl enable ssh
```

**Router:**
- Log in at 192.168.1.1 (or check router label)
- Change default password
- Disable WPS
- Update firmware

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `SDK location not found` | Set ANDROID_HOME to your SDK path |
| `No devices` in adb | Try different cable; restart adb: `adb kill-server && adb start-server` |
| WiFi IP not detected | Accept Location permission when app asks |
| Build fails | `cd android && ./gradlew clean` then retry |
| App crashes on launch | Check Metro bundler is running (`npm start`) |

---

## Legal Notice
GUARDIAN is designed for use on networks you own or have explicit permission to scan.
Scanning networks without permission is illegal in most jurisdictions.
