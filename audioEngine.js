window.audioEngine = (() => {
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

const audioBuffers = {};
const activeNotes = {};
let volume = 50;
let sustainPedal = false;

const unlockAudio = () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

document.addEventListener('mousedown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

const setVolume = (val) => {
    volume = val;
    if (masterGain) masterGain.gain.value = volume / 100;
};

const getSampleInfo = (noteId) => {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const fileNotes = ["C", "D#", "F#", "A"];
    
    const match = noteId.match(/([A-G]#?)(\d)/);
    if (!match) return null;
    const noteName = match[1];
    let octave = parseInt(match[2], 10);
    
    let noteIndex = notes.indexOf(noteName);
    if (noteIndex === -1) return null;

    let minDiff = Infinity;
    let closestName = "C";
    let closestOctave = octave;
    
    for (let f of fileNotes) {
        let fIdx = notes.indexOf(f);
        let diff = noteIndex - fIdx;
        if (Math.abs(diff) < Math.abs(minDiff)) {
            minDiff = diff;
            closestName = f;
            closestOctave = octave;
        }
    }

    let diffWithNextOctaveC = noteIndex - 12;
    if (Math.abs(diffWithNextOctaveC) < Math.abs(minDiff)) {
        minDiff = diffWithNextOctaveC;
        closestName = "C";
        closestOctave = octave + 1;
    }
    
    let diffWithPrevOctaveA = noteIndex + 12 - 9;
    if (Math.abs(diffWithPrevOctaveA) < Math.abs(minDiff)) {
        minDiff = diffWithPrevOctaveA;
        closestName = "A";
        closestOctave = octave - 1;
    }
    
    return {
        file: `${closestName}${closestOctave}`,
        semitoneOffset: minDiff
    };
};

const getAudioUrl = (fileNoteId) => {
    return `sounds/${encodeURIComponent(fileNoteId)}.flac`;
};

let loadedSamplesCount = 0;
let totalSamplesCount = 0;

const preloadSamples = async (notesList) => {
    if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) { }
    }
    
    // Calculate required unique files to preload
    const requiredFiles = new Set();
    notesList.forEach(noteId => {
        const info = getSampleInfo(noteId);
        if (info) requiredFiles.add(info.file);
    });
    
    totalSamplesCount = requiredFiles.size;
    
    const promises = Array.from(requiredFiles).map(async (fileNoteId) => {
        if (audioBuffers[fileNoteId]) {
            loadedSamplesCount++;
            return;
        }
        try {
            const url = getAudioUrl(fileNoteId);
            const response = await fetch(url);
            if (!response.ok) return;
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            audioBuffers[fileNoteId] = audioBuffer;
            loadedSamplesCount++;
            
            // Dispatch a custom event to notify UI
            document.dispatchEvent(new CustomEvent('pianoDataLoaded', { 
                detail: { loaded: loadedSamplesCount, total: totalSamplesCount }
            }));
            
        } catch (e) { }
    });
    
    await Promise.all(promises);
};

const playNote = (noteId, velocity = 1) => {
    if (audioCtx.state === 'suspended') {
        try { audioCtx.resume(); } catch (e) { }
    }
    
    if (activeNotes[noteId] && !activeNotes[noteId].sustain) {
        const oldNote = activeNotes[noteId];
        oldNote.gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        oldNote.gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
        setTimeout(() => {
            try { oldNote.source.stop(); } catch(e){}
            oldNote.source.disconnect();
            oldNote.gainNode.disconnect();
        }, 100);
    }
    
    const info = getSampleInfo(noteId);
    if (!info) return;
    const fileNoteId = info.file;
    if (!audioBuffers[fileNoteId]) return;
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[fileNoteId];
    source.playbackRate.value = Math.pow(2, info.semitoneOffset / 12);
    
    const gainNode = audioCtx.createGain();
    const startTime = audioCtx.currentTime;
    
    // Quick attack, long slow natural decay
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(velocity, startTime + 0.005);
    gainNode.gain.setTargetAtTime(0, startTime + 0.005, 4.0); // Natural piano ring out
    
    source.connect(gainNode);
    gainNode.connect(masterGain);
    source.start(startTime);
    
    activeNotes[noteId] = { source, gainNode, sustain: false };
};

const releaseNote = (noteObj) => {
    const releaseDuration = 0.4;
    const { source, gainNode } = noteObj;
    
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    const currentGain = Math.max(gainNode.gain.value, 0.0001);
    gainNode.gain.setValueAtTime(currentGain, audioCtx.currentTime);
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, releaseDuration / 3);
    
    setTimeout(() => {
        try { source.stop(); } catch(e){}
        source.disconnect();
        gainNode.disconnect();
    }, releaseDuration * 1000 + 50);
};

const stopNote = (noteId) => {
    const noteObj = activeNotes[noteId];
    if (!noteObj) return;
    
    if (sustainPedal) {
        noteObj.sustain = true;
        return;
    }
    
    releaseNote(noteObj);
    delete activeNotes[noteId];
};

const setSustainPedal = (isPressed) => {
    sustainPedal = isPressed;
    if (!isPressed) {
        Object.keys(activeNotes).forEach(noteId => {
            if (activeNotes[noteId].sustain) {
                releaseNote(activeNotes[noteId]);
                delete activeNotes[noteId];
            }
        });
    }
};

return {
    setVolume,
    preloadSamples,
    playNote,
    stopNote,
    setSustainPedal
};

})();
