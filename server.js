require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const admin = require('./firebaseAdmin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ── Firebase Auth Middleware ──────────────────────────────────────────────────
// Verifies the Firebase ID Token sent as: Authorization: Bearer <token>
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        req.user = await admin.auth().verifyIdToken(token);
        return next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
}

// ── Static Files (public) — served WITHOUT auth (login.html lives here) ───────
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth check endpoint — used by the frontend to validate a token ─────────────
app.get('/api/auth-status', requireAuth, (req, res) => {
    res.json({ uid: req.user.uid, email: req.user.email, name: req.user.name });
});

// ── Set up directory for local media ──────────────────────────────────────────
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage for audio uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Safe filename with timestamp prefix
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, 'audio_' + Date.now() + '_' + safeName);
    }
});
const upload = multer({ storage: storage });

// Data file path
const dataFile = path.join(__dirname, 'data.json');

// Initialize with some default cool playlists if empty
if (!fs.existsSync(dataFile)) {
    const defaultData = {
        playlists: [
            {
                id: 'pl_1',
                name: 'Chill Vibes',
                songs: [
                    { id: 's1', title: 'Summer Breeze', artist: 'Benjamin Tissot', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                    { id: 's2', title: 'Creative Minds', artist: 'Benjamin Tissot', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }
                ]
            },
            {
                id: 'pl_2',
                name: 'Focus Flow',
                songs: [
                    { id: 's3', title: 'Deep Focus', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
                    { id: 's4', title: 'Electronic Echo', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
                    { id: 's5', title: 'Ambient Drive', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' }
                ]
            }
        ]
    };
    fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
}

const readData = () => JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const writeData = (data) => fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

/* ================= PROTECTED API ROUTES (require Firebase token) ================= */

app.get('/api/playlists', requireAuth, (req, res) => {
    try {
        res.json(readData().playlists);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/playlists', requireAuth, (req, res) => {
    try {
        const data = readData();
        const newPlaylist = {
            id: 'pl_' + Date.now().toString(),
            name: req.body.name || 'New Playlist',
            songs: []
        };
        data.playlists.push(newPlaylist);
        writeData(data);
        res.status(201).json(newPlaylist);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// Use Multer 'upload.single' to handle multipart/form-data
app.post('/api/playlists/:id/songs', requireAuth, upload.single('audioFile'), (req, res) => {
    try {
        const data = readData();
        const playlist = data.playlists.find(p => p.id === req.params.id);
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        // Use provided URL if exists; otherwise use the local uploaded file's relative URL path
        let fileUrl = req.body.url;
        if (req.file) {
            fileUrl = '/uploads/' + req.file.filename;
        }

        if (!fileUrl) {
            return res.status(400).json({ error: 'No URL or Uploaded file provided' });
        }

        const newSong = {
            id: 's_' + Date.now().toString(),
            title: req.body.title || 'Unknown Title',
            artist: req.body.artist || 'Unknown Artist',
            url: fileUrl
        };
        playlist.songs.push(newSong);
        writeData(data);
        res.status(201).json(newSong);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add song' });
    }
});

app.delete('/api/playlists/:id', requireAuth, (req, res) => {
    try {
        const data = readData();
        const index = data.playlists.findIndex(p => p.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Playlist not found' });
        data.playlists.splice(index, 1);
        writeData(data);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

app.delete('/api/playlists/:id/songs/:songId', requireAuth, (req, res) => {
    try {
        const data = readData();
        const playlist = data.playlists.find(p => p.id === req.params.id);
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        playlist.songs = playlist.songs.filter(s => s.id !== req.params.songId);
        writeData(data);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

// Fallback — serve index.html for any unmatched GET (SPA behaviour)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`AuraMusic backend running at http://localhost:${PORT}`);
});