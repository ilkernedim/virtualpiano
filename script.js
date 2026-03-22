const defaultBindings = {
    "C3": "1", "C#3": "2", "D3": "3", "D#3": "4", "E3": "5", "F3": "6", "F#3": "7", "G3": "8", "G#3": "9", "A3": "0", "A#3": "-", "B3": "=",
    "C4": "q", "C#4": "w", "D4": "e", "D#4": "r", "E4": "t", "F4": "y", "F#4": "u", "G4": "i", "G#4": "o", "A4": "p", "A#4": "[", "B4": "]",
    "C5": "a", "C#5": "s", "D5": "d", "D#5": "f", "E5": "g", "F5": "h", "F#5": "j", "G5": "k", "G#5": "l", "A5": ";", "A#5": "'", "B5": "\\"
};

const notesList = [
    "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
    "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5"
];

const loadData = (key, def) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : def;
    } catch (e) {
        return def;
    }
};

let bindings = loadData('piano_bindings', defaultBindings);
let showLabels = loadData('piano_labels', true);
let shortcutsEnabled = loadData('piano_shortcuts', true);
let volume = loadData('piano_volume', 50);
let octaveShift = loadData('piano_octave', 0);

let isDragging = false;
let mouseNote = null;
let listeningForBinding = null;
const touchedNotes = {};

const getShiftedNoteId = (noteId) => {
    const match = noteId.match(/([A-G]#?)(\d)/);
    if(!match) return noteId;
    const newOctave = parseInt(match[2], 10) + octaveShift;
    return `${match[1]}${newOctave}`;
};

const activeKeyMaps = {};

const playNote = (noteId) => {
    const shifted = getShiftedNoteId(noteId);
    activeKeyMaps[noteId] = shifted;
    if (window.audioEngine) {
        audioEngine.playNote(shifted, 1);
    }
    
    const keyEl = document.querySelector(`[data-note="${noteId}"]`);
    if(keyEl) keyEl.classList.add("active");
};

const stopNote = (noteId) => {
    const shifted = activeKeyMaps[noteId];
    if (shifted && window.audioEngine) {
        audioEngine.stopNote(shifted);
        delete activeKeyMaps[noteId];
    }
    const keyEl = document.querySelector(`[data-note="${noteId}"]`);
    if(keyEl) keyEl.classList.remove("active");
};

const getSolfeggio = (nameName) => {
    const map = {
        "C": { top: "Do", bottom: "" },
        "C#": { top: "Do#", bottom: "Reb" },
        "D":  { top: "Re", bottom: "" },
        "D#": { top: "Re#", bottom: "Mib" },
        "E":  { top: "Mi", bottom: "" },
        "F":  { top: "Fa", bottom: "" },
        "F#": { top: "Fa#", bottom: "Solb" },
        "G":  { top: "Sol", bottom: "" },
        "G#": { top: "Sol#", bottom: "Lab" },
        "A":  { top: "La", bottom: "" },
        "A#": { top: "La#", bottom: "Sib" },
        "B":  { top: "Si", bottom: "" }
    };
    return map[nameName] || { top: nameName, bottom: "" };
};

const renderPianoLabels = () => {
    document.querySelectorAll('.key').forEach(key => {
        const noteId = key.dataset.note;
        const match = noteId.match(/([A-G]#?)(\d)/);
        if(!match) return;
        const nameName = match[1];
        const labels = getSolfeggio(nameName);
        
        const noteNameEl = key.querySelector('.note-name');
        if(noteNameEl) {
            if (key.classList.contains('black')) {
                noteNameEl.innerHTML = `<span>${labels.top}</span><span>${labels.bottom}</span>`;
            } else {
                noteNameEl.textContent = labels.top;
            }
        }
    });
};

const updateLabelsVisibility = () => {
    const app = document.getElementById("app");
    if(app) {
        if(showLabels) {
            app.classList.remove("hide-labels");
        } else {
            app.classList.add("hide-labels");
        }
    }
};

const createPiano = () => {
    const piano = document.getElementById("piano");
    if(!piano) return;
    piano.innerHTML = '';
    notesList.forEach(noteId => {
        const isBlack = noteId.includes("#");
        const el = document.createElement("div");
        el.className = `key ${isBlack ? "black" : "white"}`;
        el.dataset.note = noteId;
        
        const label = document.createElement("div");
        label.className = "key-label";
        
        const noteName = document.createElement("span");
        noteName.className = "note-name";
        
        const bindName = document.createElement("span");
        bindName.className = "bind-name";
        bindName.textContent = bindings[noteId] ? bindings[noteId].toUpperCase() : '';
        
        label.appendChild(noteName);
        label.appendChild(bindName);
        el.appendChild(label);
        piano.appendChild(el);
    });
    renderPianoLabels();
    updateLabelsVisibility();
};

const renderBindings = () => {
    const list = document.getElementById("key-bindings-list");
    if(!list) return;
    list.innerHTML = '';
    notesList.forEach(note => {
        const row = document.createElement("div");
        row.className = "bind-row";
        
        const label = document.createElement("span");
        const match = note.match(/([A-G]#?)(\d)/);
        const solfeggio = getSolfeggio(match ? match[1] : note);
        const oct = match ? match[2] : "";
        label.innerHTML = solfeggio.bottom ? `${solfeggio.top} / ${solfeggio.bottom} <small>(${oct})</small>` : `${solfeggio.top} <small>(${oct})</small>`;

        const btn = document.createElement("button");
        if (listeningForBinding === note) {
            btn.textContent = "Press a key...";
            btn.classList.add("listening");
        } else {
            btn.textContent = bindings[note] ? bindings[note].toUpperCase() : "NONE";
        }
        
        btn.onclick = () => {
            listeningForBinding = note;
            renderBindings();
            btn.blur();
        };
        
        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    });
};

const initSettings = () => {
    const labelsToggle = document.getElementById("toggle-labels");
    const shortcutsToggle = document.getElementById("toggle-shortcuts");
    const volumeSlider = document.getElementById("volume-slider");
    const volumeVal = document.getElementById("volume-val");
    const octaveSlider = document.getElementById("octave-slider");
    const octaveVal = document.getElementById("octave-val");
    
    if(labelsToggle) {
        labelsToggle.checked = showLabels;
        labelsToggle.onchange = (e) => {
            showLabels = e.target.checked;
            localStorage.setItem("piano_labels", JSON.stringify(showLabels));
            updateLabelsVisibility();
        };
    }
    
    if(shortcutsToggle) {
        shortcutsToggle.checked = shortcutsEnabled;
        shortcutsToggle.onchange = (e) => {
            shortcutsEnabled = e.target.checked;
            localStorage.setItem("piano_shortcuts", JSON.stringify(shortcutsEnabled));
        };
    }
    
    if(volumeSlider) {
        volumeSlider.value = volume;
        if (volumeVal) volumeVal.textContent = volume + "%";
        volumeSlider.oninput = (e) => {
            volume = parseInt(e.target.value, 10);
            localStorage.setItem("piano_volume", JSON.stringify(volume));
            if (volumeVal) volumeVal.textContent = volume + "%";
            if (window.audioEngine) audioEngine.setVolume(volume);
        };
    }
    
    if(octaveSlider) {
        octaveSlider.value = octaveShift;
        if(octaveVal) octaveVal.textContent = octaveShift;
        octaveSlider.oninput = (e) => {
            octaveShift = parseInt(e.target.value, 10);
            localStorage.setItem("piano_octave", JSON.stringify(octaveShift));
            if(octaveVal) octaveVal.textContent = octaveShift;
            renderPianoLabels();
        };
    }
    
    const defaultBindingsBtn = document.getElementById("default-bindings-btn");
    if(defaultBindingsBtn) {
        defaultBindingsBtn.onclick = () => {
            if(confirm("Tüm klavye tuş atamalarını varsayılan ayarlara döndürmek istediğinize emin misiniz?")) {
                bindings = JSON.parse(JSON.stringify(defaultBindings));
                localStorage.setItem("piano_bindings", JSON.stringify(bindings));
                renderBindings();
                createPiano();
            }
        };
    }
    
    const clearBindingsBtn = document.getElementById("clear-bindings-btn");
    if(clearBindingsBtn) {
        clearBindingsBtn.onclick = () => {
            if(confirm("Tüm klavye tuş atamalarını silmek istediğinize emin misiniz?")) {
                for (let k in bindings) {
                    bindings[k] = "";
                }
                localStorage.setItem("piano_bindings", JSON.stringify(bindings));
                renderBindings();
                createPiano();
            }
        };
    }
    
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeModal = document.getElementById("close-modal");
    
    if(settingsBtn && settingsModal) {
        settingsBtn.onclick = () => {
            settingsModal.classList.add("visible");
            renderBindings();
        };
    }
    if(closeModal && settingsModal) {
        closeModal.onclick = () => {
            settingsModal.classList.remove("visible");
            listeningForBinding = null;
        };
    }
};

const setupEvents = () => {
    const piano = document.getElementById("piano");
    if(!piano) return;

    piano.addEventListener("touchstart", (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const keyEl = el ? el.closest('.key') : null;
            if (keyEl && keyEl.dataset.note) {
                const note = keyEl.dataset.note;
                playNote(note);
                touchedNotes[touch.identifier] = note;
            }
        }
    }, {passive: false});

    piano.addEventListener("touchmove", (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const keyEl = el ? el.closest('.key') : null;
            const note = (keyEl && keyEl.dataset.note) ? keyEl.dataset.note : null;
            const lastNote = touchedNotes[touch.identifier];
            if (note !== lastNote) {
                if (lastNote) stopNote(lastNote);
                if (note) playNote(note);
                touchedNotes[touch.identifier] = note;
            }
        }
    }, {passive: false});

    const handleTouchEnd = (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const lastNote = touchedNotes[touch.identifier];
            if (lastNote) {
                stopNote(lastNote);
                delete touchedNotes[touch.identifier];
            }
        }
    };

    piano.addEventListener("touchend", handleTouchEnd, {passive: false});
    piano.addEventListener("touchcancel", handleTouchEnd, {passive: false});

    piano.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        const keyEl = e.target.closest('.key');
        if (keyEl && keyEl.dataset.note) {
            mouseNote = keyEl.dataset.note;
            playNote(mouseNote);
        }
    });

    piano.addEventListener("mouseover", (e) => {
        if (!isDragging) return;
        const keyEl = e.target.closest('.key');
        if (keyEl && keyEl.dataset.note) {
            const note = keyEl.dataset.note;
            if (note !== mouseNote) {
                if (mouseNote) stopNote(mouseNote);
                mouseNote = note;
                playNote(mouseNote);
            }
        }
    });

    piano.addEventListener("mouseleave", () => {
        if (isDragging && mouseNote) {
            stopNote(mouseNote);
            mouseNote = null;
        }
    });

    document.addEventListener("mouseup", (e) => {
        if (e.button !== 0) return;
        isDragging = false;
        if (mouseNote) {
            stopNote(mouseNote);
            mouseNote = null;
        }
    });

    document.addEventListener("keydown", (e) => {
        if (listeningForBinding) {
            e.preventDefault();
            const newKey = e.key.toLowerCase();
            
            if (newKey === "backspace" || newKey === "delete") {
                bindings[listeningForBinding] = "";
                localStorage.setItem("piano_bindings", JSON.stringify(bindings));
                listeningForBinding = null;
                renderBindings();
                createPiano();
                return;
            }
            
            if (Object.values(bindings).includes(newKey) && bindings[listeningForBinding] !== newKey && newKey !== "") {
                alert("Key already bound!");
                listeningForBinding = null;
                renderBindings();
                return;
            }
            
            bindings[listeningForBinding] = newKey;
            localStorage.setItem("piano_bindings", JSON.stringify(bindings));
            listeningForBinding = null;
            renderBindings();
            createPiano();
            return;
        }
        
        if (!shortcutsEnabled || e.repeat) return;
        const key = e.key.toLowerCase();
        let noteId = null;
        for (let k in bindings) {
            if(bindings[k] === key) {
                noteId = k;
                break;
            }
        }
        if (noteId) {
            e.preventDefault();
            playNote(noteId);
        }
    });

    document.addEventListener("keyup", (e) => {
        if (!shortcutsEnabled || listeningForBinding) return;
        const key = e.key.toLowerCase();
        let noteId = null;
        for (let k in bindings) {
            if(bindings[k] === key) {
                noteId = k;
                break;
            }
        }
        if (noteId) stopNote(noteId);
    });
};

const initApp = () => {
    try {
        createPiano();
        initSettings();
        setupEvents();
        
        if (window.audioEngine) {
            audioEngine.setVolume(volume);
            const preloadList = [];
            notesList.forEach(noteId => {
                const match = noteId.match(/([A-G]#?)(\d)/);
                if(match) {
                    const name = match[1];
                    const oct = parseInt(match[2], 10);
                    for(let i = -2; i <= 2; i++) {
                        preloadList.push(`${name}${oct + i}`);
                    }
                }
            });
            audioEngine.preloadSamples([...new Set(preloadList)]);
        }
    } catch(err) {
        console.error("Initialization error:", err);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
