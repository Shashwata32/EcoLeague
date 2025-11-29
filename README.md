# 🌿 EcoLeague  
**Gamifying Community Cleanliness**

EcoLeague is a real-time web application that transforms neighborhood cleaning into a competitive sport. Residents upload photo evidence of their cleaning efforts, earn points for their residential zones, and compete for the monthly **Golden Broom** trophy.

---

## 🚀 Features

### 🟢 Public (Community Users)

- **Live Leaderboard**  
  Real-time scoring between residential zones (Green Valley, Sunrise Apts, etc.).

- **Countdown Timer**  
  Live timer showing days/hours left before the monthly reset.

- **Smart Uploads**  
  Upload photo evidence with support for **HEIC (iPhone)** and **JPEG**.

- **Optimized Image Uploads**  
  Client-side compression ensures fast mobile uploads even on slow networks.

- **Wall of Fame**  
  Swipeable gallery showcasing the best monthly cleaning efforts.

- **Mobile-First Design**  
  Tailwind-powered interface with a native-app feel.

---

### 🛡️ Admin Dashboard (Restricted Access)

- **Analytics**  
  Visual charts (via Chart.js) showing participation and score breakdowns.

- **Moderation Queue**  
  Approve (1–10 points) or reject user submissions.

- **Auto-Fame**  
  Submissions scoring **9 or 10** are automatically added to the Wall of Fame.

- **Zone Management**  
  Create, rename, or delete zones in real time.

- **Monthly Protocol**  
  "Announce Winner" button archives the champion, logs history, and resets all scores.

---

## 🛠️ Tech Stack

### Frontend
- HTML5  
- Vanilla JavaScript (ES6 Modules)  
- Tailwind CSS  

### Backend
- **Firebase Firestore** (Real-time DB)  
- **Firebase Authentication** (Anonymous login)  

### Visualization
- Chart.js  

### Image Processing
- **heic2any** – HEIC to JPEG converter  
- **browser-image-compression** – High-performance client-side compression  
- Custom fallback Canvas compression  

---

## ⚙️ Setup & Installation

EcoLeague uses vanilla JS and CDN imports — **no build step required**.

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/eco-league.git
cd eco-league
