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

    // 1. App Initialization
    fetchPlaylists();

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
            li.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${pl.name}</span>`;
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
        const name = prompt('Name your new playlist:');
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
            return alert('You must provide a Title and EITHER a URL link OR a Local file.');
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
                alert('Server validation failed: ' + errData.error);
            }
        } catch (e) {
            console.error('File Upload Pipeline broke down:', e);
            alert('Encountered an error safely storing your track to backend. Is Node running?');
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

    window.removeSong = async (songId) => {
        if (!confirm('Remove track from playlist?')) return;
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
