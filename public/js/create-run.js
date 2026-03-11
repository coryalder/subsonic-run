(function() {
    let selectedSongs = [];
    let targetSlowDuration = 0;
    let targetFastDuration = 0;

    window.updateTargetDurations = function(slow, fast) {
        targetSlowDuration = parseInt(slow);
        targetFastDuration = parseInt(fast);
        updateUI();
    };

    window.addSongToPlaylist = function(song) {
        const initialStatus = song.bpm >= 140 ? 'fast' : 'slow';
        selectedSongs.push({ 
            ...song, 
            status: initialStatus,
            artist: song.artist || 'Unknown'
        });
        updateUI();
    };

    window.toggleSongStatus = function(index) {
        selectedSongs[index].status = selectedSongs[index].status === 'fast' ? 'slow' : 'fast';
        updateUI();
    };

    window.removeSong = function(index) {
        selectedSongs.splice(index, 1);
        updateUI();
    };

    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateUI() {
        const slowPlaylistContainer = document.getElementById('playlist-items-slow');
        const fastPlaylistContainer = document.getElementById('playlist-items-fast');
        const inputsContainer = document.getElementById('selected-songs-inputs');
        
        const slowDurationText = document.getElementById('slow-duration-text');
        const fastDurationText = document.getElementById('fast-duration-text');
        const slowProgressBar = document.getElementById('slow-duration-progress');
        const fastProgressBar = document.getElementById('fast-duration-progress');

        const submitBtn = document.getElementById('submit-btn');
        const warning = document.getElementById('duration-warning');

        const slowSongs = selectedSongs.filter(s => s.status === 'slow');
        const fastSongs = selectedSongs.filter(s => s.status === 'fast');
        
        const totalSlowDuration = slowSongs.reduce((sum, s) => sum + s.duration, 0);
        const totalFastDuration = fastSongs.reduce((sum, s) => sum + s.duration, 0);
        
        const renderSong = (s, globalIndex) => `
            <div class="playlist-item">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; margin-right: 1rem;">
                    <strong>${s.title}</strong>
                    <span onclick="window.toggleSongStatus(${globalIndex})" 
                            style="cursor: pointer; font-size: 0.7rem; margin-left: 0.4rem; padding: 1px 4px; border-radius: 4px; user-select: none; background: ${s.status === 'fast' ? '#ffebee' : '#e3f2fd'}; color: ${s.status === 'fast' ? '#c62828' : '#1565c0'}; font-weight: bold; border: 1px solid ${s.status === 'fast' ? '#c62828' : '#1565c0'}">
                        ${s.status.toUpperCase()}
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <span>${formatDuration(s.duration)}</span>
                    <span class="remove-song" onclick="window.removeSong(${globalIndex})">&times;</span>
                </div>
            </div>
        `;

        // Update Lists
        if (slowSongs.length === 0) {
            slowPlaylistContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 1rem;">No slow songs.</p>';
        } else {
            slowPlaylistContainer.innerHTML = selectedSongs
                .map((s, i) => s.status === 'slow' ? renderSong(s, i) : null)
                .filter(x => x !== null)
                .join('');
        }

        if (fastSongs.length === 0) {
            fastPlaylistContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 1rem;">No fast songs.</p>';
        } else {
            fastPlaylistContainer.innerHTML = selectedSongs
                .map((s, i) => s.status === 'fast' ? renderSong(s, i) : null)
                .filter(x => x !== null)
                .join('');
        }

        // Update Hidden Inputs
        inputsContainer.innerHTML = selectedSongs.map(s => `
            <input type="hidden" name="songIds" value="${s.id}">
            <input type="hidden" name="songStatuses" value="${s.status}">
            <input type="hidden" name="songTitles" value="${s.title}">
            <input type="hidden" name="songArtists" value="${s.artist}">
            <input type="hidden" name="songDurations" value="${s.duration}">
            <input type="hidden" name="songBpms" value="${s.bpm}">
        `).join('');

        // Update Duration Info
        slowDurationText.innerText = `${formatDuration(totalSlowDuration)} / ${formatDuration(targetSlowDuration)}`;
        fastDurationText.innerText = `${formatDuration(totalFastDuration)} / ${formatDuration(targetFastDuration)}`;
        
        const slowPercentage = targetSlowDuration > 0 ? Math.min(100, (totalSlowDuration / targetSlowDuration) * 100) : 0;
        const fastPercentage = targetFastDuration > 0 ? Math.min(100, (totalFastDuration / targetFastDuration) * 100) : 0;
        slowProgressBar.style.width = `${slowPercentage}%`;
        fastProgressBar.style.width = `${fastPercentage}%`;

        // Validation
        const hasProgram = targetSlowDuration > 0 || targetFastDuration > 0;
        const slowIsValid = totalSlowDuration >= (targetSlowDuration - 15) && totalSlowDuration <= (targetSlowDuration + 600);
        const fastIsValid = totalFastDuration >= (targetFastDuration - 15) && totalFastDuration <= (targetFastDuration + 600);
        const isValid = hasProgram && slowIsValid && fastIsValid;

        if (isValid) {
            submitBtn.disabled = false;
            submitBtn.style.background = '#1db954';
            submitBtn.style.cursor = 'pointer';
            warning.style.display = 'none';
        } else {
            submitBtn.disabled = true;
            submitBtn.style.background = '#ccc';
            submitBtn.style.cursor = 'not-allowed';
            warning.style.display = 'block';
        }

        slowProgressBar.style.background = totalSlowDuration > targetSlowDuration + 600 ? '#e74c3c' : '#1565c0';
        fastProgressBar.style.background = totalFastDuration > targetFastDuration + 600 ? '#e74c3c' : '#c62828';
    }
})();