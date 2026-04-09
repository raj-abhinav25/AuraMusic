document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let playlists = [];
    let currentPlaylistId = null;
    let currentSongId = null;
    let nowPlayingQueue = [];
    let currentTrackIndex = -1;
    let isPlaying = false;

    // Sub-components
    const audio = document.getElementById('audioPlayer');
    const playlistContainer = document.getElementById('playlistContainer');
    const songListContainer = document.getElementById('songList');
    const currentPlaylistTitle = document.getElementById('currentPlaylistTitle');
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');
    
    // Add form tools
    const addSongToggleBtn = document.getElementById('addSongToggleBtn');
    const addSongFormContainer = document.getElementById('addSongFormContainer');
    const submitSongBtn = document.getElementById('submitSongBtn');
    const cancelSongBtn = document.getElementById('cancelSongBtn');
    
    // Bottom Player Deck
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const volumeBar = document.getElementById('volumeBar');
    const volumeIcon = document.getElementById('volumeIcon');
    
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const playerCoverArt = document.getElementById('playerCoverArt');

    // Modal element refs
    const modalOverlay    = document.getElementById('modalOverlay');
    const promptModal     = document.getElementById('promptModal');
    const promptInput     = document.getElementById('promptInput');
    const promptOkBtn     = document.getElementById('promptOkBtn');
    const promptCancelBtn = document.getElementById('promptCancelBtn');
    const confirmModal    = document.getElementById('confirmModal');
    const confirmOkBtn    = document.getElementById('confirmOkBtn');
    const confirmCancelBtn= document.getElementById('confirmCancelBtn');
    const alertModal      = document.getElementById('alertModal');
    const alertOkBtn      = document.getElementById('alertOkBtn');

    // Sidebar (mobile) refs
    const sidebar           = document.querySelector('.sidebar');
    const sidebarOverlay    = document.getElementById('sidebarOverlay');
    const sidebarToggleBtn  = document.getElementById('sidebarToggleBtn');

    // 1. App Initialization
    fetchPlaylists();

    // Sidebar open/close helpers
    function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); }
    function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }

    sidebarToggleBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
    sidebarOverlay.addEventListener('click', closeSidebar);
    // Close on Escape key
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar(); });

    /* ===== Custom Modal Helpers ===== */
    function _showModal(el) { modalOverlay.classList.remove('hidden'); el.classList.remove('hidden'); }
    function _hideModal(el) { el.classList.add('hidden'); modalOverlay.classList.add('hidden'); }

    function showPrompt({ title = 'Input', message = '', placeholder = '', okLabel = 'OK' } = {}) {
        return new Promise(resolve => {
            document.getElementById('promptTitle').innerText = title;
            document.getElementById('promptMessage').innerText = message;
            promptOkBtn.innerText = okLabel;
            promptInput.placeholder = placeholder;
            promptInput.value = '';
            _showModal(promptModal);
            setTimeout(() => promptInput.focus(), 50);

            const ok = () => { const v = promptInput.value.trim(); _hideModal(promptModal); cleanup(); resolve(v || null); };
            const cancel = () => { _hideModal(promptModal); cleanup(); resolve(null); };
            const key = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); };
            const cleanup = () => {
                promptOkBtn.removeEventListener('click', ok);
                promptCancelBtn.removeEventListener('click', cancel);
                document.removeEventListener('keydown', key);
            };
            promptOkBtn.addEventListener('click', ok);
            promptCancelBtn.addEventListener('click', cancel);
            document.addEventListener('keydown', key);
        });
    }

    function showConfirm({ title = 'Are you sure?', message = '', okLabel = 'Delete' } = {}) {
        return new Promise(resolve => {
            document.getElementById('confirmTitle').innerText = title;
            document.getElementById('confirmMessage').innerText = message;
            confirmOkBtn.innerText = okLabel;
            _showModal(confirmModal);

            const ok = () => { _hideModal(confirmModal); cleanup(); resolve(true); };
            const cancel = () => { _hideModal(confirmModal); cleanup(); resolve(false); };
            const key = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); };
            const cleanup = () => {
                confirmOkBtn.removeEventListener('click', ok);
                confirmCancelBtn.removeEventListener('click', cancel);
                document.removeEventListener('keydown', key);
            };
            confirmOkBtn.addEventListener('click', ok);
            confirmCancelBtn.addEventListener('click', cancel);
            document.addEventListener('keydown', key);
        });
    }

    function showAlert({ title = 'Notice', message = '' } = {}) {
        return new Promise(resolve => {
            document.getElementById('alertTitle').innerText = title;
            document.getElementById('alertMessage').innerText = message;
            _showModal(alertModal);
            setTimeout(() => alertOkBtn.focus(), 50);

            const ok = () => { _hideModal(alertModal); cleanup(); resolve(); };
            const key = e => { if (e.key === 'Enter' || e.key === 'Escape') ok(); };
            const cleanup = () => {
                alertOkBtn.removeEventListener('click', ok);
                document.removeEventListener('keydown', key);
            };
            alertOkBtn.addEventListener('click', ok);
            document.addEventListener('keydown', key);
        });
    }
    /* ================================ */

    async function fetchPlaylists() {
        try {
            const res = await fetch('/api/playlists');
            playlists = await res.json();
            renderPlaylists();
            
            if (playlists.length > 0 && !currentPlaylistId) {
                selectPlaylist(playlists[0].id);
            }
        } catch (e) {
            console.error('API Error: Could not fetch playlists', e);
        }
    }

    // 2. DOM Rendering
    function renderPlaylists() {
        playlistContainer.innerHTML = '';
        playlists.forEach(pl => {
            const li = document.createElement('li');
            li.className = `playlist-item ${pl.id === currentPlaylistId ? 'active' : ''}`;
            li.innerHTML = `
                <i class="fa-solid fa-layer-group"></i>
                <span style="flex:1">${pl.name}</span>
                <button class="playlist-delete-btn" title="Delete Playlist" onclick="event.stopPropagation(); removePlaylist('${pl.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            li.onclick = () => selectPlaylist(pl.id);
            playlistContainer.appendChild(li);
        });
    }

    function selectPlaylist(id) {
        currentPlaylistId = id;
        renderPlaylists();
        const pl = playlists.find(p => p.id === id);
        currentPlaylistTitle.innerText = pl.name;
        addSongToggleBtn.classList.remove('hidden');
        renderSongs(pl.songs);
        // Auto-close drawer on mobile after selecting a playlist
        if (window.innerWidth <= 768) closeSidebar();
    }

    function renderSongs(songs) {
        songListContainer.innerHTML = '';
        if (songs.length === 0) {
            songListContainer.innerHTML = '<li style="text-align: center; color: var(--text-secondary); padding: 2rem;">Empty playlist. Add some music!</li>';
            return;
        }

        songs.forEach((song, idx) => {
            const li = document.createElement('li');
            li.className = `song-item ${song.id === currentSongId ? 'playing' : ''}`;
            li.innerHTML = `
                <div class="song-art">
                    ${song.id === currentSongId && isPlaying 
                        ? '<i class="fa-solid fa-chart-simple fa-bounce" style="color:var(--accent)"></i>' 
                        : '<i class="fa-solid fa-music"></i>'}
                </div>
                <div class="song-info">
                    <span class="song-title">${song.title}</span>
                    <span class="song-artist">${song.artist}</span>
                </div>
                <button class="delete-btn" title="Remove" onclick="event.stopPropagation(); removeSong('${song.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            li.onclick = () => preloadAndPlaySong(song, idx, songs);
            songListContainer.appendChild(li);
        });
    }

    // 3. API Integrations
    createPlaylistBtn.addEventListener('click', async () => {
        const name = await showPrompt({
            title: 'New Playlist',
            message: 'Give your playlist a name:',
            placeholder: 'e.g. Chill Vibes, Focus Flow...',
            okLabel: 'Create'
        });
        if (!name) return;
        const res = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const newPl = await res.json();
        playlists.push(newPl);
        selectPlaylist(newPl.id);
    });

    // UPLOAD LOGIC Update! Multi-part mixed support
    submitSongBtn.addEventListener('click', async () => {
        const titleInput = document.getElementById('songTitle');
        const artistInput = document.getElementById('songArtist');
        const urlInput = document.getElementById('songUrl');
        const fileInput = document.getElementById('songFile');
        
        const title = titleInput.value.trim();
        const artist = artistInput.value.trim() || 'Unknown Artist';
        const url = urlInput.value.trim();
        const file = fileInput.files[0];

        if (!title || (!url && !file)) {
            await showAlert({ title: 'Missing Info', message: 'Provide a track title and either a stream URL or a local audio file.' });
            return;
        }

        // Processing state UI update
        const origText = submitSongBtn.innerText;
        submitSongBtn.innerText = 'Compressing & Up-loading...';
        submitSongBtn.disabled = true;

        try {
            // Using FormData supports file transfers efficiently
            const formData = new FormData();
            formData.append('title', title);
            formData.append('artist', artist);
            if (url) formData.append('url', url);
            if (file) formData.append('audioFile', file);

            const res = await fetch(`/api/playlists/${currentPlaylistId}/songs`, {
                method: 'POST',
                // Explicitly letting fetch compute 'multipart/form-data' boundary!
                body: formData
            });

            if (res.ok) {
                const newSong = await res.json();
                const pl = playlists.find(p => p.id === currentPlaylistId);
                pl.songs.push(newSong);
                renderSongs(pl.songs);
                
                // Reset form visibility and textboxes
                addSongFormContainer.classList.add('hidden');
                titleInput.value = '';
                artistInput.value = '';
                urlInput.value = '';
                fileInput.value = ''; // clears actual files from cache view
                fileInput.parentElement.querySelector('span').innerText = 'Choose Audio File';
            } else {
                const errData = await res.json();
                await showAlert({ title: 'Server Error', message: 'Could not add track: ' + errData.error });
            }
        } catch (e) {
            console.error('File Upload Pipeline broke down:', e);
            await showAlert({ title: 'Upload Failed', message: 'Could not store your track. Is the Node server running?' });
        } finally {
            submitSongBtn.innerText = origText;
            submitSongBtn.disabled = false;
        }
    });

    // File input label auto-update logic for Custom File Input Aesthetics
    document.getElementById('songFile').addEventListener('change', function(e) {
        let labelSpan = this.parentElement.querySelector('span');
        if (this.files && this.files.length > 0) {
            let filename = this.files[0].name;
            // Shorten extremely long names
            if(filename.length > 25) filename = filename.substring(0, 22) + '...';
            labelSpan.innerText = filename;
            labelSpan.style.color = 'var(--accent)'; // Turn light green for validation logic
        } else {
            labelSpan.innerText = 'Choose Audio File';
            labelSpan.style.color = '';
        }
    });

    window.removePlaylist = async (playlistId) => {
        const confirmed = await showConfirm({
            title: 'Delete Playlist',
            message: 'This will permanently remove the playlist and all its tracks. This cannot be undone.',
            okLabel: 'Delete'
        });
        if (!confirmed) return;
        try {
            const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
            if (res.ok) {
                playlists = playlists.filter(p => p.id !== playlistId);
                if (currentPlaylistId === playlistId) {
                    currentPlaylistId = null;
                    currentPlaylistTitle.innerText = 'Select a Playlist';
                    songListContainer.innerHTML = '';
                    addSongToggleBtn.classList.add('hidden');
                    addSongFormContainer.classList.add('hidden');
                }
                renderPlaylists();
                // Auto-select first remaining playlist
                if (playlists.length > 0 && !currentPlaylistId) {
                    selectPlaylist(playlists[0].id);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    window.removeSong = async (songId) => {
        const confirmed = await showConfirm({
            title: 'Remove Track',
            message: 'Remove this track from the playlist?',
            okLabel: 'Remove'
        });
        if (!confirmed) return;
        try {
            const res = await fetch(`/api/playlists/${currentPlaylistId}/songs/${songId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                const pl = playlists.find(p => p.id === currentPlaylistId);
                pl.songs = pl.songs.filter(s => s.id !== songId);
                if (currentSongId === songId) {
                    audio.pause();
                    isPlaying = false;
                    syncPlayButton();
                }
                renderSongs(pl.songs);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // UI Toggles
    addSongToggleBtn.addEventListener('click', () => addSongFormContainer.classList.toggle('hidden'));
    cancelSongBtn.addEventListener('click', () => {
        addSongFormContainer.classList.add('hidden');
        document.getElementById('songTitle').value = '';
        document.getElementById('songArtist').value = '';
        document.getElementById('songUrl').value = '';
        document.getElementById('songFile').value = '';
        document.getElementById('songFile').parentElement.querySelector('span').innerText = 'Choose Audio File';
    });

    // 4. Audio Engine Core
    function preloadAndPlaySong(song, index, queue) {
        nowPlayingQueue = queue;
        currentTrackIndex = index;
        currentSongId = song.id;
        
        audio.src = song.url;
        audio.play().then(() => {
            isPlaying = true;
            syncPlayButton();
        }).catch(err => {
            console.warn('Playback error (CORS or Invalid URL)', err);
            alert('Cannot stream this audio track. Check if the URL/file is accessible.');
        });

        // Update Bottom Deck
        playerTitle.innerText = song.title;
        playerArtist.innerText = song.artist;
        playerCoverArt.classList.add('active');
        
        const activePl = playlists.find(p => p.id === currentPlaylistId);
        if (activePl) renderSongs(activePl.songs);
    }

    function playNext() {
        if (nowPlayingQueue.length === 0) return;
        currentTrackIndex = (currentTrackIndex + 1) % nowPlayingQueue.length;
        preloadAndPlaySong(nowPlayingQueue[currentTrackIndex], currentTrackIndex, nowPlayingQueue);
    }

    function playPrevious() {
        if (nowPlayingQueue.length === 0) return;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        currentTrackIndex = (currentTrackIndex - 1 + nowPlayingQueue.length) % nowPlayingQueue.length;
        preloadAndPlaySong(nowPlayingQueue[currentTrackIndex], currentTrackIndex, nowPlayingQueue);
    }

    playBtn.addEventListener('click', () => {
        if (!currentSongId && nowPlayingQueue.length > 0) {
            preloadAndPlaySong(nowPlayingQueue[0], 0, nowPlayingQueue);
            return;
        } else if (!currentSongId) {
             const activePl = playlists.find(p => p.id === currentPlaylistId);
             if (activePl && activePl.songs.length > 0) {
                 preloadAndPlaySong(activePl.songs[0], 0, activePl.songs);
             }
             return;
        }
        
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
        } else {
            audio.play().catch(e => console.error(e));
            isPlaying = true;
        }
        syncPlayButton();
        
        const activePl = playlists.find(p => p.id === currentPlaylistId);
        if (activePl) renderSongs(activePl.songs);
    });

    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrevious);
    audio.addEventListener('ended', playNext); // Auto-advance

    // Progress Bar Integration
    audio.addEventListener('timeupdate', () => {
        if (!isNaN(audio.duration)) {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressBar.value = percent;
            currentTimeEl.innerText = formatDuration(audio.currentTime);
            totalTimeEl.innerText = formatDuration(audio.duration);
            progressBar.style.background = `linear-gradient(to right, var(--text-primary) ${percent}%, var(--card-hover) ${percent}%)`;
        }
    });

    progressBar.addEventListener('input', (e) => {
        if (!isNaN(audio.duration)) {
            audio.currentTime = (e.target.value / 100) * audio.duration;
        }
    });

    // Volume Sync
    volumeBar.addEventListener('input', (e) => {
        const val = e.target.value;
        audio.volume = val / 100;
        volumeBar.style.background = `linear-gradient(to right, var(--text-primary) ${val}%, var(--card-hover) ${val}%)`;
        
        if (val == 0) volumeIcon.className = 'fa-solid fa-volume-xmark';
        else if (val < 50) volumeIcon.className = 'fa-solid fa-volume-low';
        else volumeIcon.className = 'fa-solid fa-volume-high';
    });
    
    volumeBar.style.background = `linear-gradient(to right, var(--text-primary) 100%, var(--card-hover) 100%)`;

    function syncPlayButton() {
        playBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    }

    function formatDuration(sec) {
        if (isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
});
