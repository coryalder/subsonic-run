if (typeof window.currentSwapIndex === 'undefined') {
    window.currentSwapIndex = null;
}

window.openSwapModal = function(index) {
    window.currentSwapIndex = index;
    const picker = document.getElementById('swap-music-picker');
    if (picker.innerHTML.trim() === '') {
        picker.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;"><div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #1db954; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div><br>Loading music library...</div>';
        htmx.ajax('GET', '/artists', {target: '#swap-music-picker'});
    }
    document.getElementById('swap-modal').style.display = 'flex';
};

window.addSongToPlaylist = function(song) {
    if (window.currentSwapIndex === null) return;
    
    const runId = document.getElementById('swap-music-picker').dataset.runId;

    htmx.ajax('POST', `/run/${runId}/swap-song`, {
        target: '#run-detail-wrapper',
        values: {
            index: window.currentSwapIndex,
            song: JSON.stringify(song)
        }
    }).then(() => {
        document.getElementById('swap-modal').style.display = 'none';
    });
};
