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

// Helper to ensure data structure is modern
function ensureDataStructure() {
    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(dataFile, JSON.stringify({ users: {} }, null, 2));
    } else {
        try {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            // Legacy migration: if it has 'playlists' at root but no 'users' object
            if (data.playlists && !data.users) {
                const newData = {
                    users: {
                        "legacy": { playlists: data.playlists }
                    }
                };
                fs.writeFileSync(dataFile, JSON.stringify(newData, null, 2));
            } else if (!data.users) {
                data.users = {};
                fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('Error reading/migrating data.json', e);
            fs.writeFileSync(dataFile, JSON.stringify({ users: {} }, null, 2));
        }
    }
}
ensureDataStructure();

const readData = () => JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const writeData = (data) => fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

// Helper: Get user data (and create defaults if new user)
function getUserData(uid) {
    const data = readData();
    if (!data.users[uid]) {
        data.users[uid] = {
            playlists: [
                {
                    id: 'pl_' + Date.now() + '_1',
                    name: 'Chill Vibes',
                    songs: [
                        { id: 's1', title: 'Summer Breeze', artist: 'Benjamin Tissot', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                        { id: 's2', title: 'Creative Minds', artist: 'Benjamin Tissot', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }
                    ]
                },
                {
                    id: 'pl_' + Date.now() + '_2',
                    name: 'Focus Flow',
                    songs: [
                        { id: 's3', title: 'Deep Focus', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
                    ]
                }
            ]
        };
        writeData(data);
    }
    return data.users[uid];
}

function updateUserData(uid, updateFn) {
    const data = readData();
    if (!data.users[uid]) {
        // initialize if missing
        getUserData(uid);
        Object.assign(data, readData()); // refresh
    }
    updateFn(data.users[uid]);
    writeData(data);
}

/* ================= PROTECTED API ROUTES (require Firebase token) ================= */

app.get('/api/profile', requireAuth, (req, res) => {
    try {
        const userData = getUserData(req.user.uid);
        const playlistCount = userData.playlists.length;
        const songCount = userData.playlists.reduce((acc, pl) => acc + pl.songs.length, 0);

        res.json({
            uid: req.user.uid,
            email: req.user.email,
            name: req.user.name || req.user.email.split('@')[0],
            photoURL: req.user.picture || null,
            playlistCount,
            songCount
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.get('/api/playlists', requireAuth, (req, res) => {
    try {
        res.json(getUserData(req.user.uid).playlists);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/playlists', requireAuth, (req, res) => {
    try {
        const newPlaylist = {
            id: 'pl_' + Date.now().toString(),
            name: req.body.name || 'New Playlist',
            songs: []
        };
        updateUserData(req.user.uid, (user) => {
            user.playlists.push(newPlaylist);
        });
        res.status(201).json(newPlaylist);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// Use Multer 'upload.single' to handle multipart/form-data
app.post('/api/playlists/:id/songs', requireAuth, upload.single('audioFile'), (req, res) => {
    try {
        const uid = req.user.uid;
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

        let found = false;
        updateUserData(uid, (user) => {
            const playlist = user.playlists.find(p => p.id === req.params.id);
            if (playlist) {
                playlist.songs.push(newSong);
                found = true;
            }
        });

        if (!found) return res.status(404).json({ error: 'Playlist not found' });
        res.status(201).json(newSong);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add song' });
    }
});

app.delete('/api/playlists/:id', requireAuth, (req, res) => {
    try {
        let found = false;
        updateUserData(req.user.uid, (user) => {
            const index = user.playlists.findIndex(p => p.id === req.params.id);
            if (index !== -1) {
                user.playlists.splice(index, 1);
                found = true;
            }
        });
        if (!found) return res.status(404).json({ error: 'Playlist not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

app.delete('/api/playlists/:id/songs/:songId', requireAuth, (req, res) => {
    try {
        let found = false;
        updateUserData(req.user.uid, (user) => {
            const playlist = user.playlists.find(p => p.id === req.params.id);
            if (playlist) {
                const initialLength = playlist.songs.length;
                playlist.songs = playlist.songs.filter(s => s.id !== req.params.songId);
                if (playlist.songs.length !== initialLength) {
                    found = true;
                }
            }
        });
        if (!found) return res.status(404).json({ error: 'Playlist or song not found' });
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