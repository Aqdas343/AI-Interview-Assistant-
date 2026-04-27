# 🚀 AI Interview Assistant Pro

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

An ultra-premium, real-time AI-powered interview assistance platform. Elevate your performance with live suggestions, neural visualizers, and multi-AI intelligence from OpenAI and Google Gemini.

---

## ✨ Features at a Glance
- **Predictive Intent Detection**: High-confidence intent analysis allows the system to trigger answers *instantly* before you even finish your sentence, achieving near-zero latency.
- **Adaptive Silence Thresholds**: Intelligent detection that differentiates between mid-sentence pauses (400ms) and actual question completion (800ms).
- **Session Metrics Engine**: Real-time performance tracking for TTFT (Time To First Token), predictive accuracy, and cancellation rates, visible via a dedicated metrics query layer.
- **Enterprise-Grade Security**: Implements strict rate-limiting (2s gaps / 15 triggers per min), JWT session management, and CSRF protection.
- **Floating Stealth Overlay**: A compact, distraction-free "Neural Pill" toggled via `Ctrl + K`, designed to sit seamlessly over live video call environments.

---

## 📖 Detailed Documentation

For a full technical deep dive, architecture diagrams, and component-level details, please refer to:

👉 **[COMPLETE PROJECT WALKTHROUGH](./WALKTHROUGH.md)**

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- (Optional) [PostgreSQL](https://www.postgresql.org/)

### 2. Setup
```bash
# Clone and install dependencies
git clone https://github.com/your-repo/ai-interview-assistant.git
cd ai-interview-assistant
npm run install-all # Helper script if available, else install in /frontend and /backend
```

### 3. Launch
```bash
# Start backend (Port 5000)
cd backend && npm run dev

# Start frontend (Port 5173 / Vite)
cd frontend && npm run dev
```

---

## 🛠 System Architecture
The system consists of a Vite-powered React Neural Command Center communicating via WebSockets with a Node.js Processing Hub.

```text
/frontend  -> React Neural Command Center (Port 5173)
/backend   -> Node.js Processing Hub (Port 5000)
```

For the full architectural diagram, see [WALKTHROUGH.md](./WALKTHROUGH.md#system-architecture).

---

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by the AI Interview Assistant Team.*
