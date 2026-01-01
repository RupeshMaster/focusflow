/**
 * app.js
 * Main application controller.
 */

import { db } from './storage.js';
import { scheduler } from './scheduler.js';
import { ChartRenderer } from './charts.js';

// State Management
let appState = {
    profile: null,
    subjects: [],
    timetable: [],
    notes: [],
    selectedDayIndex: 0
};

// DOM References
const views = {
    dashboard: document.getElementById('section-dashboard'),
    timetable: document.getElementById('section-timetable'),
    profile: document.getElementById('section-profile'),
    notes: document.getElementById('section-notes')
};

const nav = {
    dashboard: document.getElementById('btn-dashboard'),
    timetable: document.getElementById('btn-timetable'),
    profile: document.getElementById('btn-profile'),
    notes: document.getElementById('btn-notes')
};
const navLinksContainer = document.getElementById('nav-links');
const sections = {
    dashboard: document.getElementById('section-dashboard'),
    timetable: document.getElementById('section-timetable'),
    notes: document.getElementById('section-notes'),
    profile: document.getElementById('section-profile')
};

// Charts
let chartLoad = null;
let chartSubjects = null;


// --- INITIALIZATION ---
async function init() {
    try {
        await db.init();

        appState.profile = await db.getProfile();
        appState.subjects = (await db.getAllSubjects()) || [];
        appState.notes = (await db.getAllNotes()) || [];

        // Route: Profile Setup vs Dashboard
        if (!appState.profile) {
            showView('profile');
            showToast("Welcome! Please set up your profile.");
        } else {
            // Load current week's schedule
            const today = new Date().toISOString().split('T')[0];
            appState.timetable = await fetchCurrentWeek(today);

            showView('dashboard');
            renderDashboard();
        }

        renderSubjectList();
        renderNotesList();

    } catch (err) {
        console.error("Failed to initialize app:", err);
    }
}

async function fetchCurrentWeek(startDateStr) {
    let plans = [];
    let current = new Date(startDateStr);

    // Fetch 7 days starting from today (or start date)
    for (let i = 0; i < 7; i++) {
        const date = current.toISOString().split('T')[0];
        const plan = await db.getTimetable(date);
        if (plan) plans.push(plan);
        current.setDate(current.getDate() + 1);
    }
    return plans;
}

// --- NAVIGATION ---
function showView(viewName) {
    // Hide all
    Object.values(sections).forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('fade-in');
    });
    Object.values(nav).forEach(el => el.classList.remove('active'));

    // Show specific
    if (sections[viewName]) {
        sections[viewName].classList.remove('hidden');
        sections[viewName].classList.add('fade-in');

        if (viewName === 'dashboard') {
            requestAnimationFrame(renderDashboard);
            // Update Greeting
            const greeting = document.getElementById('dashboard-greeting');
            if (greeting) {
                const name = appState.profile ? appState.profile.name : null;
                greeting.textContent = name ? `Hello ${name}! 👋` : 'Hello! 👋';
            }
        }

        // Populate Profile Form
        if (viewName === 'profile' && appState.profile) {
            document.getElementById('inp-name').value = appState.profile.name || '';
            document.getElementById('inp-age').value = appState.profile.age || '';
            document.getElementById('inp-school-start').value = appState.profile.schoolStart || '08:00';
            document.getElementById('inp-school-end').value = appState.profile.schoolEnd || '15:00';
            document.getElementById('inp-study-start').value = appState.profile.studyStart || '';
            document.getElementById('inp-study-end').value = appState.profile.studyEnd || '';
        }
    }

    if (nav[viewName]) nav[viewName].classList.add('active');
}

Object.keys(nav).forEach(key => {
    nav[key].addEventListener('click', () => {
        showView(key);
        if (key === 'timetable') renderTimetable();
    });
});




// --- THEME HANDLING ---
const btnThemeToggle = document.getElementById('btn-theme-toggle');
// Icons
const sunIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Default to light if nothing saved, or respect system pref
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        btnThemeToggle.innerHTML = moonIcon;
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        btnThemeToggle.innerHTML = sunIcon;
    }
}

if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Update Icon with simple spin effect
        btnThemeToggle.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            btnThemeToggle.innerHTML = newTheme === 'dark' ? moonIcon : sunIcon;
            btnThemeToggle.style.transform = 'none';
        }, 150); // wait halfway for smoothness
    });
}

// Check on load
initTheme();

// --- PROFILE & SUBJECTS ---
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('inp-name').value;
    const age = parseInt(document.getElementById('inp-age').value);
    const schoolStart = document.getElementById('inp-school-start').value;
    const schoolEnd = document.getElementById('inp-school-end').value;
    const studyStart = document.getElementById('inp-study-start').value;
    const studyEnd = document.getElementById('inp-study-end').value;

    const profile = { name, age, schoolStart, schoolEnd, studyStart, studyEnd };
    await db.saveProfile(profile);
    appState.profile = profile;
    showToast("Profile saved!");
});

// --- TIME PICKER UX ---
// Open clock immediately on click (not just on icon)
['inp-study-start', 'inp-study-end', 'inp-school-start', 'inp-school-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            if (el.showPicker) el.showPicker();
        });
    }
});



document.getElementById('subject-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('inp-sub-name').value;
    const priority = document.getElementById('inp-sub-priority').value;
    const weakness = document.getElementById('inp-sub-weak').value;
    const mood = document.getElementById('inp-sub-mood').value;

    const subject = { name, priority, weakness, mood, id: Date.now() }; // simple ID
    await db.saveSubject(subject);
    appState.subjects.push(subject);

    document.getElementById('inp-sub-name').value = '';
    renderSubjectList();
    showToast("Subject added!");
});

function renderSubjectList() {
    const list = document.getElementById('subject-list');
    list.innerHTML = '';

    appState.subjects.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'subject-item';
        // Ensure the item container handles the extra edit inputs gracefully? 
        // Actually, for edit view, we might want to change class or style.
        // But subject-item class likely defines the row layout. 
        // We might need to override it for edit view if it uses flex row.

        const renderReadView = () => {
            div.innerHTML = `
                <div class="subject-name">${sub.name}</div>
                <div class="subject-tags">
                    <span>${sub.priority}</span>
                    <span>${sub.weakness}</span>
                    <span>${sub.mood}</span>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-edit" style="border:none;background:none;color:var(--text-main);cursor:pointer;" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-del" data-id="${sub.id}" style="border:none;background:none;color:#ef4444;cursor:pointer;" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            `;

            div.querySelector('.btn-edit').onclick = () => renderEditView();

            div.querySelector('.btn-del').onclick = async () => {
                if (confirm("Delete " + sub.name + "?")) {
                    await db.deleteSubject(sub.id);
                    appState.subjects = appState.subjects.filter(s => s.id !== sub.id);
                    renderSubjectList();
                }
            };
        };

        const renderEditView = () => {
            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
                    <input type="text" class="inp-edit-sub-name" value="${sub.name}" style="padding:5px; border-radius:5px; border:1px solid #ccc;">
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        <select class="inp-edit-sub-prio" style="flex:1; padding:5px; border-radius:5px;">
                            <option value="High" ${sub.priority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Medium" ${sub.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="Low" ${sub.priority === 'Low' ? 'selected' : ''}>Low</option>
                        </select>
                        <select class="inp-edit-sub-weak" style="flex:1; padding:5px; border-radius:5px;">
                            <option value="Strong" ${sub.weakness === 'Strong' ? 'selected' : ''}>Strong</option>
                            <option value="Weak" ${sub.weakness === 'Weak' ? 'selected' : ''}>Weak</option>
                        </select>
                        <select class="inp-edit-sub-mood" style="flex:1; padding:5px; border-radius:5px;">
                            <option value="Like" ${sub.mood === 'Like' ? 'selected' : ''}>Like</option>
                            <option value="Neutral" ${sub.mood === 'Neutral' ? 'selected' : ''}>Neutral</option>
                            <option value="Dislike" ${sub.mood === 'Dislike' ? 'selected' : ''}>Dislike</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button class="btn-cancel-sub" style="padding:5px 10px; border-radius:5px; border:none; background:#ef4444; color:white; cursor:pointer;">Cancel</button>
                        <button class="btn-save-sub" style="padding:5px 15px; border-radius:5px; border:none; background:var(--primary); color:white; cursor:pointer;">Save</button>
                    </div>
                </div>
            `;

            div.querySelector('.btn-cancel-sub').onclick = () => renderReadView();

            div.querySelector('.btn-save-sub').onclick = async () => {
                const newName = div.querySelector('.inp-edit-sub-name').value;
                if (!newName) return;

                // Update Object
                sub.name = newName;
                sub.priority = div.querySelector('.inp-edit-sub-prio').value;
                sub.weakness = div.querySelector('.inp-edit-sub-weak').value;
                sub.mood = div.querySelector('.inp-edit-sub-mood').value;

                await db.saveSubject(sub); // Update DB
                showToast("Subject Updated!");
                renderSubjectList(); // Re-render logic
            };
        };

        renderReadView();
        list.appendChild(div);
    });
}

// --- TIMETABLE GENERATION ---
const btnGenerate = document.getElementById('btn-generate');
const btnRegenerate = document.getElementById('btn-regenerate');

async function handleGenerate() {
    // Request Notification permission (User Interaction)
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }


    if (!appState.profile || appState.subjects.length === 0) {
        showToast("Please complete profile and add subjects first.");
        showView('profile');
        return;
    }

    try {
        const today = new Date();
        const generatedWeek = scheduler.generateWeekly(appState.profile, appState.subjects, today);


        if (generatedWeek && generatedWeek.length > 0) {
            // Save all days
            for (const plan of generatedWeek) {
                await db.saveTimetable(plan);
            }
            appState.timetable = generatedWeek;
            appState.selectedDayIndex = 0;

            showToast("Weekly Timetable Generated!");
            showView('timetable');
            renderTimetable();
        } else {
            console.warn("Generation returned empty.");
            showToast("Generation returned no slots. Check profile hours.");
        }
    } catch (e) {
        console.error("Generation failed:", e);
        showToast("Error: " + e.message);
    }
}

if (btnGenerate) btnGenerate.addEventListener('click', handleGenerate);
if (btnRegenerate) btnRegenerate.addEventListener('click', handleGenerate);

// Editing State
let editingSlot = null; // { dayIndex, slotIndex }

function renderTimetable() {
    try {
        const thead = document.getElementById('timetable-head');
        const tbody = document.getElementById('timetable-body');
        if (!thead || !tbody) {
            console.error("Table elements missing");
            return;
        }

        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!appState.timetable || !appState.timetable.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px;text-align:center;">No schedule found. Click "Regenerate" to create one.</td></tr>';
            return;
        }

        // 1. Generate Header (Time + Days)
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Time</th>';
        appState.timetable.forEach(day => {
            headerRow.innerHTML += `<th>${day.dayName.substring(0, 3)}</th>`;
        });
        thead.appendChild(headerRow);

        // 2. Identify Unique Time Slots (Rows)
        const refDay = appState.timetable[0];
        if (!refDay || !refDay.slots) return;

        refDay.slots.forEach((refSlot, slotIdx) => {
            const tr = document.createElement('tr');

            // Time Column
            const timeCell = document.createElement('td');

            const formatTime = (tStr) => {
                const parts = tStr.split(' ');
                if (parts.length < 2) return tStr;
                return `<span style="white-space:nowrap">${parts[0]} <span style="font-size:0.8em; opacity:0.8;">${parts[1]}</span></span>`;
            };

            timeCell.innerHTML = `<div style="font-weight:bold;">${formatTime(refSlot.startTime)}</div><div style="font-size:0.9em;color:var(--text-muted);margin-top:2px;">${formatTime(refSlot.endTime)}</div>`;
            tr.appendChild(timeCell);

            // Day Columns
            appState.timetable.forEach((day, dayIdx) => {
                const td = document.createElement('td');
                const slot = day.slots[slotIdx];

                if (slot) {
                    const isBreak = slot.subjectName === 'Break';
                    if (isBreak) td.classList.add('cell-break');

                    td.innerHTML = `
                        <div class="slot-cell-content">
                            <span class="slot-cell-subject">${slot.subjectName}</span>
                        </div>
                    `;

                    td.onclick = () => openEditModal(dayIdx, slotIdx);
                } else {
                    td.innerHTML = '-';
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Render Error:", e);
        showToast("Error rendering table: " + e.message);
    }
}

// --- EDIT MODAL ---
const editModal = document.getElementById('edit-modal');
const editSelect = document.getElementById('edit-subject-select');
const editStartTime = document.getElementById('edit-start-time');
const editEndTime = document.getElementById('edit-end-time');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

function convert12hTo24h(timeStr) {
    // "10:30 AM" -> "10:30", "02:00 PM" -> "14:00"
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${hours}:${minutes}`;
}

function convert24hTo12h(timeStr) {
    // "14:00" -> "02:00 PM"
    let [hours, minutes] = timeStr.split(':');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
}

function openEditModal(dayIdx, slotIdx) {
    editingSlot = { dayIdx, slotIdx };
    const day = appState.timetable[dayIdx];
    const slot = day.slots[slotIdx];

    // Populate Select
    editSelect.innerHTML = '';

    // Add "Break" option
    const optBreak = document.createElement('option');
    optBreak.value = 'Break';
    optBreak.textContent = 'Break';
    editSelect.appendChild(optBreak);

    // Add Subjects
    appState.subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.name;
        opt.textContent = sub.name;
        if (sub.name === slot.subjectName) opt.selected = true;
        editSelect.appendChild(opt);
    });

    if (slot.subjectName === 'Break') optBreak.selected = true;

    // Populate Times
    editStartTime.value = convert12hTo24h(slot.startTime);
    editEndTime.value = convert12hTo24h(slot.endTime);

    // Show
    document.getElementById('edit-slot-info').textContent = `${day.dayName}`;
    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editingSlot = null;
}

if (btnCancelEdit) btnCancelEdit.onclick = closeEditModal;

if (btnSaveEdit) btnSaveEdit.onclick = async () => {
    if (!editingSlot) return;

    const newSubject = editSelect.value;
    const newStart = editStartTime.value ? convert24hTo12h(editStartTime.value) : null;
    const newEnd = editEndTime.value ? convert24hTo12h(editEndTime.value) : null;
    const { dayIdx, slotIdx } = editingSlot;

    // Update Subject for the SPECIFIC day
    appState.timetable[dayIdx].slots[slotIdx].subjectName = newSubject;

    // Update Time for ALL days to keep the grid consistent
    if (newStart || newEnd) {
        appState.timetable.forEach(day => {
            if (day.slots[slotIdx]) {
                if (newStart) day.slots[slotIdx].startTime = newStart;
                if (newEnd) day.slots[slotIdx].endTime = newEnd;
            }
        });
    }

    // Helper for sorting
    const timeToMin = (tVal) => {
        if (!tVal) return 0;
        const [time, modifier] = tVal.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (modifier === 'PM' && h !== 12) h += 12;
        if (modifier === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    };

    // Sort ALL days
    appState.timetable.forEach(day => {
        day.slots.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
    });

    // Save ALL days to DB
    for (const day of appState.timetable) {
        await db.saveTimetable(day);
    }

    showToast("Updated!");
    renderTimetable();
    renderDashboard();
    closeEditModal();
};

// --- NOTES ---
document.getElementById('btn-save-note').addEventListener('click', async () => {
    const titleInp = document.getElementById('inp-note-title');
    const contentInp = document.getElementById('inp-note-content');

    const title = titleInp.value;
    const content = contentInp.value;

    if (!content.trim() && !title.trim()) return;

    // CREATE New
    const note = {
        title,
        content,
        timestamp: new Date().toISOString(),
        id: Date.now()
    };

    await db.saveNote(note);
    appState.notes.unshift(note);
    showToast("Note Saved");

    contentInp.value = '';
    titleInp.value = '';

    renderNotesList();
});

function renderNotesList() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    appState.notes.forEach(note => {
        const date = new Date(note.timestamp).toLocaleDateString() + ' ' + new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');
        div.className = 'note-card glass';
        div.style.marginBottom = '1rem';
        div.style.padding = '1.5rem';
        div.style.minHeight = '100px';

        // 1. READ ONLY VIEW (Default)
        const renderReadView = () => {
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div style="flex:1;">
                         ${note.title ? `<h4 style="margin:0; color:var(--primary);">${note.title}</h4>` : ''}
                         <span class="note-date" style="font-size:0.7em; color:gray;">${date}</span>
                    </div>
                    <div class="note-controls no-export" style="display:flex; gap:10px;">
                        <button class="btn-edit-note" title="Edit" style="background:none; border:none; color:var(--text-main); cursor:pointer;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-save-image" title="Save Image" style="background:none; border:none; color:var(--text-main); cursor:pointer;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        <button class="btn-del-note" title="Delete" style="background:none; border:none; color: #ef4444; cursor:pointer;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
                <p style="white-space: pre-wrap;">${note.content}</p>
            `;

            // Functionality
            div.querySelector('.btn-del-note').onclick = async () => {
                if (confirm("Delete this note?")) {
                    await db.deleteNote(note.id);
                    appState.notes = appState.notes.filter(n => n.id !== note.id);
                    renderNotesList(); // Re-render all
                    showToast("Note Deleted");
                }
            };

            div.querySelector('.btn-edit-note').onclick = () => {
                renderEditView();
            };

            div.querySelector('.btn-save-image').onclick = () => {
                captureAndDownload(div, `note-${note.title || 'untitled'}.png`);
            };
        };

        // 2. EDIT VIEW (Inline Form)
        const renderEditView = () => {
            div.innerHTML = `
                <div style="margin-bottom:1rem; display:flex; flex-direction:column; gap:8px;">
                     <input type="text" class="inp-edit-title" value="${note.title || ''}" placeholder="Title" style="padding:8px; border-radius:5px; border:1px solid #ccc; background:var(--glass-bg); color:var(--text-main);">
                     <div style="font-size:0.7em; color:gray;">${date} (Editing)</div>
                </div>
                <textarea class="inp-edit-content" style="width:100%; min-height:80px; padding:8px; border-radius:5px; border:1px solid #ccc; background:var(--glass-bg); color:var(--text-main); margin-bottom:10px;">${note.content}</textarea>
                
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn-cancel-edit" style="padding:5px 10px; border-radius:5px; border:none; background:#ef4444; color:white; cursor:pointer;">Cancel</button>
                    <button class="btn-save-edit" style="padding:5px 15px; border-radius:5px; border:none; background:var(--primary); color:white; cursor:pointer;">Save</button>
                </div>
            `;

            div.querySelector('.btn-cancel-edit').onclick = () => {
                renderReadView(); // Revert
            };

            div.querySelector('.btn-save-edit').onclick = async () => {
                const newTitle = div.querySelector('.inp-edit-title').value;
                const newContent = div.querySelector('.inp-edit-content').value;

                if (!newContent.trim() && !newTitle.trim()) return;

                // Update Object
                note.title = newTitle;
                note.content = newContent;
                note.timestamp = new Date().toISOString(); // Update timestamp to reflect modification

                await db.saveNote(note);
                showToast("Note Updated");
                renderNotesList(); // Refresh list to ensure clean state
            };
        };

        // Initial Render
        renderReadView();
        list.appendChild(div);
    });
}


// --- DASHBOARD CHARTS ---
function renderDashboard() {
    // Only render if we have data
    if (!appState.subjects.length) return;

    if (!chartSubjects) chartSubjects = new ChartRenderer('chart-subjects');
    if (!chartLoad) chartLoad = new ChartRenderer('chart-load');

    // 1. Subjects Mix (Based on Count/Priority)
    // Let's visualize Priority distribution
    const high = appState.subjects.filter(s => s.priority === 'High').length;
    const med = appState.subjects.filter(s => s.priority === 'Medium').length;
    const low = appState.subjects.filter(s => s.priority === 'Low').length;

    chartSubjects.drawPieChart([
        { label: 'High', value: high, color: '#ef4444' }, // Red
        { label: 'Med', value: med, color: '#f59e0b' },  // Orange
        { label: 'Low', value: low, color: '#10b981' }   // Emerald
    ]);

    // 2. Study Load (Age based duration vs Available)
    // Simulation: Total mins required vs Total available?
    // For now, let's just show Subject Count vs Weak Subjects
    const weak = appState.subjects.filter(s => s.weakness === 'Weak').length;
    const strong = appState.subjects.filter(s => s.weakness === 'Strong').length;

    chartLoad.drawBarChart([
        { label: 'Weak', value: weak, color: '#ef4444' },
        { label: 'Strong', value: strong, color: '#3b82f6' }
    ]);
}

// --- EXPORT FUNCTIONALITY ---
async function captureAndDownload(element, filename) {
    if (!element) return;

    showToast("Generating image...");
    try {
        const canvas = await html2canvas(element, {
            scale: 2, // Higher resolution
            backgroundColor: getComputedStyle(document.body).getPropertyValue('--glass-bg'),
            useCORS: true,
            logging: false,
            ignoreElements: (el) => el.classList.contains('no-export')
        });

        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast("Image saved!");
    } catch (err) {
        console.error("Export failed:", err);
        showToast("Export failed.");
    }
}

// Attach export listeners safely after DOM load
setTimeout(() => {
    const btnExportTimetable = document.getElementById('btn-export-timetable');
    if (btnExportTimetable) {
        btnExportTimetable.addEventListener('click', () => {
            const table = document.querySelector('.timetable-table');
            captureAndDownload(table, 'focusflow-timetable.png');
        });
    }
}, 500); // Slight delay to ensure charts/tables are rendered if needed, though they are static structure

// --- UTILS ---
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

// Start
window.addEventListener('DOMContentLoaded', init);

