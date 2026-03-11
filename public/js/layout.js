window.playPreview = function(id, title, artist, isRunMix = false) {
    const player = document.getElementById('audio-preview-player');
    const audio = document.getElementById('main-audio-player');
    const titleEl = document.getElementById('player-song-title');
    const artistEl = document.getElementById('player-song-artist');

    titleEl.innerText = title;
    artistEl.innerText = artist;
    audio.src = isRunMix ? '/output/' + id + '.mp3' : '/stream/' + id;
    player.style.display = 'block';
    audio.play();
};

window.closePlayer = function() {
    const player = document.getElementById('audio-preview-player');
    const audio = document.getElementById('main-audio-player');
    audio.pause();
    player.style.display = 'none';
};
