# 🏎️ Formulane: Live F1 Monitoring

**Formulane** is a high-performance Chrome extension designed for Formula 1 fans who want to stay updated with real-time race data, telemetry, and race control alerts directly from their browser.

![Version](https://img.shields.io/badge/version-1.0-red)
![Platform](https://img.shields.io/badge/platform-Chrome-blue)

---

## 🌟 Features

- **Live Telemetry**: Track driver positions and team performance in real-time.
- **Race Control Alerts**: Get immediate updates on DRS, penalties, investigations, and safety car status.
- **Smart Notifications**:
  - **Session Start**: Never miss the beginning of a race or qualifying.
  - **Leader Changes**: Instant alerts when P1 changes hands.
  - **Track Incidents**: Real-time flags (Yellow, Red, SC, VSC).
- **Internationalization (i18n)**: Fully localized in English, Spanish, French, Chinese, and more.
- **Customizable Dashboard**: Adjust refresh intervals and the number of drivers displayed.
- **Premium Aesthetics**: Dark-themed, glassmorphism UI inspired by modern F1 broadcast graphics.

## 🛠️ Technical Stack

- **Core**: Vanilla JavaScript (Manifest V3)
- **Styling**: Modern CSS3 with CSS Variables and Glassmorphism
- **API**: Powered by [OpenF1 API](https://openf1.org/)
- **Storage**: `chrome.storage.local` for settings and heavy caching to respect API limits.

## 📂 Project Structure

```text
Formulane/
├── _locales/          # Localization files (i18n)
├── icons/             # Extension assets and logos
├── src/
│   ├── background.js  # Service worker (Data syncing & Notifications)
│   ├── popup/         # Main extension UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── options/       # Settings & documentation
│       ├── options.html
│       ├── options.css
│       └── options.js
├── manifest.json      # Extension configuration
└── README.md          # You are here!
```

---

## 🚀 Getting Started

### Installation for Developers

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/formulane.git
    ```
2.  **Load the extension in Chrome**:
    - Open `chrome://extensions/`
    - Enable **Developer mode** (top right).
    - Click **Load unpacked**.
    - Select the root folder of this project.

### Usage

- Click the extension icon to view the live leaderboard.
- Right-click the extension or click the gear icon to access **Settings**.
- Configure your notification preferences and refresh rate.

---

## 🤝 Contributing

Contributions are welcome! Whether you want to fix a bug, add a feature, or improve translations, follow these steps:

1.  **Fork the Project**.
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`).
3.  **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`).
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`).
5.  **Open a Pull Request**.

### Guidelines
- Please follow the existing coding style (ES6+).
- Ensure all new strings are added to `_locales/en/messages.json` and other supported languages if possible.
- Avoid large external dependencies to keep the extension lightweight.

---

## 🙏 Acknowledgments

- [OpenF1](https://openf1.org/) for the incredible free API.
- All the fans who help improve the telemetry logic.

---
*Disclaimer: This project is unofficial and is not associated in any way with the Formula 1 group of companies.*
