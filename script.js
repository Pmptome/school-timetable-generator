/**
 * TimetableGen Professional
 * Simplified Core Engine
 */

const STATE_KEY = 'timetableGen_Pro_State';

const DEFAULT_STATE = {
    schedules: {
        "s1": { name: "Active Schedule", classes: [] }
    },
    currentScheduleId: "s1",
    darkMode: false
};

let appState = DEFAULT_STATE;

function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            appState = JSON.parse(saved);
        }
    } catch (e) {
        console.error("State load failed", e);
    }
}

function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
}

loadState();

// DOM References
const elements = {
    classForm: document.getElementById('classForm'),
    scheduleSelect: document.getElementById('scheduleSelect'),
    timetableBody: document.getElementById('timetableBody'),
    timetableTable: document.getElementById('timetableTable'),
    emptyState: document.getElementById('emptyState'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    autoGenModal: document.getElementById('autoGenModal'),
    autoGenForm: document.getElementById('autoGenForm'),
    openAutoGenBtn: document.getElementById('openAutoGenModal'),
    closeModalBtn: document.getElementById('closeModal'),
    // Exports
    printBtn: document.getElementById('printBtn'),
    pdfBtn: document.getElementById('downloadPdfBtn'),
    pngBtn: document.getElementById('downloadPngBtn'),
    icsBtn: document.getElementById('exportIcsBtn'),
    jsonExportBtn: document.getElementById('exportJsonBtn'),
    jsonImportBtn: document.getElementById('importBtn'),
    clearBtn: document.getElementById('clearBtn'),
    // Lists
    classNameList: document.getElementById('classNameList'),
    teacherNameList: document.getElementById('teacherNameList')
};

// Helper to get active classes safely
function getActiveClasses() {
    return appState.schedules[appState.currentScheduleId].classes;
}

// --- Utilities ---

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
}

function checkConflict(newClass, currentClasses) {
    const start = timeToMinutes(newClass.startTime);
    const end = timeToMinutes(newClass.endTime);

    for (const c of currentClasses) {
        if (c.day !== newClass.day) continue;
        const cStart = timeToMinutes(c.startTime);
        const cEnd = timeToMinutes(c.endTime);

        if (start < cEnd && end > cStart) {
            if (c.teacher && c.teacher === newClass.teacher) {
                return `Teacher "${c.teacher}" is already scheduled at this time.`;
            }
            if (!newClass.id || c.id !== newClass.id) {
                return `This time slot overlaps with "${c.name}".`;
            }
        }
    }
    return null;
}

// --- Render ---

function render() {
    elements.timetableBody.innerHTML = '';
    const activeClasses = getActiveClasses();

    if (activeClasses.length === 0) {
        elements.emptyState.style.display = 'block';
        elements.timetableTable.style.display = 'none';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.timetableTable.style.display = 'table';

    // Chronological sort ensuring Period 1 is before Period 2
    const slots = [...new Set(activeClasses.map(c => `${c.startTime} - ${c.endTime}`))].sort((a,b) => timeToMinutes(a.split(' - ')[0]) - timeToMinutes(b.split(' - ')[0]));
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const icons = ['🐱', '🐶', '🚗', '🚁', '🚂', '🍎', '🎨', '🎹', '🐻', '🦒', '🐰', '🌈', '🍦', '🍓'];

    slots.forEach((slot, index) => {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');
        timeCell.className = 'time-cell';
        
        // Correct labeling: Period X followed by time range
        timeCell.innerHTML = `
            <span class="period-num">Period ${index + 1}</span>
            <div class="slot-time" data-start="${slot.split(' - ')[0]}" data-end="${slot.split(' - ')[1]}">${slot}</div>
        `;
        row.appendChild(timeCell);

        days.forEach(day => {
            const cell = document.createElement('td');
            const match = activeClasses.find(c => `${c.startTime} - ${c.endTime}` === slot && c.day === day);
            
            if (match) {
                const randomIcon = icons[Math.floor(Math.random() * icons.length)];
                const block = document.createElement('div');
                block.className = 'class-block';
                block.draggable = true;
                block.setAttribute('data-id', match.id);
                block.setAttribute('data-day', day);
                block.setAttribute('data-start', match.startTime);
                block.setAttribute('data-end', match.endTime);
                block.style.setProperty('--class-bg', match.color || '#2563eb');

                block.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', match.id);
                    block.style.opacity = '0.5';
                };
                block.ondragend = () => block.style.opacity = '1';

                block.innerHTML = `
                    <div class="card-icon">${randomIcon}</div>
                    <button class="delete-btn" onclick="deleteClass('${match.id}')">✕</button>
                    <span class="name">${match.name}</span>
                    <span class="teacher">${match.teacher || ''}</span>
                    <span class="room">${match.location || ''}</span>
                `;
                cell.appendChild(block);
            }

            // Cell Drop Logic
            cell.ondragover = (e) => {
                e.preventDefault();
                cell.style.background = '#f0f7ff';
            };
            cell.ondragleave = () => cell.style.background = '';
            cell.ondrop = (e) => {
                e.preventDefault();
                cell.style.background = '';
                const classId = e.dataTransfer.getData('text/plain');
                handleDrop(classId, day, slot);
            };

            row.appendChild(cell);
        });
        elements.timetableBody.appendChild(row);
    });
    updateAutocomplete();
    updateLiveStatus();
}

// --- Drag & Drop Logic ---
function handleDrop(classId, newDay, newSlot) {
    const activeClasses = getActiveClasses();
    const itemIndex = activeClasses.findIndex(c => c.id === classId);
    if (itemIndex === -1) return;

    const [newStart, newEnd] = newSlot.split(' - ');
    const updatedClass = { ...activeClasses[itemIndex], day: newDay, startTime: newStart, endTime: newEnd };

    // Check Conflict excluding self
    const otherClasses = activeClasses.filter(c => c.id !== classId);
    const conflict = checkConflict(updatedClass, otherClasses);
    
    if (conflict) {
        if (!confirm(`Move Conflict: ${conflict}\nOverride?`)) return;
    }
    
    activeClasses[itemIndex] = updatedClass;
    saveState();
    render();
}

function updateLiveStatus() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    let currentActivity = "No active class";
    
    document.querySelectorAll('.class-block').forEach(block => {
        block.classList.remove('current-class');
        const day = block.getAttribute('data-day');
        const start = timeToMinutes(block.getAttribute('data-start'));
        const end = timeToMinutes(block.getAttribute('data-end'));
        
        if (day === currentDay && currentTime >= start && currentTime < end) {
            block.classList.add('current-class');
            currentActivity = `Ongoing: ${block.querySelector('.name').textContent}`;
        }
    });
    
    const clockEl = document.getElementById('liveClock');
    if (clockEl) {
        clockEl.textContent = `${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • ${currentDay} • ${currentActivity}`;
    }
}

setInterval(updateLiveStatus, 30000);

// Helper to wrap exports in the Japanese theme
async function withPrintTheme(callback) {
    const gridPanel = document.querySelector('.grid-panel');
    const stickers = ['🌸', '✨', '🎈', '🖍️', '🐾', '🪁', '🍬', '⭐'];
    const stickerElements = [];

    document.body.classList.add('print-theme');

    // Add random stickers for Japanese school aesthetic
    for(let i = 0; i < 12; i++) {
        const span = document.createElement('span');
        span.className = 'sticker';
        span.textContent = stickers[Math.floor(Math.random() * stickers.length)];
        span.style.left = Math.random() * 90 + '%';
        span.style.top = Math.random() * 90 + '%';
        span.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
        gridPanel.appendChild(span);
        stickerElements.push(span);
    }

    await callback();

    // Cleanup
    stickerElements.forEach(s => s.remove());
    document.body.classList.remove('print-theme');
}

window.deleteClass = (id) => {
    const activeClasses = getActiveClasses();
    appState.schedules[appState.currentScheduleId].classes = activeClasses.filter(c => c.id !== id);
    saveState();
    render();
};

function updateAutocomplete() {
    const activeClasses = getActiveClasses();
    const names = [...new Set(activeClasses.map(c => c.name))];
    const teachers = [...new Set(activeClasses.map(c => c.teacher))].filter(Boolean);
    elements.classNameList.innerHTML = names.map(n => `<option value="${n}">`).join('');
    elements.teacherNameList.innerHTML = teachers.map(t => `<option value="${t}">`).join('');
}

// --- Forms ---

elements.classForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeClasses = getActiveClasses();
    const newClass = {
        id: 'c' + Date.now(),
        name: document.getElementById('className').value,
        day: document.getElementById('dayOfWeek').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        teacher: document.getElementById('teacherName').value,
        location: document.getElementById('location').value,
        color: document.getElementById('classColor').value,
        notes: document.getElementById('classNotes').value
    };

    if (timeToMinutes(newClass.startTime) >= timeToMinutes(newClass.endTime)) {
        return alert("End time must be after start time.");
    }

    const conflict = checkConflict(newClass, activeClasses);
    if (conflict) {
        if (!confirm(`Conflict: ${conflict}\nAre you sure you want to add this?`)) return;
    }

    activeClasses.push(newClass);
    saveState();
    render();
    elements.classForm.reset();
});

// --- Auto Generator ---

elements.openAutoGenBtn.onclick = () => elements.autoGenModal.style.display = 'flex';
elements.closeModalBtn.onclick = () => elements.autoGenModal.style.display = 'none';

elements.autoGenForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const subs = document.getElementById('autoSubjects').value.split(',').map(s => s.trim());
    const teachers = document.getElementById('autoTeachers').value.split(',').map(t => t.trim());
    const periods = parseInt(document.getElementById('autoPeriods').value);
    const dayCount = parseInt(document.getElementById('autoDays').value);

    const generated = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const startTimeBase = 480; // 8:00 AM

    for (let d = 0; d < dayCount; d++) {
        for (let p = 0; p < periods; p++) {
            const startStr = `${Math.floor((startTimeBase + p * 60) / 60).toString().padStart(2, '0')}:00`;
            const endStr = `${Math.floor((startTimeBase + (p + 1) * 60) / 60).toString().padStart(2, '0')}:00`;
            
            const subIdx = (d * periods + p) % subs.length;
            generated.push({
                id: 'g' + Math.random().toString(36).substr(2, 9),
                name: subs[subIdx],
                day: days[d],
                startTime: startStr,
                endTime: endStr,
                teacher: teachers[subIdx % teachers.length],
                location: `Room ${101 + p}`,
                color: `hsl(${(subIdx * 137.5) % 360}, 70%, 80%)`
            });
        }
    }

    appState.schedules[appState.currentScheduleId].classes = generated;
    saveState();
    render();
    elements.autoGenModal.style.display = 'none';
});

// --- Actions & Exports ---

function applyTheme() {
    document.body.setAttribute('data-theme', appState.darkMode ? 'dark' : 'light');
    elements.darkModeToggle.textContent = appState.darkMode ? '☀️' : '🌙';
}

elements.darkModeToggle.onclick = () => {
    appState.darkMode = !appState.darkMode;
    saveState();
    applyTheme();
};

elements.clearBtn.onclick = () => {
    if (confirm("Clear all classes in the current schedule?")) {
        appState.schedules[appState.currentScheduleId].classes = [];
        saveState();
        render();
    }
};

elements.printBtn.onclick = () => withPrintTheme(() => window.print());

elements.pngBtn.onclick = () => withPrintTheme(async () => {
    const el = document.getElementById('timetableTable');
    const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false });
    const link = document.createElement('a');
    link.download = 'timetable.png';
    link.href = canvas.toDataURL();
    link.click();
});

elements.pdfBtn.onclick = () => withPrintTheme(async () => {
    const el = document.getElementById('timetableTable');
    const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, width - 20, 0);
    pdf.save('timetable.pdf');
});

elements.icsBtn.onclick = () => {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\n";
    classes.forEach(c => {
        ics += `BEGIN:VEVENT\nSUMMARY:${c.name}\nDESCRIPTION:${c.teacher}\nLOCATION:${c.location}\n`;
        ics += `RRULE:FREQ=WEEKLY;BYDAY=${c.day.substring(0, 2).toUpperCase()}\nDTSTART;TZID=UTC:20240101T${c.startTime.replace(':', '')}00\n`;
        ics += `DTEND;TZID=UTC:20240101T${c.endTime.replace(':', '')}00\nEND:VEVENT\n`;
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable.ics';
    a.click();
};

elements.jsonExportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup.json';
    a.click();
};

elements.jsonImportBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = r => {
            appState = JSON.parse(r.target.result);
            saveState();
            location.reload();
        };
        reader.readAsText(file);
    };
    input.click();
};

// --- Init ---
function init() {
    elements.scheduleSelect.innerHTML = `<option value="s1">${appState.schedules["s1"].name}</option>`;
    applyTheme();
    render();
}

// --- Smart Form Features ---

// 1. Auto-set End Time (+1 hour)
document.getElementById('startTime').addEventListener('change', (e) => {
    const start = e.target.value;
    if (!start) return;
    const [h, m] = start.split(':').map(Number);
    const endH = (h + 1) % 24;
    document.getElementById('endTime').value = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

// 2. Subject Memory (Autofill teacher/color)
document.getElementById('className').addEventListener('blur', (e) => {
    const name = e.target.value;
    const activeClasses = getActiveClasses();
    const pastEntry = activeClasses.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (pastEntry) {
        document.getElementById('teacherName').value = pastEntry.teacher || '';
        document.getElementById('location').value = pastEntry.location || '';
        document.getElementById('classColor').value = pastEntry.color || '#2563eb';
    }
});

init();
