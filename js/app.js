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

        // Fix for charts resizing when hidden
        if (viewName === 'dashboard') requestAnimationFrame(renderDashboard);

        // Populate Profile Form
        if (viewName === 'profile' && appState.profile) {
            document.getElementById('inp-age').value = appState.profile.age || '';
            document.getElementById('inp-school-start').value = appState.profile.schoolStart || '08:00';
            document.getElementById('inp-school-end').value = appState.profile.schoolEnd || '15:00';
            document.getElementById('inp-pref-slot').value = appState.profile.prefSlot || 'Any';
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

// Mobile Menu Toggle
const btnMenu = document.getElementById('btn-menu');
if (btnMenu) {
    btnMenu.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
    });
}

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
    const age = parseInt(document.getElementById('inp-age').value);
    const schoolStart = document.getElementById('inp-school-start').value;
    const schoolEnd = document.getElementById('inp-school-end').value;
    const studyStart = document.getElementById('inp-study-start').value;
    const studyEnd = document.getElementById('inp-study-end').value;

    const profile = { age, schoolStart, schoolEnd, studyStart, studyEnd };
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
    const priority = document.getElementById('inp-sub-prio').value;
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
        div.innerHTML = `
            <div class="subject-name">${sub.name}</div>
            <div class="subject-tags">
                <span>${sub.priority}</span>
                <span>${sub.weakness}</span>
                <span>${sub.mood}</span>
            </div>
            <button class="btn-del" data-id="${sub.id}" style="border:none;background:none;color:red;cursor:pointer;">&times;</button>
        `;
        list.appendChild(div);

        div.querySelector('.btn-del').addEventListener('click', async (e) => {
            const id = parseInt(e.target.dataset.id);
            await db.deleteSubject(id);
            appState.subjects = appState.subjects.filter(s => s.id !== id);
            renderSubjectList();
        });
    });
}

// --- TIMETABLE GENERATION ---
const btnGenerate = document.getElementById('btn-generate');
const btnRegenerate = document.getElementById('btn-regenerate');

async function handleGenerate() {
    if (!appState.profile || appState.subjects.length === 0) {
        showToast("Please complete profile and add subjects first.");
        showView('profile');
        return;
    }

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
        showToast("Generation failed.");
    }
}

if (btnGenerate) btnGenerate.addEventListener('click', handleGenerate);
if (btnRegenerate) btnRegenerate.addEventListener('click', handleGenerate);

// Editing State
let editingSlot = null; // { dayIndex, slotIndex }

function renderTimetable() {
    try {
        console.log("Rendering Timetable...", appState.timetable);
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
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

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

    // Show
    document.getElementById('edit-slot-info').textContent = `${day.dayName} @ ${slot.startTime} - ${slot.endTime}`;
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
    const { dayIdx, slotIdx } = editingSlot;

    // Update State
    appState.timetable[dayIdx].slots[slotIdx].subjectName = newSubject;

    // Save to DB (update entire day or specific logic?)
    // Our DB has saveTimetable(dayPlan) which upserts by date.
    await db.saveTimetable(appState.timetable[dayIdx]);

    showToast("Updated!");
    renderTimetable();
    renderDashboard(); // Update stats potentially
    closeEditModal();
};

// --- NOTES ---
// --- NOTES ---
document.getElementById('btn-save-note').addEventListener('click', async () => {
    const title = document.getElementById('inp-note-title').value;
    const content = document.getElementById('inp-note-content').value;

    if (!content.trim() && !title.trim()) return;

    const note = {
        title,
        content,
        timestamp: new Date().toISOString(),
        id: Date.now()
    };

    await db.saveNote(note);
    appState.notes.unshift(note);

    document.getElementById('inp-note-content').value = '';
    document.getElementById('inp-note-title').value = '';

    renderNotesList();
    showToast("Note Saved");
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

        const titleHtml = note.title ? `<h4 style="margin:0; color:var(--primary);">${note.title}</h4>` : '<h4 style="margin:0; opacity:0">.</h4>'; // Placeholder for alignment

        // Header Flex: Title - Date - Controls
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <div style="flex:1;">
                     ${note.title ? `<h4 style="margin:0; color:var(--primary);">${note.title}</h4>` : ''}
                     <span class="note-date" style="font-size:0.7em; color:gray;">${date}</span>
                </div>
                <div class="note-controls no-export" style="display:flex; gap:10px;">
                    <button class="btn-save-note-img" data-id="${note.id}" title="Save as Image" style="background:none; border:none; color:var(--text-main); cursor:pointer;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button class="btn-del-note" data-id="${note.id}" title="Delete" style="background:none; border:none; color: #ef4444; font-size:1.2rem; cursor:pointer;">
                        &times;
                    </button>
                </div>
            </div>
            <p style="white-space: pre-wrap;">${note.content}</p>
        `;
        list.appendChild(div);

        // Delete Handler
        div.querySelector('.btn-del-note').addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            if (confirm("Delete this note?")) {
                await db.deleteNote(id);
                appState.notes = appState.notes.filter(n => n.id !== id);
                renderNotesList();
                showToast("Note Deleted");
            }
        });

        // Save Image Handler
        div.querySelector('.btn-save-note-img').addEventListener('click', () => {
            captureAndDownload(div, `note-${note.title || 'untitled'}.png`);
        });
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
