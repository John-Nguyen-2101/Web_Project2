function loadSongScriptById(songId) {
  return new Promise((resolve, reject) => {
    if (!songId) {
      reject(new Error("Thiếu songId"));
      return;
    }

    const filePath = `../Data/songs/song-${songId}.js`;

    window.SONG_DATA = null;

    const oldScript = document.getElementById("dynamic-song-script");
    if (oldScript) oldScript.remove();

    const script = document.createElement("script");
    script.id = "dynamic-song-script";
    script.src = filePath;

    script.onload = () => {
      if (!window.SONG_DATA) {
        reject(new Error("Đã load file nhưng không thấy SONG_DATA"));
        return;
      }
      resolve(window.SONG_DATA);
    };

    script.onerror = () => {
      reject(new Error("Không load được file bài hát: " + filePath));
    };

    document.body.appendChild(script);
  });
}