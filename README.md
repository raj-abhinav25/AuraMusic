# 🎵 AuraMusic

A full-stack music player web application built with **Node.js**, **Express**, and **IBM App ID** for secure user authentication. AuraMusic lets users manage playlists, stream songs via URL, and upload local audio files — all behind a protected login wall.

---

## ✨ Features

- 🔐 **Secure Authentication** via IBM App ID (OAuth 2.0 / OIDC)
- 🎶 **Playlist Management** — create and organize multiple playlists
- ➕ **Add Songs** by streaming URL or uploading local audio files
- 🗑️ **Delete Songs** from any playlist
- 💾 **Persistent Storage** using a local `data.json` file
- 🌐 **SPA-like Routing** with a clean, responsive frontend

---

## 🛠️ Tech Stack

| Layer        | Technology                         |
|--------------|------------------------------------|
| Runtime      | Node.js                            |
| Framework    | Express.js                         |
| Auth         | IBM App ID + Passport.js           |
| Sessions     | express-session                    |
| File Uploads | Multer                             |
| Frontend     | HTML, CSS, Vanilla JavaScript      |
| Data Storage | JSON file (`data.json`)            |
| Deployment   | Render                             |

---

## 📁 Project Structure

```
App/
├── public/
│   ├── index.html      # Main frontend UI
│   ├── style.css       # Styles
│   ├── script.js       # Frontend JavaScript
│   └── uploads/        # Uploaded audio files (auto-created)
├── server.js           # Express server & API routes
├── data.json           # Playlist & song data (auto-created)
├── package.json
├── .env                # Environment variables (not committed)
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- An [IBM App ID](https://cloud.ibm.com/catalog/services/app-id) service instance

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd App
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following:

```env
APPID_TENANT_ID=your_tenant_id
APPID_CLIENT_ID=your_client_id
APPID_SECRET=your_secret
APPID_OAUTH_SERVER_URL=https://<region>.appid.cloud.ibm.com/oauth/v4/<tenant-id>
APPID_REDIRECT_URI=http://localhost:3000/ibm/cloud/appid/callback
SESSION_SECRET=your_custom_session_secret
```

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`.

### 4. Start the Server

```bash
npm start
```

The app will be available at **http://localhost:3000**.

---

## 🔒 Authentication Flow

1. Unauthenticated users are redirected to **`/login`**.
2. IBM App ID handles the OAuth 2.0 login flow.
3. After a successful login, the user is redirected to **`/`** (the main app).
4. All API routes and static files are protected by the Passport.js middleware.
5. Users can log out via **`/logout`**.

### IBM App ID Setup

In your IBM App ID dashboard, make sure to add the redirect URI:
```
http://localhost:3000/ibm/cloud/appid/callback       # for local dev
https://your-app.onrender.com/ibm/cloud/appid/callback  # for production
```

---

## 📡 API Reference

| Method   | Endpoint                                  | Description              |
|----------|-------------------------------------------|--------------------------|
| `GET`    | `/api/playlists`                          | Get all playlists        |
| `POST`   | `/api/playlists`                          | Create a new playlist    |
| `DELETE` | `/api/playlists/:id`                      | Delete a playlist        |
| `POST`   | `/api/playlists/:id/songs`                | Add a song to a playlist |
| `DELETE` | `/api/playlists/:id/songs/:songId`        | Remove a song            |

### Add Song — Request Body

Supports both URL-based and file-based songs via `multipart/form-data`:

| Field       | Type   | Description                          |
|-------------|--------|--------------------------------------|
| `title`     | string | Song title                           |
| `artist`    | string | Artist name                          |
| `url`       | string | *(optional)* Streaming URL           |
| `audioFile` | file   | *(optional)* Local audio file upload |

---

## ☁️ Deployment (Render)

1. Push your code to a GitHub repository.
2. Create a new **Web Service** on [Render](https://render.com/).
3. Set the **Build Command** to `npm install` and **Start Command** to `npm start`.
4. Add all environment variables from `.env` in the Render dashboard.
5. Update `APPID_REDIRECT_URI` to your Render app URL.

---

## 📄 License

This project is for educational and personal use.
