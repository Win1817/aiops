# ai.ops Chat Dashboard

A modern, high-performance AI chat dashboard built with React, Express, and Tailwind CSS. It features real-time streaming, markdown rendering, syntax-highlighted code blocks, and session-based history.

## ✨ Features

- **Markdown Support**: Full GFM support including headings, lists, tables, and links.
- **Code Highlighting**: Automatic language detection and syntax highlighting with a one-click copy button.
- **Real-time Streaming**: Progressive token appending for a smooth, interactive chat experience.
- **Chat History**: Session-based history persisted to `localStorage`.
- **AI Profiles**: Toggle between different AI model profiles (Fast, Thinking, etc.).
- **Theme Toggle**: Seamless switching between Light and Dark modes.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Secure Auth**: Integrated with Firebase Authentication (Google Login).

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS 4, Framer Motion.
- **Backend**: Node.js, Express.js.
- **AI Integration**: Ollama (proxied via Express).
- **Authentication**: Firebase Auth.
- **Markdown**: `react-markdown`, `remark-gfm`.
- **Code Rendering**: `react-syntax-highlighter`.

## 🚀 Deployment Guide

### Prerequisites

1. **Node.js**: Ensure you have Node.js 18+ installed.
2. **Ollama**: A running instance of Ollama with the required models (e.g., `qwen3:1.7b`, `qwen3:4b`).
3. **Firebase**: A Firebase project with Google Authentication enabled.

### Step-by-Step Deployment

#### 1. Clone and Install
```bash
git clone <your-repo-url>
cd ai-ops-chat
npm install
```

#### 2. Configure Firebase
Create a `src/firebase-applet-config.json` file with your Firebase credentials:
```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_STORAGE_BUCKET",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
  "appId": "YOUR_APP_ID"
}
```

#### 3. Environment Variables
Create a `.env` file in the root directory:
```env
OLLAMA_API_URL=http://your-ollama-instance:11434
NODE_ENV=production
```

#### 4. Build the Frontend
```bash
npm run build
```
This will generate a `dist/` folder with the compiled static assets.

#### 5. Start the Server
In production, the Express server serves the static files from the `dist/` directory.
```bash
# Using tsx to run the server
npm start
```
*Note: Ensure your `package.json` has a `start` script pointing to `node server.ts` or similar if you are not using `tsx` in production.*

### Production Considerations

- **Reverse Proxy**: It is recommended to run the app behind a reverse proxy like Nginx or Caddy for SSL/TLS termination.
- **Process Manager**: Use `pm2` or a similar tool to keep the server running in the background.
- **Ollama Access**: Ensure the backend server has network access to the Ollama API.

## 📄 License

MIT License.
