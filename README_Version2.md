# 🧍 AI Posture Guard

A real-time AI-powered web application that uses your device's camera to detect and monitor your sitting posture, provide instant feedback, track posture scores, and remind you to take breaks.

---

## 🚀 Features

- 📷 **Live Camera Feed** — Uses your webcam to analyze posture in real time
- ✅ / ❌ **Good / Bad Posture Detection** — Instant on-screen feedback
- 💡 **Posture Suggestions** — Actionable tips to correct your posture
- 📊 **Posture Score** — Live score updated based on posture quality
- 🔢 **Bad Posture Count** — Tracks how many times bad posture is detected
- ⏱️ **Sitting Time Tracker** — Monitors how long you've been sitting
- 🔔 **Break Reminder** — Alerts you to take a break if sitting for more than 10 minutes

---

## 🖥️ Demo UI Preview

```
┌─────────────────────────────────────────────┐
│          🧍 AI Posture Guard                │
├───────────────────┬─────────────────────────┤
│                   │  Status: ❌ Bad Posture  │
│   [ Camera Feed ] │  Suggestion: Sit up     │
│                   │  straight & align your  │
│                   │  spine with the chair.  │
│                   ├─────────────────────────┤
│                   │  Posture Score:   72/100│
│                   │  Bad Posture Count:  5  │
│                   │  Sitting Time:  00:12:34│
│                   ├─────────────────────────┤
│                   │  ⚠️ Take a break and    │
│                   │     stretch!            │
└───────────────────┴─────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | HTML5, CSS3, JavaScript (Vanilla)   |
| AI/ML        | [TensorFlow.js](https://www.tensorflow.org/js) + [MoveNet / PoseNet](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) |
| Camera API   | WebRTC (`getUserMedia`)             |
| Hosting      | GitHub Pages / Vercel / Netlify     |

---

## 📁 Project Structure

```
ai-posture-guard/
│
├── index.html          # Main HTML layout
├── style.css           # Styling & UI
├── app.js              # Core app logic (camera, posture detection, timers)
├── posture.js          # Posture analysis logic using keypoints
├── alerts.js           # Break reminder & notification logic
├── assets/
│   ├── icons/          # UI icons
│   └── sounds/         # Alert sounds (optional)
└── README.md           # Project documentation
```

---

## ⚙️ How It Works

```
Camera Feed (WebRTC)
        ↓
TensorFlow.js (MoveNet / BlazePose)
        ↓
Extract Body Keypoints (shoulders, ears, hips, spine)
        ↓
Posture Analysis Engine
        ↓
  ┌─────────────────────────────────────┐
  │  Calculate angles between:          │
  │  - Head tilt vs. shoulders          │
  │  - Shoulder slope                   │
  │  - Hip-to-shoulder vertical offset  │
  └─────────────────────────────────────┘
        ↓
  Good / Bad Posture Decision
        ↓
Update UI (Status, Score, Count, Timer, Alert)
```

### Posture Rules Engine

| Keypoint Check              | Good Posture        | Bad Posture              |
|-----------------------------|---------------------|--------------------------|
| Head vs. Shoulder alignment | Head above center   | Head tilted forward/side |
| Shoulder level              | Both shoulders even | One shoulder higher      |
| Spine angle                 | ≤ 10° lean          | > 10° forward lean       |
| Ear-Shoulder-Hip angle      | ~160°–180°          | < 150°                   |

---

## 📊 Dashboard Metrics

| Metric             | Description                                                   |
|--------------------|---------------------------------------------------------------|
| **Posture Status** | `✅ Good Posture` or `❌ Bad Posture`                         |
| **Suggestion**     | Tip displayed when bad posture is detected                    |
| **Posture Score**  | Starts at 100, decreases with bad posture, recovers over time |
| **Bad Posture Count** | Total number of bad posture detections in this session     |
| **Sitting Time**   | Elapsed time since session started (HH:MM:SS)                 |
| **Break Alert**    | ⚠️ Warning shown after 10 minutes of continuous sitting       |

---

## 💡 Posture Suggestions

Suggestions are shown dynamically based on the detected issue:

| Detected Issue         | Suggestion                                                  |
|------------------------|-------------------------------------------------------------|
| Head tilted forward    | Align your head directly above your shoulders.             |
| Slouching spine        | Sit up straight with your back against the chair.          |
| Uneven shoulders       | Level your shoulders and avoid leaning to one side.        |
| General bad posture    | Keep your feet flat on the floor and screen at eye level.  |

---

## 🔔 Break Reminder

If **Sitting Time exceeds 10 minutes**, the app will:

- 🟡 Show a prominent on-screen alert:  
  > *"⚠️ You've been sitting for over 10 minutes — Take a break and stretch!"*
- 🔁 Reminder resets once the user clicks **"I Stretched! ✅"**
- 🔔 Optional browser notification (with permission)

---

## 🧑‍💻 Getting Started

### Prerequisites

- A modern browser (Chrome, Edge, Firefox)
- Webcam / device camera
- Internet connection (for loading TensorFlow.js CDN)

### Installation

```bash
# Clone the repository
git clone https://github.com/OpelSpeedster/ai-posture-guard.git

# Navigate to the project folder
cd ai-posture-guard

# Open in browser (no build step needed)
open index.html
```

Or simply open `index.html` in your browser directly.

---

## 🔐 Privacy

- **No data is sent to any server.**
- All posture analysis is done **100% in the browser** using TensorFlow.js.
- Camera access is only used locally and never recorded or stored.

---

## 🗺️ Roadmap

- [x] Real-time posture detection via webcam
- [x] Good/Bad posture status display
- [x] Posture suggestions
- [x] Posture score tracker
- [x] Bad posture counter
- [x] Sitting time tracker
- [x] Break reminder after 10 minutes
- [ ] Historical posture session reports
- [ ] Customizable break interval settings
- [ ] Mobile (portrait mode) support
- [ ] Dark mode UI
- [ ] Export posture report as PDF

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**OpelSpeedster**  
GitHub: [@OpelSpeedster](https://github.com/OpelSpeedster)

---

> *Sit smart. Stay healthy. Let AI watch your back — literally.* 🧠💪