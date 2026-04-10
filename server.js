require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const passport = require('passport');
const { WebAppStrategy } = require('ibmcloud-appid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Setup Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'aura-music-secret-key',
    resave: true,
    saveUninitialized: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((obj, cb) => cb(null, obj));

// Configure App ID Strategy
passport.use(new WebAppStrategy({
    tenantId: process.env.APPID_TENANT_ID,
    clientId: process.env.APPID_CLIENT_ID,
    secret: process.env.APPID_SECRET,
    oauthServerUrl: process.env.APPID_OAUTH_SERVER_URL,
    redirectUri: process.env.APPID_REDIRECT_URI
}));

// App ID Auth Routes
app.get('/ibm/cloud/appid/callback', passport.authenticate(WebAppStrategy.STRATEGY_NAME));

app.get('/login', passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
    successRedirect: '/',
    forceLogin: true
}));

app.get('/logout', (req, res) => {
    WebAppStrategy.logout(req);
    res.redirect('/');
});

// Protect all subsequent routes
app.use((req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
});

// Static Files - Protected by the middleware above
app.use(express.static(path.join(__dirname, 'public')));

// Set up directory for local media
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

/* ================= ROUTES ================= */
app.get('/api/playlists', (req, res) => {
    try {
        res.json(readData().playlists);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/playlists', (req, res) => {
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
app.post('/api/playlists/:id/songs', upload.single('audioFile'), (req, res) => {
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

app.delete('/api/playlists/:id', (req, res) => {
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

app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
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

// Fallback to index.html for unknown routes (SPA like behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Music Player Backend running at http://localhost:${PORT}`);
});
app.get("/ibm/cloud/appid/callback", (req, res) => {
    res.redirect("/");
});