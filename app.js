// DOM Elements
const inputText = document.getElementById('input-text');
const eventColorInput = document.createElement('input');
eventColorInput.type = 'color';
eventColorInput.id = 'event-color';
eventColorInput.value = '#3b82f6';
eventColorInput.style.display = 'none'; // Hidden but functional
document.body.appendChild(eventColorInput);

const colorPalette = document.getElementById('color-palette');
const btnVoiceInput = document.getElementById('btn-voice-input');
const parsingFeedback = document.getElementById('parsing-feedback');
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYear = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const btnOpenSync = document.getElementById('btn-open-sync');
const calendarSection = document.getElementById('calendar-section');
const appTitle = document.getElementById('app-title');

// Load saved title
if (appTitle) {
    const savedTitle = localStorage.getItem('app_title');
    if (savedTitle) {
        appTitle.textContent = savedTitle;
    }

    // Long press to change title
    let pressTimer;

    const startPress = (e) => {
        pressTimer = setTimeout(() => {
            const newTitle = prompt("새로운 앱 제목을 입력하세요:", appTitle.textContent);
            if (newTitle) {
                appTitle.textContent = newTitle;
                localStorage.setItem('app_title', newTitle);
            }
        }, 800); // 800ms for long press
    };

    const cancelPress = () => {
        clearTimeout(pressTimer);
    };

    appTitle.addEventListener('mousedown', startPress);
    appTitle.addEventListener('touchstart', startPress, { passive: true });

    appTitle.addEventListener('mouseup', cancelPress);
    appTitle.addEventListener('mouseleave', cancelPress);
    appTitle.addEventListener('touchend', cancelPress);
    appTitle.addEventListener('touchmove', cancelPress);
}

// Tab Elements
const tabCalendar = document.getElementById('tab-calendar');
const tabList = document.getElementById('tab-list');
const eventListSection = document.getElementById('event-list-section');
const eventListContainer = document.getElementById('event-list-container');

// Modal Elements
const modal = document.getElementById('event-modal');
const closeModal = document.getElementById('close-modal');
const editTitle = document.getElementById('edit-title');
const editStart = document.getElementById('edit-start');
const editEnd = document.getElementById('edit-end');
const editAllDay = document.getElementById('edit-all-day'); // New Checkbox
const editDesc = document.getElementById('edit-desc');
const editColor = document.getElementById('edit-color');
const colorPreviewText = document.getElementById('color-preview-text');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalBtnDelete = document.getElementById('modal-btn-delete');

// Day Detail Modal Elements
const dayDetailModal = document.getElementById('day-detail-modal');
const closeDayDetail = document.getElementById('close-day-detail');
const dayDetailDate = document.getElementById('day-detail-date');
const dayDetailList = document.getElementById('day-detail-list');
const btnAddEventBottom = document.getElementById('btn-add-event-bottom');

// API Config
const CLIENT_ID = '548955285266-anr16ad0iudd6ej88oceg5ahs6je6lgs.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

// --- State Variables ---
let currentMode = 'mobile'; // Always mobile mode
let events = [];
let deletedEvents = []; // Track deleted events for sync
let currentDate = new Date();
let currentlyOpenEvent = null;
// OAuth
let gapiInited = false;
let gisInited = false;
let tokenClient;
// Voice recognition
let voiceRecognition = null;
let isVoiceListening = false;

const predefinedColors = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#64748b'  // Slate
];

// --- Category Logic (Moved to top for safety) ---
let EVENT_CATEGORIES = [
    { id: 'work', label: '업무', color: '#3b82f6', keywords: ['회의', '미팅', '보고', '출장', '워크샵', '업무', '프로젝트', '마감'] },
    { id: 'personal', label: '개인', color: '#22c55e', keywords: ['약속', '저녁', '점심', '여행', '휴가', '데이트', '생일', '병원', '가족', '식사'] },
    { id: 'exercise', label: '운동', color: '#f97316', keywords: ['헬스', '요가', '필라테스', '러닝', '산책', '축구', '운동', '수영', '등산'] },
    { id: 'study', label: '공부', color: '#8b5cf6', keywords: ['공부', '스터디', '강의', '수업', '학원', '시험', '과제'] },
    { id: 'etc', label: '기타', color: '#64748b', keywords: [] }
];

// Load custom categories from localStorage
const storedCategories = localStorage.getItem('customCategories');
if (storedCategories) {
    try {
        const parsed = JSON.parse(storedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
            EVENT_CATEGORIES = parsed;
        }
    } catch (e) {
        console.error("Failed to load categories", e);
    }
}

function predictCategory(text) {
    if (!text) return EVENT_CATEGORIES[4]; // Default to 'etc'

    for (const cat of EVENT_CATEGORIES) {
        if (cat.id === 'etc') continue;
        for (const keyword of cat.keywords) {
            if (text.includes(keyword)) {
                return cat;
            }
        }
    }
    return EVENT_CATEGORIES[4]; // Default to 'etc'
}

// Load Events & Initialize
loadEvents();
setMode('mobile'); // Always start in mobile mode
renderCalendar();


// Initialize Color Palettes
// Initialize Category Chips
const categoryRow = document.getElementById('category-row');
if (categoryRow) {
    renderCategoryChips(categoryRow, eventColorInput);
}

const modalColorPalette = document.getElementById('modal-color-palette');
if (modalColorPalette) {
    renderCategoryChips(modalColorPalette, document.getElementById('edit-color'));
}

// Force Light Mode as Default
document.body.classList.add('light-mode');
localStorage.setItem('theme', 'light');

// Theme Toggle (checkbox)
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
if (themeToggleCheckbox) {
    themeToggleCheckbox.checked = false; // Ensure checkbox reflects light mode

    themeToggleCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Dark mode
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            // Light mode
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        }
    });
}

// Appearance Settings
const btnAppearance = document.getElementById('btn-appearance');
console.log('Appearance Button:', btnAppearance); // Debug Log
const appearanceModal = document.getElementById('appearance-modal');
const closeAppearance = document.getElementById('close-appearance');
const themeLightBtn = document.getElementById('theme-light');
const themeDarkBtn = document.getElementById('theme-dark');
const uiFontSelect = document.getElementById('ui-font');
const btnAppearanceSave = document.getElementById('btn-appearance-save');
const savedUIFont = localStorage.getItem('ui-font') || "'Jua', sans-serif";

function applyUISettings() {
    const font = localStorage.getItem('ui-font') || "'Jua', sans-serif";
    // Use CSS variable for font size (default 16px as base)
    document.documentElement.style.setProperty('--ui-font-size', '16px');

    // Also apply to common elements explicitly for better visibility
    // Load granular font sizes
    const fsTabs = localStorage.getItem('fs-tabs') || '16';
    const fsAppTitle = localStorage.getItem('fs-app-title') || '24';
    const fsCalHeader = localStorage.getItem('fs-cal-header') || '16';
    const fsCalEvents = localStorage.getItem('fs-cal-events') || '12';
    const fsCalDate = localStorage.getItem('fs-cal-date') || '16';
    const fsListHeader = localStorage.getItem('fs-list-header') || '18';
    const fsListContent = localStorage.getItem('fs-list-content') || '16';

    const style = document.createElement('style');
    style.id = 'dynamic-font-size-styles';

    // Remove existing dynamic styles
    const existing = document.getElementById('dynamic-font-size-styles');
    if (existing) existing.remove();

    style.textContent = `
        /* Base UI Font Size (Fixed at 16px, overridden by specific settings) */
        .input-row input, .input-row textarea, .form-group label, .form-group input, .form-group select, .form-group textarea, .modal-content:not(#diary-settings-modal) *, .parsing-feedback, .category-row * {
            font-size: 16px !important;
        }

        /* 1. Tabs */
        .tab-btn { font-size: ${fsTabs}px !important; }

        /* 2. App Title */
        .title-row h2 { font-size: ${fsAppTitle}px !important; }

        /* 3. Calendar Header */
        .calendar-header button, .day-name { font-size: ${fsCalHeader}px !important; }

        /* 4. Calendar Events */
        .event-card, .event-card-title, .event-card-time { font-size: ${fsCalEvents}px !important; }

        /* 5. Calendar Dates */
        .calendar-grid .day-number { font-size: ${fsCalDate}px !important; }

        /* 6. List View Headers */
        .list-group-header { font-size: ${fsListHeader}px !important; }

        /* 7. List View Content */
        .list-item, .list-item-title, .list-item-time { font-size: ${fsListContent}px !important; }
    `;

    document.head.appendChild(style);
}

// Apply on load
applyUISettings();

if (btnAppearance) {
    btnAppearance.addEventListener('click', () => {
        console.log('Appearance Button Clicked'); // Debug Log
        // Load current settings
        const currentTheme = localStorage.getItem('theme') || 'light';
        const currentFont = localStorage.getItem('ui-font') || "'Jua', sans-serif";
        const currentSize = localStorage.getItem('ui-font-size') || '16';

        // Update UI to reflect current settings
        if (currentTheme === 'light') {
            themeLightBtn.style.background = '#3b82f6';
            themeLightBtn.style.color = 'white';
            themeDarkBtn.style.background = '#e5e7eb';
            themeDarkBtn.style.color = '#374151';
        } else {
            themeDarkBtn.style.background = '#3b82f6';
            themeDarkBtn.style.color = 'white';
            themeLightBtn.style.background = '#e5e7eb';
            themeLightBtn.style.color = '#374151';
        }

        uiFontSelect.value = currentFont;

        // Highlight current font size buttons
        const updateFontSizeButtons = (target, value) => {
            document.querySelectorAll(`.fs-btn[data-target="${target}"]`).forEach(btn => {
                if (btn.dataset.value === value) {
                    btn.style.background = '#3b82f6';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = '#e5e7eb';
                    btn.style.color = '#374151';
                }
            });
        };

        // Load and highlight current settings
        updateFontSizeButtons('fs-tabs', localStorage.getItem('fs-tabs') || '16');
        updateFontSizeButtons('fs-app-title', localStorage.getItem('fs-app-title') || '24');
        updateFontSizeButtons('fs-cal-header', localStorage.getItem('fs-cal-header') || '16');
        updateFontSizeButtons('fs-cal-events', localStorage.getItem('fs-cal-events') || '12');
        updateFontSizeButtons('fs-cal-date', localStorage.getItem('fs-cal-date') || '16');
        updateFontSizeButtons('fs-list-header', localStorage.getItem('fs-list-header') || '18');
        updateFontSizeButtons('fs-list-content', localStorage.getItem('fs-list-content') || '16');

        appearanceModal.classList.remove('hidden');
    });
}

if (closeAppearance) {
    closeAppearance.addEventListener('click', () => {
        appearanceModal.classList.add('hidden');
    });
}

if (themeLightBtn) {
    themeLightBtn.addEventListener('click', () => {
        themeLightBtn.style.background = '#3b82f6';
        themeLightBtn.style.color = 'white';
        themeDarkBtn.style.background = '#e5e7eb';
        themeDarkBtn.style.color = '#374151';
    });
}

if (themeDarkBtn) {
    themeDarkBtn.addEventListener('click', () => {
        themeDarkBtn.style.background = '#3b82f6';
        themeDarkBtn.style.color = 'white';
        themeLightBtn.style.background = '#e5e7eb';
        themeLightBtn.style.color = '#374151';
    });
}

// Font size button handlers
if (appearanceModal) {
    appearanceModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('fs-btn')) {
            const target = e.target.dataset.target;
            const value = e.target.dataset.value;

            // Update button styles
            document.querySelectorAll(`.fs-btn[data-target="${target}"]`).forEach(btn => {
                if (btn === e.target) {
                    btn.style.background = '#3b82f6';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = '#e5e7eb';
                    btn.style.color = '#374151';
                }
            });
        }
    });
}

if (btnAppearanceSave) {
    btnAppearanceSave.addEventListener('click', () => {
        // Determine selected theme
        const isLightSelected = themeLightBtn.style.background.includes('59, 130, 246') || themeLightBtn.style.background === '#3b82f6';
        const theme = isLightSelected ? 'light' : 'dark';

        // Save settings
        localStorage.setItem('theme', theme);
        localStorage.setItem('ui-font', uiFontSelect.value);

        // Save granular settings from selected buttons
        const getSelectedValue = (target) => {
            const selectedBtn = document.querySelector(`.fs-btn[data-target="${target}"][style*="rgb(59, 130, 246)"]`) ||
                document.querySelector(`.fs-btn[data-target="${target}"][style*="#3b82f6"]`);
            return selectedBtn ? selectedBtn.dataset.value : null;
        };

        localStorage.setItem('fs-tabs', getSelectedValue('fs-tabs') || '16');
        localStorage.setItem('fs-app-title', getSelectedValue('fs-app-title') || '24');
        localStorage.setItem('fs-cal-header', getSelectedValue('fs-cal-header') || '16');
        localStorage.setItem('fs-cal-events', getSelectedValue('fs-cal-events') || '12');
        localStorage.setItem('fs-cal-date', getSelectedValue('fs-cal-date') || '16');
        localStorage.setItem('fs-list-header', getSelectedValue('fs-list-header') || '18');
        localStorage.setItem('fs-list-content', getSelectedValue('fs-list-content') || '16');

        // Apply theme
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            if (themeToggleCheckbox) themeToggleCheckbox.checked = false;
        } else {
            document.body.classList.remove('light-mode');
            if (themeToggleCheckbox) themeToggleCheckbox.checked = true;
        }

        // Apply UI settings
        applyUISettings();

        appearanceModal.classList.add('hidden');
    });
}

// Debug: Global click listener for mobile mode
document.addEventListener('click', (e) => {
    if (currentMode === 'mobile') {
        console.log('[MOBILE CLICK DEBUG]', {
            target: e.target,
            className: e.target.className,
            tagName: e.target.tagName,
            x: e.clientX,
            y: e.clientY
        });
    }
}, true); // Capture phase to catch all clicks



function setMode(mode) {
    currentMode = mode;
    if (mode === 'mobile') {
        document.body.classList.add('mobile-simulator');
        console.log(`Mobile mode enabled`);
    }
    // Trigger resize to adjust calendar if needed
    window.dispatchEvent(new Event('resize'));
}




// Diary Elements
const btnDiaryToggle = document.getElementById('btn-diary-toggle');
const btnDiaryBack = document.getElementById('btn-diary-back');
const diarySection = document.getElementById('diary-section');
const diaryCover = document.getElementById('diary-cover');
const diaryDateTitle = document.getElementById('diary-date-title');
const diaryPrevDay = document.getElementById('diary-prev-day');
const diaryNextDay = document.getElementById('diary-next-day');
const diaryPaper = document.getElementById('diary-paper');
const diaryContentLayer = document.getElementById('diary-content-layer');
const diaryCanvas = document.getElementById('diary-canvas');
const diaryBackground = document.getElementById('diary-background');
const toolPen = document.getElementById('tool-pen');
const toolEraser = document.getElementById('tool-eraser');
const penSettings = document.getElementById('pen-settings');
const penColorInput = document.getElementById('pen-color');
const penWidthInput = document.getElementById('pen-width');
const toolPhoto = document.getElementById('tool-photo');
const photoInput = document.getElementById('photo-input');
// Settings Elements
const btnDiarySettings = document.getElementById('btn-diary-settings');
const diarySettingsModal = document.getElementById('diary-settings-modal');
const closeDiarySettings = document.getElementById('close-diary-settings');
const diaryPaperType = document.getElementById('diary-paper-type');
const diaryPaperColor = document.getElementById('diary-paper-color');

// Canvas Context
let ctx = null;
if (diaryCanvas) {
    ctx = diaryCanvas.getContext('2d');
}

// Diary State
let isDiaryMode = false;
let currentDiaryDate = new Date();
let isPenActive = false;
let isEraserActive = false;
let penColor = '#000000';
let penWidth = 2;
let diaryBackgroundStyle = 'lined'; // lined, grid, dot, plain
let diaryBackgroundColor = '#fdfbf7';

// Open Diary
if (btnDiaryToggle) {
    btnDiaryToggle.addEventListener('click', () => {
        isDiaryMode = true;

        // 1. Show Diary Section (Overlay)
        diarySection.classList.remove('hidden');
        diaryCover.classList.remove('hidden'); // Make sure it's visible
        diaryCover.classList.remove('open'); // Ensure it starts closed
        diaryCover.classList.remove('close');

        // Hide Appearance button in diary mode
        if (btnAppearance) {
            btnAppearance.style.display = 'none';
        }

        // 2. Prepare Data
        currentDiaryDate = new Date(currentDate);
        resizeCanvas(); // Ensure canvas size is correct
        renderDiary();

        // 3. Animation Sequence
        // Small delay to allow display:block to apply before animating
        requestAnimationFrame(() => {
            setTimeout(() => {
                diaryCover.classList.add('open');
                diarySection.classList.add('active'); // Trigger content fade in
            }, 100);
        });
    });
}

// Close Diary (Back Button)
if (btnDiaryBack) {
    btnDiaryBack.addEventListener('click', () => {
        // 1. Close Cover (Animation)
        diaryCover.classList.remove('hidden'); // Ensure visible
        diaryCover.classList.remove('open');
        void diaryCover.offsetWidth; // Force reflow
        diaryCover.classList.add('close');

        diarySection.classList.remove('active'); // Fade out content

        // 2. Hide Section after animation
        setTimeout(() => {
            diarySection.classList.add('hidden');
            diaryCover.classList.add('hidden');
            isDiaryMode = false;

            // Show Appearance button in calendar/list mode
            if (btnAppearance) {
                btnAppearance.style.display = '';
            }
        }, 700); // Match CSS animation time (0.7s)
    });
}

// --- Diary Logic ---

// --- Diary Logic ---

let diaryData = {}; // { "YYYY-MM-DD": { items: [], canvasData: "data:image...", background: "lined" } }
// Legacy support: if array, convert to object structure on load

// Load Diary Data
const storedDiary = localStorage.getItem('diary_decorations');
if (storedDiary) {
    try {
        diaryData = JSON.parse(storedDiary);
        // Migration check
        for (let key in diaryData) {
            if (Array.isArray(diaryData[key])) {
                diaryData[key] = { items: diaryData[key], canvasData: null, background: 'lined', backgroundColor: '#fdfbf7' };
            }
        }
    } catch (e) {
        console.error("Failed to load diary data", e);
    }
}

function saveDiaryData() {
    localStorage.setItem('diary_decorations', JSON.stringify(diaryData));
}

function getDiaryKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function renderDiary() {
    // Update Title
    const year = currentDiaryDate.getFullYear();
    const month = currentDiaryDate.getMonth() + 1;
    const date = currentDiaryDate.getDate();
    const day = ['일', '월', '화', '수', '목', '금', '토'][currentDiaryDate.getDay()];

    diaryDateTitle.textContent = `${year}년 ${month}월 ${date}일 (${day})`;

    // Clear previous content
    diaryContentLayer.innerHTML = '';

    // Load Decorations
    const key = getDiaryKey(currentDiaryDate);
    const dayData = diaryData[key] || { items: [], canvasData: null, background: 'lined', backgroundColor: '#fdfbf7' };

    // Set Background
    setDiaryBackground(dayData.background || 'lined', dayData.backgroundColor || '#fdfbf7');

    // Load Canvas
    if (dayData.canvasData) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, diaryCanvas.width, diaryCanvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = dayData.canvasData;
    } else {
        ctx.clearRect(0, 0, diaryCanvas.width, diaryCanvas.height);
    }

    // Load Items
    const items = dayData.items || [];
    items.forEach(item => {
        createDiaryItemElement(item);
    });
}

function setDiaryBackground(style, color) {
    diaryBackgroundStyle = style;
    diaryBackgroundColor = color;

    diaryBackground.className = 'diary-background'; // Reset
    diaryBackground.innerHTML = '';
    diaryBackground.style.backgroundImage = '';
    diaryBackground.style.backgroundColor = color; // Apply color

    if (style === 'lined') {
        diaryBackground.style.backgroundImage = 'linear-gradient(#e5e7eb 1px, transparent 1px)';
        diaryBackground.style.backgroundSize = '100% 2.5rem';
        diaryBackground.style.marginTop = '3rem';
    } else if (style === 'lined-narrow') {
        diaryBackground.style.backgroundImage = 'linear-gradient(#e5e7eb 1px, transparent 1px)';
        diaryBackground.style.backgroundSize = '100% 1.5rem';
        diaryBackground.style.marginTop = '3rem';
    } else if (style === 'grid') {
        diaryBackground.style.backgroundImage = 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)';
        diaryBackground.style.backgroundSize = '20px 20px';
        diaryBackground.style.marginTop = '0';
    } else if (style === 'dot') {
        diaryBackground.style.backgroundImage = 'radial-gradient(#d1d5db 1px, transparent 1px)';
        diaryBackground.style.backgroundSize = '20px 20px';
        diaryBackground.style.marginTop = '0';
    } else if (style === 'plain') {
        diaryBackground.style.marginTop = '0';
    }
}

function resizeCanvas() {
    if (!diaryCanvas || !diaryPaper) return;
    const rect = diaryPaper.getBoundingClientRect();
    diaryCanvas.width = rect.width;
    diaryCanvas.height = rect.height;
}

// Ensure canvas resizes with window
window.addEventListener('resize', () => {
    if (isDiaryMode) resizeCanvas();
});

function createDiaryItemElement(item) {
    const el = document.createElement('div');
    el.classList.add('diary-item');
    el.style.position = 'absolute';
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.top = item.y + 'px';
    el.style.cursor = 'move';
    el.style.userSelect = 'none';
    el.style.zIndex = item.zIndex || '10';
    el.style.transform = `rotate(${item.rotation || 0}deg)`;

    // Controls Wrapper
    const controls = document.createElement('div');
    controls.className = 'item-controls';

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'control-handle resize-handle';
    controls.appendChild(resizeHandle);

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'control-handle rotate-handle';
    controls.appendChild(rotateHandle);

    const deleteHandle = document.createElement('div');
    deleteHandle.className = 'control-handle delete-handle';
    controls.appendChild(deleteHandle);

    let textColorHandle = null;
    if (item.type === 'text') {
        textColorHandle = document.createElement('div');
        textColorHandle.className = 'control-handle text-color-handle';
        controls.appendChild(textColorHandle);
    }

    const layerUpHandle = document.createElement('div');
    layerUpHandle.className = 'control-handle layer-up-handle';
    controls.appendChild(layerUpHandle);

    const layerDownHandle = document.createElement('div');
    layerDownHandle.className = 'control-handle layer-down-handle';
    controls.appendChild(layerDownHandle);

    el.appendChild(controls);

    // Content
    const contentDiv = document.createElement('div');
    contentDiv.style.pointerEvents = 'none'; // Clicks go to parent
    contentDiv.style.width = '100%';
    contentDiv.style.height = '100%';
    contentDiv.style.display = 'flex';
    contentDiv.style.alignItems = 'center';
    contentDiv.style.justifyContent = 'center';

    if (item.type === 'sticker') {
        contentDiv.textContent = item.content;
        // Scale font size based on width/height ratio or just use width
        const size = item.width || 50;
        contentDiv.style.fontSize = `${size}px`;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
    } else if (item.type === 'text') {
        contentDiv.textContent = item.content;
        const fontSize = item.fontSize || 40; // Increased from 20 to 40
        contentDiv.style.fontSize = `${fontSize}px`;
        contentDiv.style.color = item.color || '#374151';
        contentDiv.style.fontFamily = item.fontFamily || "'Nanum Pen Script', cursive";
        contentDiv.style.whiteSpace = 'nowrap';
        // Auto width for text
    } else if (item.type === 'photo') {
        const img = document.createElement('img');
        img.src = item.content;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        contentDiv.appendChild(img);
        el.style.width = `${item.width || 150}px`;
        el.style.height = `${item.height || 150}px`;
    }

    el.appendChild(contentDiv);

    // Selection Logic
    el.addEventListener('mousedown', (e) => {
        // Deselect others
        document.querySelectorAll('.diary-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        e.stopPropagation(); // Prevent canvas drawing
    });

    // Drag Logic
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    const onMouseDown = (e) => {
        if (e.target.classList.contains('control-handle')) return;

        isDragging = true;
        startX = e.clientX || e.touches[0].clientX;
        startY = e.clientY || e.touches[0].clientY;
        initialLeft = parseFloat(el.style.left);
        initialTop = parseFloat(el.style.top);
        el.style.zIndex = '100'; // Bring to front
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;

        el.style.left = `${initialLeft + dx}px`;
        el.style.top = `${initialTop + dy}px`;
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        el.style.zIndex = item.zIndex || '10'; // Restore original z-index or default

        // Update Data
        item.x = parseFloat(el.style.left);
        item.y = parseFloat(el.style.top);
        saveDiaryData();
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('touchstart', onMouseDown, { passive: false });

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onMouseMove, { passive: false });

    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);

    // Resize Logic
    let isResizing = false;
    let startResizeX, startResizeY, startWidth, startHeight, startFontSize;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startResizeX = e.clientX;
        startResizeY = e.clientY;
        startWidth = el.offsetWidth;
        startHeight = el.offsetHeight;
        if (item.type === 'text') startFontSize = item.fontSize || 40; // Match new default
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const dx = e.clientX - startResizeX;
        const dy = e.clientY - startResizeY;

        // Aspect Ratio Logic
        // Use the larger delta to drive the size change to keep it square/proportional
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const newSize = Math.max(20, startWidth + delta);

        if (item.type === 'text') {
            // Scale font size
            const scaleRatio = newSize / startWidth;
            const newFontSize = startFontSize * scaleRatio;
            contentDiv.style.fontSize = `${newFontSize}px`;
            item.fontSize = newFontSize;
        } else {
            // Enforce aspect ratio for sticker and photo
            el.style.width = `${newSize}px`;
            el.style.height = `${newSize}px`;
            item.width = newSize;
            item.height = newSize;

            if (item.type === 'sticker') {
                contentDiv.style.fontSize = `${newSize}px`;
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            saveDiaryData();
        }
    });

    // Rotate Logic
    let isRotating = false;
    let startRotateX, startRotateY, startRotation;

    rotateHandle.addEventListener('mousedown', (e) => {
        isRotating = true;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        startRotateX = e.clientX - centerX;
        startRotateY = e.clientY - centerY;
        startRotation = item.rotation || 0;
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isRotating) return;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;

        const angle = Math.atan2(dy, dx);
        const startAngle = Math.atan2(startRotateY, startRotateX);
        const deg = (angle - startAngle) * (180 / Math.PI);

        const newRotation = startRotation + deg;
        el.style.transform = `rotate(${newRotation}deg)`;
        item.rotation = newRotation;
    });

    window.addEventListener('mouseup', () => {
        if (isRotating) {
            isRotating = false;
            saveDiaryData();
        }
    });

    // Delete Logic
    deleteHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent drag
        if (confirm('삭제하시겠습니까?')) {
            el.remove();
            const key = getDiaryKey(currentDiaryDate);
            if (diaryData[key] && diaryData[key].items) {
                diaryData[key].items = diaryData[key].items.filter(i => i !== item);
                saveDiaryData();
            }
        }
    });

    // Text Settings Logic (Color + Font)
    if (textColorHandle) {
        textColorHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();

            // Create mini modal for text settings
            const settingsModal = document.createElement('div');
            settingsModal.style.position = 'fixed';
            settingsModal.style.top = '50%';
            settingsModal.style.left = '50%';
            settingsModal.style.transform = 'translate(-50%, -50%)';
            settingsModal.style.background = 'rgba(255, 255, 255, 0.95)';
            settingsModal.style.padding = '1.5rem';
            settingsModal.style.borderRadius = '12px';
            settingsModal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
            settingsModal.style.zIndex = '3000';
            settingsModal.style.minWidth = '250px';

            settingsModal.innerHTML = `
                <h3 style="margin: 0 0 1rem 0; color: #374151;">Text Settings</h3>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #6b7280;">Color</label>
                    <input type="color" id="temp-text-color" value="${item.color || '#374151'}" style="width: 100%; height: 40px; border-radius: 8px; border: 1px solid #ccc;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #6b7280;">Font</label>
                    <select id="temp-text-font" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: 1px solid #ccc;">
                        <option value="'Nanum Pen Script', cursive">Nanum Pen Script</option>
                        <option value="'BMJUA', cursive">BMJUA</option>
                        <option value="'Jua', sans-serif">Jua</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Inter', sans-serif">Inter</option>
                    </select>
                </div>
                <button id="temp-text-save" style="width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Apply</button>
            `;

            document.body.appendChild(settingsModal);

            // Set current font
            const fontSelect = document.getElementById('temp-text-font');
            if (item.fontFamily) {
                fontSelect.value = item.fontFamily;
            }

            // Save button
            document.getElementById('temp-text-save').addEventListener('click', () => {
                const newColor = document.getElementById('temp-text-color').value;
                const newFont = fontSelect.value;

                contentDiv.style.color = newColor;
                contentDiv.style.fontFamily = newFont;

                item.color = newColor;
                item.fontFamily = newFont;

                saveDiaryData();
                settingsModal.remove();
            });

            // Close on click outside
            const closeOverlay = document.createElement('div');
            closeOverlay.style.position = 'fixed';
            closeOverlay.style.top = '0';
            closeOverlay.style.left = '0';
            closeOverlay.style.width = '100%';
            closeOverlay.style.height = '100%';
            closeOverlay.style.zIndex = '2999';
            closeOverlay.onclick = () => {
                settingsModal.remove();
                closeOverlay.remove();
            };
            document.body.appendChild(closeOverlay);
        });
    }

    // Layer Logic
    layerUpHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        item.zIndex = (item.zIndex || 10) + 1;
        el.style.zIndex = item.zIndex;
        saveDiaryData();
    });

    layerDownHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        item.zIndex = Math.max(1, (item.zIndex || 10) - 1);
        el.style.zIndex = item.zIndex;
        saveDiaryData();
    });

    // Double click to edit text (only for text items)
    if (item.type === 'text') {
        el.addEventListener('dblclick', () => {
            const newText = prompt("텍스트 수정:", item.content);
            if (newText !== null) {
                item.content = newText;
                contentDiv.textContent = newText;
                saveDiaryData();
            }
        });
    }

    diaryContentLayer.appendChild(el);
}

// Settings Logic
const btnSettingsConfirm = document.getElementById('btn-settings-confirm');
const btnSettingsShare = document.getElementById('btn-settings-share');
const diaryPreviewBg = document.getElementById('diary-preview-bg');

if (btnDiarySettings) {
    btnDiarySettings.addEventListener('click', () => {
        // Load current settings
        const key = getDiaryKey(currentDiaryDate);
        const dayData = diaryData[key] || {};

        const currentStyle = dayData.background || 'lined';
        const currentColor = dayData.backgroundColor || '#fdfbf7';

        diaryPaperType.value = currentStyle;
        diaryPaperColor.value = currentColor;

        updatePreview(currentStyle, currentColor);

        diarySettingsModal.classList.remove('hidden');
    });
}

function updatePreview(style, color) {
    diaryPreviewBg.className = ''; // Reset
    diaryPreviewBg.innerHTML = '';
    diaryPreviewBg.style.backgroundImage = '';
    diaryPreviewBg.style.backgroundColor = color;

    if (style === 'lined') {
        diaryPreviewBg.style.backgroundImage = 'linear-gradient(#e5e7eb 1px, transparent 1px)';
        diaryPreviewBg.style.backgroundSize = '100% 2.5rem';
    } else if (style === 'lined-narrow') {
        diaryPreviewBg.style.backgroundImage = 'linear-gradient(#e5e7eb 1px, transparent 1px)';
        diaryPreviewBg.style.backgroundSize = '100% 1.5rem';
    } else if (style === 'grid') {
        diaryPreviewBg.style.backgroundImage = 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)';
        diaryPreviewBg.style.backgroundSize = '20px 20px';
    } else if (style === 'dot') {
        diaryPreviewBg.style.backgroundImage = 'radial-gradient(#d1d5db 1px, transparent 1px)';
        diaryPreviewBg.style.backgroundSize = '20px 20px';
    } else if (style === 'plain') {
        // No specific background image/pattern for plain
    } else if (style === 'kraft') {
        diaryPreviewBg.style.backgroundColor = '#d4c4a8';
        diaryPreviewBg.style.backgroundImage = 'url("https://www.transparenttextures.com/patterns/paper.png")'; // Simple texture pattern if available, or just color
    } else if (style === 'dark') {
        diaryPreviewBg.style.backgroundColor = '#1f2937';
        diaryPreviewBg.style.backgroundImage = 'linear-gradient(#374151 1px, transparent 1px)';
        diaryPreviewBg.style.backgroundSize = '100% 2.5rem';
    }
}

if (closeDiarySettings) {
    closeDiarySettings.addEventListener('click', () => {
        diarySettingsModal.classList.add('hidden');
    });
}

if (diaryPaperType) {
    diaryPaperType.addEventListener('change', (e) => {
        updatePreview(e.target.value, diaryPaperColor.value);
    });
}

if (diaryPaperColor) {
    diaryPaperColor.addEventListener('input', (e) => {
        updatePreview(diaryPaperType.value, e.target.value);
    });
}

if (btnSettingsConfirm) {
    btnSettingsConfirm.addEventListener('click', () => {
        const type = diaryPaperType.value;
        const color = diaryPaperColor.value;

        setDiaryBackground(type, color);

        const key = getDiaryKey(currentDiaryDate);
        if (!diaryData[key]) diaryData[key] = { items: [], canvasData: null };
        diaryData[key].background = type;
        diaryData[key].backgroundColor = color;
        saveDiaryData();

        diarySettingsModal.classList.add('hidden');
    });
}

if (btnSettingsShare) {
    btnSettingsShare.addEventListener('click', async () => {
        // Simple Canvas Export Logic
        // 1. Create a temporary canvas
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = diaryCanvas.width;
        exportCanvas.height = diaryCanvas.height;
        const ctxExport = exportCanvas.getContext('2d');

        // 2. Fill Background
        const key = getDiaryKey(currentDiaryDate);
        const dayData = diaryData[key] || {};
        const bgColor = dayData.backgroundColor || '#fdfbf7';
        ctxExport.fillStyle = bgColor;
        ctxExport.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw Pattern (Simplified for export)
        const style = dayData.background || 'lined';
        if (style === 'lined' || style === 'lined-narrow' || style === 'dark') {
            ctxExport.strokeStyle = style === 'dark' ? '#374151' : '#e5e7eb';
            ctxExport.lineWidth = 1;
            const gap = style === 'lined-narrow' ? 24 : 40; // approx px for rem
            for (let y = (style === 'dark' || style === 'lined' || style === 'lined-narrow') ? 48 : 0; y < exportCanvas.height; y += gap) {
                ctxExport.beginPath();
                ctxExport.moveTo(0, y);
                ctxExport.lineTo(exportCanvas.width, y);
                ctxExport.stroke();
            }
        } else if (style === 'grid') {
            ctxExport.strokeStyle = '#e5e7eb';
            ctxExport.lineWidth = 1;
            const gridSize = 20;
            for (let x = 0; x < exportCanvas.width; x += gridSize) {
                ctxExport.beginPath();
                ctxExport.moveTo(x, 0);
                ctxExport.lineTo(x, exportCanvas.height);
                ctxExport.stroke();
            }
            for (let y = 0; y < exportCanvas.height; y += gridSize) {
                ctxExport.beginPath();
                ctxExport.moveTo(0, y);
                ctxExport.lineTo(exportCanvas.width, y);
                ctxExport.stroke();
            }
        } else if (style === 'dot') {
            ctxExport.fillStyle = '#d1d5db';
            const dotSize = 1;
            const dotSpacing = 20;
            for (let x = 0; x < exportCanvas.width; x += dotSpacing) {
                for (let y = 0; y < exportCanvas.height; y += dotSpacing) {
                    ctxExport.beginPath();
                    ctxExport.arc(x, y, dotSize, 0, Math.PI * 2);
                    ctxExport.fill();
                }
            }
        } else if (style === 'kraft') {
            // For kraft, we'd ideally draw the texture. For simplicity, just the color.
            // If a texture image is loaded, it could be drawn here.
        }

        // 3. Draw Drawing Canvas
        ctxExport.drawImage(diaryCanvas, 0, 0);

        // 4. Draw Items (Text, Images, Stickers)
        // Note: This is tricky without html2canvas because we need to render DOM to Canvas.
        // For now, we will try to use html2canvas if available, or fallback to a simple alert if not.
        // Since we can't easily add libraries, we'll try to dynamically load it.

        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
            script.onload = () => captureDiary();
            document.head.appendChild(script);
        } else {
            captureDiary();
        }
    });
}

function captureDiary() {
    const diaryPaper = document.getElementById('diary-paper');
    // Temporarily hide handles for screenshot
    document.body.classList.add('taking-screenshot');
    const handles = document.querySelectorAll('.item-controls');
    handles.forEach(h => h.style.display = 'none');

    html2canvas(diaryPaper, {
        scale: 2, // Better quality
        backgroundColor: null,
        useCORS: true // For images
    }).then(canvas => {
        // Restore handles
        document.body.classList.remove('taking-screenshot');
        handles.forEach(h => h.style.display = ''); // Reset to CSS control

        canvas.toBlob(async (blob) => {
            if (navigator.share) {
                try {
                    const file = new File([blob], `diary-${getDiaryKey(currentDiaryDate)}.png`, { type: 'image/png' });
                    await navigator.share({
                        files: [file],
                        title: '나의 다이어리',
                        text: '오늘의 다이어리를 공유합니다!'
                    });
                } catch (err) {
                    console.error('Share failed', err);
                    downloadImage(canvas);
                }
            } else {
                downloadImage(canvas);
            }
        });
    });
}

function downloadImage(canvas) {
    const link = document.createElement('a');
    link.download = `diary-${getDiaryKey(currentDiaryDate)}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// Deselect on background click
if (diaryPaper) {
    diaryPaper.addEventListener('mousedown', (e) => {
        if (e.target === diaryPaper || e.target === diaryContentLayer || e.target === diaryCanvas) {
            document.querySelectorAll('.diary-item').forEach(i => i.classList.remove('selected'));
        }
    });
}

// Sticker Tool
const toolSticker = document.getElementById('tool-sticker');
if (toolSticker) {
    toolSticker.addEventListener('click', () => {
        // Expanded emoji categories
        const emojiCategories = {
            '표정': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴'],
            '감정': ['😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱'],
            '동물': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈'],
            '음식': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥗', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🍗', '🍖', '🦴', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜'],
            '음료': ['☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'],
            '활동': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '⛸️', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏇', '🧑‍🎨', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰'],
            '여행': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋'],
            '자연': ['🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌺', '🌻', '🌼', '🌷', '🌹', '🥀', '🏵️', '💐', '🌸', '💮', '🌌', '🌃', '🌍', '🌎', '🌏', '🌐', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '☀️', '🌝', '🌞', '⭐', '🌟', '✨', '⚡', '☄️', '💫', '🔥', '🌈', '☁️', '⛅', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌀']
        };

        // Create picker modal
        const picker = document.createElement('div');
        picker.className = 'sticker-picker glass-container';
        picker.style.position = 'fixed';
        picker.style.top = '50%';
        picker.style.left = '50%';
        picker.style.transform = 'translate(-50%, -50%)';
        picker.style.width = 'min(90%, 500px)';
        picker.style.maxHeight = '70vh';
        picker.style.overflowY = 'auto';
        picker.style.padding = '1.5rem';
        picker.style.zIndex = '3000';
        picker.style.borderRadius = '16px';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '10px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '2rem';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = 'var(--text-color)';
        closeBtn.style.lineHeight = '1';
        closeBtn.style.padding = '0';
        closeBtn.style.width = '32px';
        closeBtn.style.height = '32px';
        closeBtn.onclick = () => {
            picker.remove();
            closeOverlay.remove();
        };
        picker.appendChild(closeBtn);

        // Title
        const title = document.createElement('h3');
        title.textContent = '이모티콘 선택';
        title.style.marginTop = '0';
        title.style.marginBottom = '1rem';
        picker.appendChild(title);

        // Create category sections
        Object.entries(emojiCategories).forEach(([category, emojis]) => {
            const categoryTitle = document.createElement('h4');
            categoryTitle.textContent = category;
            categoryTitle.style.marginTop = '1rem';
            categoryTitle.style.marginBottom = '0.5rem';
            categoryTitle.style.fontSize = '1rem';
            picker.appendChild(categoryTitle);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(50px, 1fr))';
            grid.style.gap = '8px';
            grid.style.marginBottom = '1rem';

            emojis.forEach(emoji => {
                const btn = document.createElement('button');
                btn.textContent = emoji;
                btn.style.fontSize = '2rem';
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                btn.style.borderRadius = '8px';
                btn.style.cursor = 'pointer';
                btn.style.padding = '0.5rem';
                btn.style.transition = 'all 0.2s';
                btn.onmouseover = () => {
                    btn.style.background = 'rgba(255, 255, 255, 0.2)';
                    btn.style.transform = 'scale(1.1)';
                };
                btn.onmouseout = () => {
                    btn.style.background = 'rgba(255, 255, 255, 0.1)';
                    btn.style.transform = 'scale(1)';
                };
                btn.onclick = () => {
                    addSticker(emoji);
                    picker.remove();
                    closeOverlay.remove();
                };
                grid.appendChild(btn);
            });

            picker.appendChild(grid);
        });

        // Close overlay
        const closeOverlay = document.createElement('div');
        closeOverlay.style.position = 'fixed';
        closeOverlay.style.top = '0';
        closeOverlay.style.left = '0';
        closeOverlay.style.width = '100%';
        closeOverlay.style.height = '100%';
        closeOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
        closeOverlay.style.zIndex = '2999';
        closeOverlay.onclick = () => {
            picker.remove();
            closeOverlay.remove();
        };

        // Append to diary section instead of body
        const diarySection = document.getElementById('diary-section');
        diarySection.appendChild(closeOverlay);
        diarySection.appendChild(picker);
    });
}

function addSticker(content) {
    const newItem = {
        type: 'sticker',
        content: content,
        x: 100,
        y: 100,
        width: 50,  // Default size
        height: 50, // Default size
        rotation: 0
    };

    const key = getDiaryKey(currentDiaryDate);
    if (!diaryData[key]) diaryData[key] = { items: [], canvasData: null, background: 'lined' };
    diaryData[key].items.push(newItem);

    createDiaryItemElement(newItem);
    saveDiaryData();
}

// Text Tool
const toolText = document.getElementById('tool-text');
if (toolText) {
    toolText.addEventListener('click', () => {
        const text = prompt("추가할 텍스트를 입력하세요:", "오늘의 기분은...");
        if (text) {
            addText(text);
        }
    });
}

function addText(content) {
    const newItem = {
        type: 'text',
        content: content,
        x: 100,
        y: 150,
        fontSize: 40, // Increased default size
        rotation: 0
    };

    const key = getDiaryKey(currentDiaryDate);
    if (!diaryData[key]) diaryData[key] = { items: [], canvasData: null, background: 'lined' };
    diaryData[key].items.push(newItem);

    createDiaryItemElement(newItem);
    saveDiaryData();
}

// --- New Tools Implementation ---

// 1. Pen Tool
if (toolPen) {
    toolPen.addEventListener('click', () => {
        isPenActive = !isPenActive;
        if (isPenActive) {
            toolPen.classList.add('active');
            diaryCanvas.style.pointerEvents = 'auto'; // Enable drawing
            penSettings.classList.remove('hidden');
            // Disable other interactions if needed
        } else {
            toolPen.classList.remove('active');
            diaryCanvas.style.pointerEvents = 'none';
            penSettings.classList.add('hidden');
        }
    });
}

// Pen Settings
if (penColorInput) {
    penColorInput.addEventListener('change', (e) => {
        penColor = e.target.value;
        isEraserActive = false;
        toolEraser.classList.remove('active');
    });
}

if (penWidthInput) {
    penWidthInput.addEventListener('input', (e) => {
        penWidth = e.target.value;
    });
}

if (toolEraser) {
    toolEraser.addEventListener('click', () => {
        isEraserActive = !isEraserActive;
        if (isEraserActive) {
            toolEraser.classList.add('active');
        } else {
            toolEraser.classList.remove('active');
        }
    });
}

// Drawing Logic
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function startDrawing(e) {
    if (!isPenActive) return;
    isDrawing = true;
    const rect = diaryCanvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    lastX = clientX - rect.left;
    lastY = clientY - rect.top;
}

function draw(e) {
    if (!isDrawing || !isPenActive) return;
    e.preventDefault(); // Prevent scrolling

    const rect = diaryCanvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraserActive) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = penWidth * 5; // Eraser is bigger
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
    }

    ctx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    saveCanvasData();
}

if (diaryCanvas) {
    diaryCanvas.addEventListener('mousedown', startDrawing);
    diaryCanvas.addEventListener('mousemove', draw);
    diaryCanvas.addEventListener('mouseup', stopDrawing);
    diaryCanvas.addEventListener('mouseout', stopDrawing);

    diaryCanvas.addEventListener('touchstart', startDrawing, { passive: false });
    diaryCanvas.addEventListener('touchmove', draw, { passive: false });
    diaryCanvas.addEventListener('touchend', stopDrawing);
}

function saveCanvasData() {
    const dataURL = diaryCanvas.toDataURL();
    const key = getDiaryKey(currentDiaryDate);
    if (!diaryData[key]) diaryData[key] = { items: [], canvasData: null, background: 'lined' };
    diaryData[key].canvasData = dataURL;
    saveDiaryData();
}

// 2. Photo Tool
if (toolPhoto) {
    toolPhoto.addEventListener('click', () => {
        photoInput.click();
    });
}

if (photoInput) {
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                addPhoto(event.target.result);
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        photoInput.value = '';
    });
}

function addPhoto(dataURL) {
    const newItem = {
        type: 'photo',
        content: dataURL,
        x: 50,
        y: 50,
        width: 150,
        height: 150,
        rotation: 0
    };

    const key = getDiaryKey(currentDiaryDate);
    if (!diaryData[key]) diaryData[key] = { items: [], canvasData: null, background: 'lined' };
    diaryData[key].items.push(newItem);

    createDiaryItemElement(newItem);
    saveDiaryData();
}

// Diary Navigation
if (diaryPrevDay) {
    diaryPrevDay.addEventListener('click', () => {
        currentDiaryDate.setDate(currentDiaryDate.getDate() - 1);
        renderDiary();
    });
}

if (diaryNextDay) {
    diaryNextDay.addEventListener('click', () => {
        currentDiaryDate.setDate(currentDiaryDate.getDate() + 1);
        renderDiary();
    });
}

// Google API Loaders
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
}

// Expose to global for script tags
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

// Event Listeners
inputText.addEventListener('input', (e) => {
    handleInputDebounce(e);
    updateVoiceButtonState();
});
inputText.addEventListener('keydown', handleInputKeydown);
// Quick Add Button (new + button inside input)
const btnQuickAdd = document.getElementById('btn-quick-add');
if (btnQuickAdd) {
    btnQuickAdd.addEventListener('click', handleQuickAdd);
}

// Voice Button - now triggers voice input directly
if (btnVoiceInput) {
    btnVoiceInput.addEventListener('click', handleVoiceInput);
}

// Swipe Navigation for Calendar
if (calendarSection) {
    let touchStartX = 0;
    let touchEndX = 0;

    calendarSection.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    calendarSection.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next month
                changeMonth(1);
            } else {
                // Swipe right - previous month
                changeMonth(-1);
            }
        }
    }
}

btnOpenSync.addEventListener('click', handleSyncClick);

function updateVoiceButtonState() {
    if (inputText.value.trim().length > 0) {
        btnVoiceInput.textContent = '➕';
        btnVoiceInput.classList.add('btn-add-mode');
    } else {
        btnVoiceInput.textContent = '🎤';
        btnVoiceInput.classList.remove('btn-add-mode');
    }
}

function handleVoiceButtonAction() {
    if (inputText.value.trim().length > 0) {
        // Add Mode
        handleQuickAdd();
        // inputText.value = ''; // handleQuickAdd clears it
        updateVoiceButtonState();
    } else {
        // Voice Mode
        handleVoiceInput();
    }
}

// Month navigation
prevMonthBtn.addEventListener('click', () => changeMonth(-1));
nextMonthBtn.addEventListener('click', () => changeMonth(1));

// Year/Month picker modal
const datePickerModal = document.getElementById('date-picker-modal');
const closeDatePickerBtn = document.getElementById('close-date-picker');
const yearSelect = document.getElementById('year-select');
const monthSelect = document.getElementById('month-select');
const btnDatePickerApply = document.getElementById('btn-date-picker-apply');

// Populate year select (current year ± 10 years)
const currentYear = new Date().getFullYear();
for (let year = currentYear - 10; year <= currentYear + 10; year++) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = `${year}년`;
    yearSelect.appendChild(option);
}

currentMonthYear.addEventListener('click', () => {
    // Set current values
    yearSelect.value = currentDate.getFullYear();
    monthSelect.value = currentDate.getMonth();
    datePickerModal.classList.remove('hidden');
});

if (closeDatePickerBtn) {
    closeDatePickerBtn.addEventListener('click', () => {
        datePickerModal.classList.add('hidden');
    });
}

if (btnDatePickerApply) {
    btnDatePickerApply.addEventListener('click', () => {
        const selectedYear = parseInt(yearSelect.value);
        const selectedMonth = parseInt(monthSelect.value);
        currentDate.setFullYear(selectedYear);
        currentDate.setMonth(selectedMonth);
        renderCalendar();
        datePickerModal.classList.add('hidden');
    });
}

// Modal Listeners
closeModal.addEventListener('click', hideModal);
if (modalBtnCancel) modalBtnCancel.addEventListener('click', hideModal); // Added listener for modalBtnCancel
modalBtnSave.addEventListener('click', saveModalEvent);
modalBtnDelete.addEventListener('click', deleteModalEvent);

// All Day Checkbox Listener
if (editAllDay) {
    editAllDay.addEventListener('change', (e) => {
        const isAllDay = e.target.checked;
        toggleDateInputs(isAllDay);
    });
}

function toggleDateInputs(isAllDay) {
    const startVal = editStart.value;
    const endVal = editEnd.value;

    if (isAllDay) {
        editStart.type = 'date';
        editEnd.type = 'date';
        // Strip time if present (YYYY-MM-DDTHH:mm -> YYYY-MM-DD)
        if (startVal.includes('T')) editStart.value = startVal.split('T')[0];
        if (endVal.includes('T')) editEnd.value = endVal.split('T')[0];
    } else {
        editStart.type = 'datetime-local';
        editEnd.type = 'datetime-local';
        // Add default time if missing (YYYY-MM-DD -> YYYY-MM-DDTHH:mm)
        // User requested 00:00 for start
        if (startVal && !startVal.includes('T')) editStart.value = startVal + 'T00:00';
        if (endVal && !endVal.includes('T')) editEnd.value = endVal + 'T00:00';
    }
}

// Close modal on background click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        hideModal();
    }
});




// --- Logic ---

function loadEvents() {
    const storedEvents = localStorage.getItem('calendar_events');
    if (storedEvents) {
        events = JSON.parse(storedEvents);
        // Convert string dates back to Date objects
        events.forEach(e => {
            e.start = new Date(e.start);
            e.end = new Date(e.end);
            // Ensure UID exists for older events
            if (!e.uid) e.uid = `${e.id}@aicalendar`;
            // Ensure isAllDay exists, default to false if not present
            if (e.isAllDay === undefined) {
                const h = e.start.getHours();
                const m = e.start.getMinutes();
                // Assume 00:00, 09:00 (old fallback), 12:00 (chrono default) are All Day
                // unless the user explicitly edits it later.
                if ((h === 0 && m === 0) || (h === 9 && m === 0) || (h === 12 && m === 0)) {
                    e.isAllDay = true;
                } else {
                    e.isAllDay = false;
                }
            }
            // Ensure lastModified exists
            if (!e.lastModified) e.lastModified = Date.now();
        });
    }

    const storedDeleted = localStorage.getItem('calendar_deleted_events');
    if (storedDeleted) {
        deletedEvents = JSON.parse(storedDeleted);
    }
}

function saveEvents() {
    localStorage.setItem('calendar_events', JSON.stringify(events));
    localStorage.setItem('calendar_deleted_events', JSON.stringify(deletedEvents));
    renderCalendar();
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    currentMonthYear.textContent = `${year}년 ${month + 1}월`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    daysOfWeek.forEach(day => {
        const el = document.createElement('div');
        el.className = 'calendar-day empty';
        el.style.textAlign = 'center';
        el.style.fontWeight = 'bold';
        el.style.minHeight = 'auto';
        el.textContent = day;
        calendarGrid.appendChild(el);
    });

    for (let i = 0; i < firstDay.getDay(); i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day empty';
        calendarGrid.appendChild(el);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        const el = document.createElement('div');
        el.className = 'calendar-day';
        el.dataset.date = date.toISOString();

        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            el.classList.add('today');
        }

        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = i;
        el.appendChild(dayNum);

        // Filter events that overlap with this day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = events.filter(e => {
            const eStart = new Date(e.start);
            const eEnd = new Date(e.end);
            return eStart <= dayEnd && eEnd >= dayStart;
        });

        // Sort by time
        dayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

        dayEvents.forEach(e => {
            const eventEl = document.createElement('div');
            eventEl.className = 'event-dot';

            // Time logic: Show time only if NOT all day
            let displayText = e.title;
            if (!e.isAllDay) {
                const timeStr = new Date(e.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                displayText = `${timeStr} ${e.title}`;
            }
            // Make background more opaque for better text contrast
            eventEl.style.background = `linear-gradient(135deg, ${e.color}CC, ${e.color}EE)`;
            eventEl.style.borderLeft = `3px solid ${e.color}`;
            eventEl.style.color = getContrastColor(e.color); // Set text color based on background
            eventEl.textContent = displayText;
            eventEl.title = displayText; // Tooltip

            // Click to edit
            eventEl.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openModal(e);
            });

            el.appendChild(eventEl);

            // Initialize drag and drop
            initDragAndDrop(eventEl, e, date);
        });

        // Click on day to add event
        el.addEventListener('click', () => {
            const clickedDate = new Date(year, month, i);
            // Fix: Check for overlap instead of just start date
            const clickedDayStart = new Date(clickedDate);
            clickedDayStart.setHours(0, 0, 0, 0);
            const clickedDayEnd = new Date(clickedDate);
            clickedDayEnd.setHours(23, 59, 59, 999);

            const specificDayEvents = events.filter(e => {
                const eStart = new Date(e.start);
                const eEnd = new Date(e.end);
                return eStart <= clickedDayEnd && eEnd >= clickedDayStart;
            });
            openDayDetailModal(clickedDate, specificDayEvents);
        });

        calendarGrid.appendChild(el);
    }
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

// --- Sync Logic ---

function handleSyncClick() {
    if (!gapiInited || !gisInited) {
        alert("구글 API가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error) {
            throw resp;
        }
        await syncWithGoogle();
    };

    // Check if we have a valid token
    const token = gapi.client.getToken();
    if (token && token.access_token) {
        // We have a token, try to sync directly. 
        // If it fails with 401, we might need to refresh/prompt, but for now let's try.
        syncWithGoogle().catch(err => {
            if (err.status === 401) {
                // Token invalid, prompt
                tokenClient.requestAccessToken({ prompt: '' });
            } else {
                console.error(err);
                alert("동기화 오류: " + err.message);
            }
        });
    } else {
        // No token, prompt
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

async function syncWithGoogle() {
    const btn = btnOpenSync;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="icon">⏳</span> 동기화 중...';
    btn.disabled = true;

    try {
        // 2. Process Deletions
        // Ensure deletedEvents is initialized
        if (!deletedEvents) deletedEvents = [];

        if (deletedEvents.length > 0) {
            const remainingDeletions = [];
            for (const del of deletedEvents) {
                if (del.googleId) {
                    try {
                        await gapi.client.calendar.events.delete({
                            'calendarId': 'primary',
                            'eventId': del.googleId
                        });
                    } catch (e) {
                        if (e.status === 404 || e.status === 410) {
                            // Already deleted, ignore
                        } else {
                            console.error("Failed to delete google event", e);
                            remainingDeletions.push(del); // Retry later
                        }
                    }
                }
            }
            deletedEvents = remainingDeletions;
            saveEvents(); // Save cleaned up deletions
        }

        // 1. Fetch Google Events (1 month past ~ 1 year future)
        const now = new Date();
        const syncStart = new Date(now);
        syncStart.setMonth(now.getMonth() - 1); // 1 month ago

        const syncEnd = new Date(now);
        syncEnd.setFullYear(now.getFullYear() + 1); // 1 year future

        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': syncStart.toISOString(),
            'timeMax': syncEnd.toISOString(),
            'showDeleted': true, // Fetch deleted events too
            'singleEvents': true,
            'maxResults': 2500
            // 'orderBy': 'startTime' // Cannot use orderBy with showDeleted
        });

        const googleEvents = response.result.items;
        let addedToLocal = 0;
        let addedToGoogle = 0;
        let updatedOnGoogle = 0;
        let deletedFromLocal = 0;

        // 2. Merge Logic
        // Map Google events by googleId (id) AND uid
        const googleMapByGoogleId = new Map();
        const googleMapByUid = new Map();

        googleEvents.forEach(ge => {
            googleMapByGoogleId.set(ge.id, ge);

            let uid = null;
            if (ge.extendedProperties && ge.extendedProperties.private && ge.extendedProperties.private.uid) {
                uid = ge.extendedProperties.private.uid;
            } else if (ge.description && ge.description.includes('UID:')) {
                const match = ge.description.match(/UID:(\S+)/);
                if (match) uid = match[1];
            }
            if (uid) googleMapByUid.set(uid, ge);
        });

        // A. Process Local Events -> Google
        for (let i = 0; i < events.length; i++) {
            const le = events[i];

            // Check if local event is within sync window
            // Google list logic: Include if end >= timeMin AND start < timeMax
            const leStart = new Date(le.start);
            const leEnd = new Date(le.end);

            if (leEnd < syncStart || leStart >= syncEnd) {
                continue; // Outside sync window, skip to prevent duplication/deletion errors
            }

            // Try to find match: 1. googleId, 2. uid
            let ge = null;
            if (le.googleId) {
                ge = googleMapByGoogleId.get(le.googleId);
            }
            if (!ge && le.uid) {
                ge = googleMapByUid.get(le.uid);
            }

            if (ge) {
                // Match found! Link them if not linked
                if (!le.googleId) le.googleId = ge.id;

                // Compare timestamps
                const googleUpdated = new Date(ge.updated).getTime();
                const localUpdated = le.lastModified || 0;

                if (ge.status === 'cancelled') {
                    // Google event is deleted
                    if (googleUpdated > localUpdated + 1000) {
                        // Google deletion is newer -> Delete Local
                        events.splice(i, 1);
                        i--;
                        deletedFromLocal++;
                    } else {
                        // Local is newer -> Restore to Google (Re-insert)
                        // Cancelled events cannot be updated, so we must insert as new
                        le.googleId = null; // Reset ID
                        const newGoogleId = await insertGoogleEvent(le);
                        if (newGoogleId) {
                            le.googleId = newGoogleId;
                            addedToGoogle++;
                        }
                    }
                } else {
                    // Google event is active
                    if (localUpdated > googleUpdated + 1000) {
                        // Local is newer -> Update Google
                        await updateGoogleEvent(ge.id, le);
                        updatedOnGoogle++;
                    } else if (googleUpdated > localUpdated + 1000) {
                        // Google is newer -> Update Local
                        updateLocalEventFromGoogle(le, ge);
                        addedToLocal++; // technically updated
                    }
                }

                // Remove from maps so we know what's left
                googleMapByGoogleId.delete(ge.id);
                if (le.uid) googleMapByUid.delete(le.uid);
            } else {
                // Exists only locally -> Insert to Google
                // Check if it was deleted previously (double check)
                const isDeleted = deletedEvents.some(d => d.uid === le.uid);
                if (!isDeleted) {
                    const newGoogleId = await insertGoogleEvent(le);
                    if (newGoogleId) {
                        le.googleId = newGoogleId; // Save the new Google ID!
                        addedToGoogle++;
                    }
                }
            }
        }

        // B. Process Remaining Google Events -> Local
        // Iterate over what's left in googleMapByGoogleId (primary source of truth)
        for (const [gId, ge] of googleMapByGoogleId) {
            if (ge.status !== 'cancelled') {
                // New event from Google (and not deleted)
                createLocalEventFromGoogle(ge);
                addedToLocal++;
            }
        }

        saveEvents();
        alert(`동기화 완료!\n- 앱으로 가져옴: ${addedToLocal}개\n- 구글에 추가됨: ${addedToGoogle}개\n- 구글 업데이트됨: ${updatedOnGoogle}개\n- 앱에서 삭제됨: ${deletedFromLocal}개`);

    } catch (err) {
        console.error("Sync Error", err);
        alert("동기화 중 오류가 발생했습니다: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function insertGoogleEvent(le) {
    const resource = createGoogleEventResource(le);
    const res = await gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': resource
    });
    return res.result.id; // Return the new Google ID
}

async function updateGoogleEvent(eventId, le) {
    const resource = createGoogleEventResource(le);
    await gapi.client.calendar.events.update({
        'calendarId': 'primary',
        'eventId': eventId,
        'resource': resource
    });
}

function updateLocalEventFromGoogle(le, ge) {
    // Remove both [AI] and 종일] prefixes
    le.title = ge.summary.replace('[AI] ', '').replace('종일] ', '');
    le.description = ge.description ? ge.description.split('\n\nUID:')[0] : '';
    le.googleId = ge.id; // Ensure linked

    if (ge.start.date) {
        le.isAllDay = true;
        le.start = new Date(ge.start.date);
        // Google Calendar uses exclusive end dates for all-day events
        // So we need to subtract 1 day when importing
        const googleEndDate = new Date(ge.end.date);
        googleEndDate.setDate(googleEndDate.getDate() - 1);
        le.end = googleEndDate;
    } else {
        le.isAllDay = false;
        le.start = new Date(ge.start.dateTime);
        le.end = new Date(ge.end.dateTime);
    }
    le.lastModified = new Date(ge.updated).getTime();
}

function createLocalEventFromGoogle(ge) {
    let uid = null;
    if (ge.extendedProperties && ge.extendedProperties.private && ge.extendedProperties.private.uid) {
        uid = ge.extendedProperties.private.uid;
    } else if (ge.description && ge.description.includes('UID:')) {
        const match = ge.description.match(/UID:(\S+)/);
        if (match) uid = match[1];
    }
    if (!uid) uid = `${Date.now()}-${Math.random()}@google`; // Fallback UID

    const newEvent = {
        id: Date.now().toString() + Math.random(),
        uid: uid,
        googleId: ge.id, // Important!
        title: ge.summary.replace('[AI] ', '').replace('종일] ', ''),
        description: ge.description ? ge.description.split('\n\nUID:')[0] : '',
        lastModified: new Date(ge.updated).getTime()
    };

    if (ge.start.date) {
        newEvent.isAllDay = true;
        newEvent.start = new Date(ge.start.date);
        // Google Calendar uses exclusive end dates for all-day events
        // So we need to subtract 1 day when importing
        const googleEndDate = new Date(ge.end.date);
        googleEndDate.setDate(googleEndDate.getDate() - 1);
        newEvent.end = googleEndDate;
    } else {
        newEvent.isAllDay = false;
        newEvent.start = new Date(ge.start.dateTime);
        newEvent.end = new Date(ge.end.dateTime);
    }
    events.push(newEvent);
}

// --- NLP & Input ---

function parseEventString(text) {
    if (!text.trim()) return null;

    let results = [];
    let isAllDay = true;
    let mergedDate = new Date();
    let endDate = null; // For ranges
    let hasDate = false;
    let hasTime = false;
    let title = text; // Keep original text for chrono parsing

    let matchedRangeText = null;
    let matchedKeywordText = null;
    let matchedDatePatternText = null;
    let matchedTimePatternText = null;

    // 0. Check for Date Range Patterns
    const now = new Date();
    let rangeMatch = null;
    let match = null;

    // Pattern 1: MM/DD ~ MM/DD (e.g. 11/27~11/30)
    const regex1 = /(\d{1,2})[./](\d{1,2})\s*~\s*(\d{1,2})[./](\d{1,2})/;
    // Pattern 2: MM월 DD일 ~ MM월 DD일 (e.g. 11월 27일~11월 30일)
    const regex2 = /(\d{1,2})월\s*(\d{1,2})일\s*~\s*(\d{1,2})월\s*(\d{1,2})일/;
    // Pattern 3: MM/DD ~ DD (e.g. 11/27~30) - Implies same month
    const regex3 = /(\d{1,2})[./](\d{1,2})\s*~\s*(\d{1,2})(?![./])/;
    // Pattern 4: MM월 DD일 ~ DD일 (e.g. 11월 27일~30일)
    const regex4 = /(\d{1,2})월\s*(\d{1,2})일\s*~\s*(\d{1,2})일/;

    if (match = text.match(regex1)) {
        rangeMatch = {
            full: match[0],
            sm: parseInt(match[1]), sd: parseInt(match[2]),
            em: parseInt(match[3]), ed: parseInt(match[4])
        };
    } else if (match = text.match(regex2)) {
        rangeMatch = {
            full: match[0],
            sm: parseInt(match[1]), sd: parseInt(match[2]),
            em: parseInt(match[3]), ed: parseInt(match[4])
        };
    } else if (match = text.match(regex3)) {
        rangeMatch = {
            full: match[0],
            sm: parseInt(match[1]), sd: parseInt(match[2]),
            em: parseInt(match[1]), ed: parseInt(match[3]) // Same month
        };
    } else if (match = text.match(regex4)) {
        rangeMatch = {
            full: match[0],
            sm: parseInt(match[1]), sd: parseInt(match[2]),
            em: parseInt(match[1]), ed: parseInt(match[3]) // Same month
        };
    }

    if (rangeMatch) {
        const startMonth = rangeMatch.sm - 1;
        const startDay = rangeMatch.sd;
        const endMonth = rangeMatch.em - 1;
        const endDay = rangeMatch.ed;

        mergedDate.setMonth(startMonth);
        mergedDate.setDate(startDay);

        endDate = new Date(now);
        endDate.setMonth(endMonth);
        endDate.setDate(endDay);

        // Year adjustment
        if (mergedDate < now && startMonth < now.getMonth()) {
            mergedDate.setFullYear(now.getFullYear() + 1);
            endDate.setFullYear(now.getFullYear() + 1);
        } else {
            mergedDate.setFullYear(now.getFullYear());
            endDate.setFullYear(now.getFullYear());
        }

        // Handle year crossover (e.g. Dec to Jan)
        if (endDate < mergedDate) {
            endDate.setFullYear(mergedDate.getFullYear() + 1);
        }

        hasDate = true;
        matchedRangeText = rangeMatch.full;
    }

    // 1. Manual Keywords (Priority over Chrono for Date)
    if (!hasDate) {
        // Check for "이번주/다음주 + 요일" patterns (with or without space)
        const weekDayMatch = text.match(/(이번\s?주|다음\s?주)\s*(월|화|수|목|금|토|일)요일/);
        if (weekDayMatch) {
            const weekPart = weekDayMatch[1].replace(/\s/g, ''); // Remove spaces for comparison
            const isNextWeek = weekPart === '다음주';
            const dayName = weekDayMatch[2];
            const dayMap = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
            const targetDay = dayMap[dayName];

            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = targetDay - currentDay;

            if (isNextWeek) {
                daysToAdd += 7;
            } else if (daysToAdd <= 0) {
                daysToAdd += 7; // If target day has passed this week, go to next week
            }

            mergedDate.setDate(now.getDate() + daysToAdd);
            hasDate = true;
            matchedKeywordText = weekDayMatch[0];
        } else if (text.includes('모레')) {
            mergedDate.setDate(now.getDate() + 2);
            hasDate = true;
            matchedKeywordText = '모레';
        } else if (text.includes('내일')) {
            mergedDate.setDate(now.getDate() + 1);
            hasDate = true;
            matchedKeywordText = '내일';
        } else if (text.includes('오늘')) {
            hasDate = true;
            matchedKeywordText = '오늘';
        } else {
            const dateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
            if (dateMatch) {
                const month = parseInt(dateMatch[1]) - 1;
                const day = parseInt(dateMatch[2]);
                mergedDate.setMonth(month);
                mergedDate.setDate(day);
                if (mergedDate < now && month < now.getMonth()) {
                    mergedDate.setFullYear(now.getFullYear() + 1);
                }
                hasDate = true;
                matchedDatePatternText = dateMatch[0];
            }
        }
    }

    // 2. Try chrono (Korean & Default)
    if (typeof chrono !== 'undefined') {
        const koResults = chrono.ko ? chrono.ko.parse(text) : [];
        const enResults = chrono.parse(text);
        results = koResults.length > 0 ? koResults : enResults;
    }

    // 3. Process Chrono Results
    if (results.length > 0) {
        results.sort((a, b) => b.index - a.index);

        results.forEach(result => {
            const date = result.start.date();
            const components = result.start.knownValues;

            // Only use chrono date if we haven't found one yet
            if (!hasDate && (components.month !== undefined || components.day !== undefined)) {
                mergedDate.setFullYear(date.getFullYear());
                mergedDate.setMonth(date.getMonth());
                mergedDate.setDate(date.getDate());
                hasDate = true;
            }

            // Always check for time
            if (components.hour !== undefined) {
                mergedDate.setHours(date.getHours());
                mergedDate.setMinutes(date.getMinutes());
                mergedDate.setSeconds(0);
                hasTime = true;
                isAllDay = false;
            }
        });

        // Strip chrono-found text from title
        results.sort((a, b) => a.index - b.index);
        let newTitle = "";
        let lastIdx = 0;
        results.forEach(result => {
            newTitle += text.substring(lastIdx, result.index);
            lastIdx = result.index + result.text.length;
        });
        newTitle += text.substring(lastIdx);
        title = newTitle;
    }

    // 4. Time Fallback (Regex) - Enhanced with '저녁' support
    if (!hasTime) {
        // Check for "저녁 X시" pattern (e.g., "저녁 5시" = 17:00)
        const eveningMatch = text.match(/저녁\s*(\d{1,2})\s*시/);
        if (eveningMatch) {
            let hour = parseInt(eveningMatch[1]);
            // Treat as PM
            if (hour < 12) hour += 12;
            mergedDate.setHours(hour, 0, 0, 0);
            hasTime = true;
            isAllDay = false;
            matchedTimePatternText = eveningMatch[0];
        } else {
            // Check for "X시 반" pattern (e.g., "9시 반" = 9:30)
            const halfHourMatch = text.match(/(오전|오후|저녁)?\s*(\d{1,2})\s*시\s*반/);
            if (halfHourMatch) {
                const ampm = halfHourMatch[1];
                let hour = parseInt(halfHourMatch[2]);
                const min = 30;

                if (ampm === '오후' && hour < 12) hour += 12;
                if (ampm === '저녁' && hour < 12) hour += 12;
                if (ampm === '오전' && hour === 12) hour = 0;

                mergedDate.setHours(hour, min, 0, 0);
                hasTime = true;
                isAllDay = false;
                matchedTimePatternText = halfHourMatch[0];
            } else {
                const timeMatch = text.match(/(오전|오후|저녁)?\s*(\d{1,2})\s*시\s*(\d{1,2})?분?/) || text.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    let hour, min = 0;
                    if (timeMatch[0].includes(':')) {
                        hour = parseInt(timeMatch[1]);
                        min = parseInt(timeMatch[2]);
                    } else {
                        const ampm = timeMatch[1];
                        hour = parseInt(timeMatch[2]);
                        min = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                        if (ampm === '오후' && hour < 12) hour += 12;
                        if (ampm === '저녁' && hour < 12) hour += 12;
                        if (ampm === '오전' && hour === 12) hour = 0;
                    }
                    mergedDate.setHours(hour, min, 0, 0);
                    hasTime = true;
                    isAllDay = false;
                    matchedTimePatternText = timeMatch[0];
                }
            }
        }
    }

    // Final Cleanup for Title: Remove any date/time patterns that were manually detected
    // and might not have been stripped by chrono (or if chrono wasn't used).
    if (matchedRangeText) title = title.replace(matchedRangeText, '').trim();
    if (matchedKeywordText) title = title.replace(matchedKeywordText, '').trim();
    if (matchedDatePatternText) title = title.replace(matchedDatePatternText, '').trim();
    if (matchedTimePatternText) title = title.replace(matchedTimePatternText, '').trim();


    // Default to 9 AM if date found but no time
    if (hasDate && !hasTime) {
        mergedDate.setHours(9, 0, 0, 0);
        isAllDay = true;
    }

    if (!hasDate && !hasTime && results.length === 0) {
        return null;
    }

    // Cleanup Title
    title = title.replace(/^(에|을|를|이|가)\s+/, '').trim();
    title = title.replace(/\s+(에|을|를|이|가)$/, '').trim();
    if (!title) title = "새로운 일정";

    // Calculate End Date
    let finalEndDate;
    if (endDate) {
        // Range case
        finalEndDate = endDate;
        // Set to end of day for local storage/display
        finalEndDate.setHours(23, 59, 59, 999);
    } else {
        // Single day case
        finalEndDate = new Date(mergedDate.getTime() + (isAllDay ? 0 : 60 * 60 * 1000));
    }

    // 4. Auto-classify Category
    const predictedCategory = predictCategory(text);
    let color = eventColorInput.value; // Default to current selection
    if (predictedCategory) {
        color = predictedCategory.color;
    }

    return { title, start: mergedDate, end: finalEndDate, description: text, isAllDay, color, categoryId: predictedCategory?.id };
}

function handleInputDebounce(e) {
    if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
    inputDebounceTimer = setTimeout(() => {
        handleInputPreview(e);
    }, 500); // 500ms delay
}

function handleInputPreview(e) {
    const text = e.target.value;
    if (!text.trim()) {
        parsingFeedback.innerHTML = '';
        parsingFeedback.classList.remove('show');
        return;
    }

    const result = parseEventString(text);
    if (result) {
        // Update UI Color if category changed
        if (result.color && result.categoryId) {
            eventColorInput.value = result.color;
            const categoryRow = document.getElementById('category-row');
            if (categoryRow) {
                const chip = Array.from(categoryRow.children).find(c => c.dataset.id === result.categoryId);
                if (chip) updateSelectedChip(categoryRow, chip, result.color);
            }
        }

        let feedbackHTML = `
            <span class="badge badge-title">제목: ${result.title}</span>
            <span class="badge badge-time">일시: ${formatDate(result.start)}</span>
        `;
        if (result.isAllDay) {
            feedbackHTML += ` <span class="badge badge-time">(종일)</span>`;
        }
        parsingFeedback.innerHTML = feedbackHTML;
        parsingFeedback.classList.add('show');
    } else {
        parsingFeedback.classList.remove('show');
    }
}

function handleInputKeydown(e) {
    // Allow Enter if not composing.
    // Note: Some browsers send keyCode 229 for Enter during composition.
    // We check isComposing standard property.
    if (e.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent newline
        handleQuickAdd();
    }
}

function handleQuickAdd() {
    const text = inputText.value;
    if (!text.trim()) return;

    const parsed = parseEventString(text);
    const color = eventColorInput.value; // Get color

    if (parsed) {
        const id = Date.now().toString();
        const newEvent = {
            id: id,
            uid: `${id}@aicalendar`,
            lastModified: Date.now(),
            color: color, // Save color
            ...parsed
        };
        events.push(newEvent);
        saveEvents();
        inputText.value = '';
        parsingFeedback.innerHTML = '<span style="color: green; font-weight: bold;">일정 추가 완료!!</span>';
        setTimeout(() => {
            parsingFeedback.innerHTML = '';
        }, 2000);

        // Move calendar to that date
        currentDate = new Date(parsed.start);
        renderCalendar();
        if (typeof renderEventList === 'function') renderEventList();
    } else {
        alert("날짜를 인식하지 못했습니다.");
    }
}

function handleVoiceInput() {
    // If already listening, stop it
    if (isVoiceListening && voiceRecognition) {
        console.log('[VOICE] Stopping voice recognition...');
        voiceRecognition.stop();
        isVoiceListening = false;
        btnVoiceInput.classList.remove('listening');
        inputText.placeholder = "일정 입력";
        return;
    }

    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('음성 인식을 지원하지 않는 브라우저입니다.');
        return;
    }

    // Create new recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'ko-KR';
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;

    // Start listening
    isVoiceListening = true;
    btnVoiceInput.classList.add('listening');
    inputText.placeholder = ".....";
    console.log('[VOICE] Started listening...');

    voiceRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('[VOICE] Recognized:', transcript);
        inputText.value = transcript;
        inputText.dispatchEvent(new Event('input'));
        isVoiceListening = false;
        btnVoiceInput.classList.remove('listening');
        inputText.placeholder = "일정 입력";
    };

    voiceRecognition.onerror = (event) => {
        console.error('[VOICE] Error:', event.error);
        isVoiceListening = false;
        btnVoiceInput.classList.remove('listening');
        inputText.placeholder = "일정 입력";
        if (event.error !== 'aborted') {
            alert('음성 인식 중 오류가 발생했습니다: ' + event.error);
        }
    };

    voiceRecognition.onend = () => {
        console.log('[VOICE] Ended listening');
        isVoiceListening = false;
        btnVoiceInput.classList.remove('listening');
        inputText.placeholder = "일정 입력";
        voiceRecognition = null;
    };

    voiceRecognition.start();
}

// --- Modal ---

function openModal(event) {
    console.log('[DEBUG] openModal called with event:', event);
    editingEventId = event.id;

    // Add [종일] prefix to title for all-day events
    if (event.isAllDay && event.title && !event.title.startsWith('[종일] ')) {
        editTitle.value = `[종일] ${event.title}`;
    } else {
        editTitle.value = event.title;
    }

    // Set Checkbox
    if (editAllDay) {
        editAllDay.checked = event.isAllDay;
    }

    // Set Reminder
    if (editReminderEnabled) {
        editReminderEnabled.checked = event.reminder && event.reminder.enabled;
        if (event.reminder && event.reminder.enabled) {
            currentReminderValue = {
                days: event.reminder.days || 0,
                hours: event.reminder.hours || 0,
                minutes: event.reminder.minutes || 0
            };
        } else {
            currentReminderValue = { days: 0, hours: 0, minutes: 0 };
        }
    }

    // Format dates based on whether it's all-day or not
    if (event.isAllDay) {
        // For all-day events, show only date (no time)
        const startDate = new Date(event.start);
        const endDate = new Date(event.end); // Use event.end
        editStart.type = 'date';
        editEnd.type = 'date';
        editStart.value = toLocalISOString(startDate).slice(0, 10); // yyyy-MM-dd
        editEnd.value = toLocalISOString(endDate).slice(0, 10);
    } else {
        // For timed events, show full datetime
        editStart.type = 'datetime-local';
        editEnd.type = 'datetime-local';
        editStart.value = toLocalISOString(event.start).slice(0, 16);
        editEnd.value = toLocalISOString(event.end).slice(0, 16);
    }

    editDesc.value = event.description || '';
    editColor.value = event.color || '#3b82f6'; // Set Color
    colorPreviewText.textContent = event.color || '#3b82f6';

    // Render category chips in modal
    const modalColorPalette = document.getElementById('modal-color-palette');
    if (modalColorPalette) {
        renderCategoryChips(modalColorPalette, editColor);
    }

    // Ensure delete button is visible for existing events
    if (event.id) {
        modalBtnDelete.style.display = 'inline-flex';
        console.log('[DEBUG] Delete button shown for existing event');
    } else {
        modalBtnDelete.style.display = 'none';
        console.log('[DEBUG] Delete button hidden for new event');
    }

    modal.classList.remove('hidden');
    console.log('[DEBUG] Modal opened successfully');
}

// Color picker listener
editColor.addEventListener('input', (e) => {
    colorPreviewText.textContent = e.target.value;
});

function hideModal() {
    modal.classList.add('hidden');
}

function saveModalEvent() {
    let title = editTitle.value;

    // Remove [종일] prefix if present (we'll determine isAllDay separately)
    if (title.startsWith('[종일] ')) {
        title = title.substring(5);
    }

    const start = new Date(editStart.value);
    const end = new Date(editEnd.value); // Get End Date
    const desc = editDesc.value;
    const color = editColor.value; // Get Color

    // Detect all-day from checkbox
    let isAllDay = editAllDay ? editAllDay.checked : (editStart.type === 'date');

    if (isAllDay) {
        // Force Local 00:00 for Start
        const sVal = editStart.value; // yyyy-mm-dd
        if (sVal) {
            const parts = sVal.split('-');
            start.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            start.setHours(0, 0, 0, 0);
        }

        // Force Local 23:59 for End
        const eVal = editEnd.value; // yyyy-mm-dd
        if (eVal) {
            const parts = eVal.split('-');
            end.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            end.setHours(23, 59, 59, 999);
        }
    }

    if (editingEventId) {
        const idx = events.findIndex(e => e.id === editingEventId);
        if (idx !== -1) {
            events[idx] = {
                ...events[idx],
                title, start, end, description: desc, isAllDay, color,
                reminder: editReminderEnabled && editReminderEnabled.checked ? {
                    enabled: true,
                    days: currentReminderValue.days,
                    hours: currentReminderValue.hours,
                    minutes: currentReminderValue.minutes,
                    sent: false
                } : null,
                lastModified: Date.now()
            };
        }
    } else {
        const id = Date.now().toString();
        const newEvent = {
            id: id,
            uid: `${id}@aicalendar`,
            title, start, end, description: desc, isAllDay, color,
            reminder: editReminderEnabled && editReminderEnabled.checked ? {
                enabled: true,
                days: currentReminderValue.days,
                hours: currentReminderValue.hours,
                minutes: currentReminderValue.minutes,
                sent: false
            } : null,
            lastModified: Date.now()
        };
        events.push(newEvent);
    }

    saveEvents();
    hideModal();
}

function deleteModalEvent() {
    if (editingEventId) {
        if (confirm('정말 삭제하시겠습니까?')) {
            const eventToDelete = events.find(e => e.id === editingEventId);
            if (eventToDelete) {
                deletedEvents.push({
                    uid: eventToDelete.uid,
                    googleId: eventToDelete.googleId
                });
            }
            events = events.filter(e => e.id !== editingEventId);
            saveEvents();
            if (typeof renderEventList === 'function') renderEventList();
            hideModal();
        }
    } else {
        hideModal();
    }
}

// --- Utils ---

function toLocalISOString(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString();
}

function generateGoogleLink(event) {
    const baseUrl = "https://calendar.google.com/calendar/render";
    const action = "TEMPLATE";
    const text = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');

    const startStr = formatDateForGoogle(event.start);
    const endStr = formatDateForGoogle(event.end || new Date(event.start.getTime() + 3600000));
    const dates = `${startStr}/${endStr}`;

    return `${baseUrl}?action=${action}&text=${text}&dates=${dates}&details=${details}`;
}

function formatDateForGoogle(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function formatDateForGoogleAllDay(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getContrastColor(hex) {
    if (!hex) return 'white';
    // Convert hex to RGB
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    // Calculate YIQ
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

// Update createGoogleEventResource to include color
function createGoogleEventResource(le) {
    const start = le.isAllDay ? { date: formatDateForGoogleAllDay(le.start) } : { dateTime: le.start.toISOString() };

    // Fix for Google Calendar All-Day End Date (Exclusive)
    // Google Calendar expects the end date to be the day AFTER the last day of the event
    let end;
    if (le.isAllDay) {
        const endDateForGoogle = new Date(le.end);
        endDateForGoogle.setDate(endDateForGoogle.getDate() + 1); // Add 1 day
        end = { date: formatDateForGoogleAllDay(endDateForGoogle) };
    } else {
        end = { dateTime: le.end.toISOString() };
    }

    // Add 종일] prefix for all-day events - REMOVED as per user request
    const title = le.title;

    return {
        'summary': title,
        'description': `${le.description || ''}\n\nUID:${le.uid}`,
        'start': start,
        'end': end,
        'extendedProperties': {
            'private': {
                'uid': le.uid,
                'color': le.color || '#3b82f6'
            }
        }
    };
}

// Update updateLocalEventFromGoogle to retrieve color
function updateLocalEventFromGoogle(le, ge) {
    le.title = ge.summary.replace(/^\[AI\]\s+/, ''); // Remove [AI] if present (backward compatibility)
    le.description = ge.description ? ge.description.split('\n\nUID:')[0] : '';
    le.googleId = ge.id;

    // Retrieve color
    if (ge.extendedProperties && ge.extendedProperties.private && ge.extendedProperties.private.color) {
        le.color = ge.extendedProperties.private.color;
    }

    if (ge.start.date) {
        le.isAllDay = true;
        // Parse YYYY-MM-DD as local time
        const startParts = ge.start.date.split('-');
        le.start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

        // Google end date is exclusive. Parse as local time then subtract 1ms
        const endParts = ge.end.date.split('-');
        const googleEndLocal = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
        le.end = new Date(googleEndLocal.getTime() - 1000);
    } else {
        le.isAllDay = false;
        le.start = new Date(ge.start.dateTime);
        le.end = new Date(ge.end.dateTime);
    }
    le.lastModified = new Date(ge.updated).getTime();
}

// Update createLocalEventFromGoogle to retrieve color
function createLocalEventFromGoogle(ge) {
    let uid = null;
    if (ge.extendedProperties && ge.extendedProperties.private && ge.extendedProperties.private.uid) {
        uid = ge.extendedProperties.private.uid;
    } else if (ge.description && ge.description.includes('UID:')) {
        const match = ge.description.match(/UID:(\S+)/);
        if (match) uid = match[1];
    }
    if (!uid) uid = `${Date.now()}-${Math.random()}@google`;

    let color = '#3b82f6';
    if (ge.extendedProperties && ge.extendedProperties.private && ge.extendedProperties.private.color) {
        color = ge.extendedProperties.private.color;
    }

    const newEvent = {
        id: Date.now().toString() + Math.random(),
        uid: uid,
        googleId: ge.id,
        title: ge.summary.replace(/^\[AI\]\s+/, '').replace(/^종일\]\s+/, ''), // Remove [AI] and 종일] if present
        description: ge.description ? ge.description.split('\n\nUID:')[0] : '',
        lastModified: new Date(ge.updated).getTime(),
        color: color
    };

    if (ge.start.date) {
        newEvent.isAllDay = true;
        // Parse YYYY-MM-DD as local time
        const startParts = ge.start.date.split('-');
        newEvent.start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

        // Google end date is exclusive
        const endParts = ge.end.date.split('-');
        const googleEndLocal = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
        newEvent.end = new Date(googleEndLocal.getTime() - 1000);
    } else {
        newEvent.isAllDay = false;
        newEvent.start = new Date(ge.start.dateTime);
        newEvent.end = new Date(ge.end.dateTime);
    }
    events.push(newEvent);

}


// --- Palette Logic ---

// --- Category Logic ---
// (Moved to top)

function renderCategoryChips(container, inputElement) {
    container.innerHTML = '';

    EVENT_CATEGORIES.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'category-chip';
        chip.textContent = cat.label;
        chip.dataset.color = cat.color;
        chip.dataset.id = cat.id;

        // Always show the category color as background
        chip.style.backgroundColor = cat.color;
        chip.style.color = '#ffffff'; // White text for visibility

        // Initial selection check - add border instead of changing background
        if (inputElement && inputElement.value === cat.color) {
            chip.classList.add('selected');
        }

        chip.addEventListener('click', (e) => {
            console.log('[CATEGORY] Chip clicked:', cat.label, cat.color);
            e.stopPropagation();

            // Update input color
            if (inputElement) {
                inputElement.value = cat.color;
                console.log('[CATEGORY] Updated input color to:', cat.color);
            }

            // Update UI - mark as selected
            container.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
        });

        // Long press to delete (except for default categories)
        let pressTimer;
        chip.addEventListener('touchstart', (e) => {
            if (cat.id === 'etc') return; // Cannot delete 'etc'

            pressTimer = setTimeout(() => {
                // Count events using this category
                const eventsWithCategory = events.filter(evt => evt.color === cat.color).length;

                let message = `"${cat.label}" 카테고리를 삭제하시겠습니까?`;
                if (eventsWithCategory > 0) {
                    message += `\n\n이 카테고리를 사용하는 일정이 ${eventsWithCategory}개 있습니다.\n삭제 시 해당 일정들은 "기타" 카테고리로 변경됩니다.`;
                }

                if (confirm(message)) {
                    // Update events to use 'etc' category
                    const etcCategory = EVENT_CATEGORIES.find(c => c.id === 'etc');
                    if (etcCategory) {
                        events.forEach(evt => {
                            if (evt.color === cat.color) {
                                evt.color = etcCategory.color;
                            }
                        });
                        saveEvents();
                    }

                    // Remove from EVENT_CATEGORIES
                    const index = EVENT_CATEGORIES.findIndex(c => c.id === cat.id);
                    if (index > -1) {
                        EVENT_CATEGORIES.splice(index, 1);
                        localStorage.setItem('customCategories', JSON.stringify(EVENT_CATEGORIES));
                    }

                    // Re-render chips
                    renderCategoryChips(container, inputElement);
                    renderCalendar();
                }
            }, 800); // 0.8 second long press
        });

        chip.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });

        chip.addEventListener('touchcancel', () => {
            clearTimeout(pressTimer);
        });

        container.appendChild(chip);
    });

    // Add "+" button
    const addBtn = document.createElement('div');
    addBtn.className = 'category-add-btn';
    addBtn.textContent = '+';
    addBtn.title = '새 카테고리 추가';
    addBtn.addEventListener('click', () => openCategoryModal(container, inputElement));
    container.appendChild(addBtn);
}

// --- Category Creation Modal Logic ---
const RECOMMENDED_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#64748b', '#71717a', '#78716c'
];

let newCategoryName = '';
let selectedCategoryColor = '';
let targetCategoryContainer = null;
let targetColorInput = null;

const categoryModal = document.getElementById('category-modal');
const closeCategoryModalBtn = document.getElementById('close-category-modal');
const categoryStep1 = document.getElementById('category-step-1');
const categoryStep2 = document.getElementById('category-step-2');
const newCategoryNameInput = document.getElementById('new-category-name');
const btnCategoryNext = document.getElementById('btn-category-next');
const btnCategoryBack = document.getElementById('btn-category-back');
const btnCategorySave = document.getElementById('btn-category-save');
const recommendedColorsGrid = document.getElementById('recommended-colors-grid');

function openCategoryModal(container, inputElement) {
    targetCategoryContainer = container;
    targetColorInput = inputElement;

    // Reset State
    newCategoryName = '';
    selectedCategoryColor = '';
    newCategoryNameInput.value = '';

    categoryModal.classList.remove('hidden');
    newCategoryNameInput.focus();

    // Render colors immediately (single-step modal)
    renderRecommendedColors();
}

function closeCategoryModal() {
    categoryModal.classList.add('hidden');
}

if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener('click', closeCategoryModal);

// Remove old step navigation listeners (btnCategoryNext, btnCategoryBack are gone)

if (btnCategorySave) {
    btnCategorySave.addEventListener('click', () => {
        const name = newCategoryNameInput.value.trim();
        if (!name) {
            alert('카테고리 이름을 입력해주세요.');
            return;
        }
        if (!selectedCategoryColor) {
            alert('색상을 선택해주세요.');
            return;
        }

        const newId = 'cat_' + Date.now();
        const newCategory = {
            id: newId,
            label: name, // Use the name from input
            color: selectedCategoryColor,
            keywords: []
        };
        EVENT_CATEGORIES.push(newCategory);

        // Save to localStorage
        localStorage.setItem('customCategories', JSON.stringify(EVENT_CATEGORIES));

        // Re-render chips
        if (targetCategoryContainer && targetColorInput) {
            renderCategoryChips(targetCategoryContainer, targetColorInput);

            // Auto-select
            setTimeout(() => {
                const newChip = Array.from(targetCategoryContainer.children).find(c => c.dataset.id === newId);
                if (newChip) {
                    updateSelectedChip(targetCategoryContainer, newChip, selectedCategoryColor);
                    targetColorInput.value = selectedCategoryColor;
                }
            }, 50);
        }

        closeCategoryModal();
    });
}

function renderRecommendedColors() {
    recommendedColorsGrid.innerHTML = '';

    // Filter out used colors
    const usedColors = EVENT_CATEGORIES.map(c => c.color.toLowerCase());

    RECOMMENDED_COLORS.forEach(color => {
        // Strictly exclude used colors
        if (usedColors.includes(color.toLowerCase())) return;

        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;

        colorOption.addEventListener('click', () => {
            // Select logic
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            colorOption.classList.add('selected');
            selectedCategoryColor = color;
        });

        recommendedColorsGrid.appendChild(colorOption);
    });
}

// Replaces old palette logic
function renderColorPaletteWithLogic(container, inputElement) {
    // Redirect to category chips if it's the main palette
    if (container.id === 'category-row') {
        renderCategoryChips(container, inputElement);
    } else {
        // Fallback for modal or other places if needed (or just use chips there too)
        // For now, let's use chips everywhere for consistency
        renderCategoryChips(container, inputElement);
    }
}

function saveRecentColor(color) {
    let recentColors = JSON.parse(localStorage.getItem('recentColors') || '[]');

    // Remove if already exists
    recentColors = recentColors.filter(c => c !== color);

    // Add to front
    recentColors.unshift(color);

    // Keep only 5
    recentColors = recentColors.slice(0, 5);

    localStorage.setItem('recentColors', JSON.stringify(recentColors));
}

function updateSelectedDot(container, selectedDot) {
    container.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.remove('selected');
    });
    selectedDot.classList.add('selected');
}
// --- Day Detail Modal Logic ---

let selectedDetailDate = null;

function hideDayDetailModal() {
    dayDetailModal.classList.add('hidden');
}

// Event Listeners for Day Detail Modal
closeDayDetail.addEventListener('click', hideDayDetailModal);
dayDetailModal.addEventListener('click', (e) => {
    if (e.target === dayDetailModal) {
        hideDayDetailModal();
    }
});

btnAddEventBottom.addEventListener('click', () => {
    hideDayDetailModal();
    // Open modal for new event on selected date
    const start = new Date(selectedDetailDate);
    start.setHours(9, 0, 0, 0);
    openModal({
        id: null,
        title: '',
        start: start,
        end: new Date(start.getTime() + 60 * 60 * 1000),
        description: '',
        isAllDay: true
    });
});

function openDayDetailModal(date, dayEvents) {
    console.log('[DEBUG] openDayDetailModal called');
    console.log('[DEBUG] Date:', date);
    console.log('[DEBUG] Day Events:', dayEvents);
    console.log('[DEBUG] Current Mode:', currentMode);

    selectedDetailDate = date;
    const dateStr = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    dayDetailDate.textContent = dateStr;
    dayDetailList.innerHTML = '';

    // Sort events by start time
    dayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    dayEvents.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';

        // Time display
        const timeDiv = document.createElement('div');
        timeDiv.className = 'event-card-time';
        if (event.isAllDay) {
            timeDiv.textContent = '하루 종일';
        } else {
            const startTime = event.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const endTime = event.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            timeDiv.textContent = `${startTime} ~ ${endTime}`;
        }

        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'event-card-title';
        titleDiv.textContent = event.title;

        // Description
        if (event.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'event-card-desc';
            descDiv.textContent = event.description;
            eventCard.appendChild(timeDiv);
            eventCard.appendChild(titleDiv);
            eventCard.appendChild(descDiv);
        } else {
            eventCard.appendChild(timeDiv);
            eventCard.appendChild(titleDiv);
        }

        // Color bar
        if (event.color) {
            eventCard.style.borderLeft = `4px solid ${event.color}`;
        }

        // Swipe actions container
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'swipe-container';

        // Delete action (right, red) - only swipe left to delete
        const deleteAction = document.createElement('div');
        deleteAction.className = 'swipe-action-delete';
        deleteAction.innerHTML = '<span>🗑️ 삭제</span>';
        deleteAction.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent container click
            deleteEventFromDetail(event.id);
        });

        // Add click listener to swipe-container
        swipeContainer.addEventListener('click', (e) => {
            console.log('[DEBUG] Swipe container clicked', e.target);

            // Don't trigger if swiping
            if (eventCard.classList.contains('swiping')) {
                console.log('[DEBUG] Ignoring click - card is swiping');
                return;
            }

            console.log('[DEBUG] Opening modal for event:', event.title);
            hideDayDetailModal();
            openModal(event);
        });

        swipeContainer.appendChild(deleteAction);
        swipeContainer.appendChild(eventCard);

        // Add swipe gesture
        addSwipeGesture(swipeContainer, eventCard);

        dayDetailList.appendChild(swipeContainer);
    });

    dayDetailModal.classList.remove('hidden');
    console.log('[DEBUG] Day Detail Modal opened, hidden class removed');
    console.log('[DEBUG] Modal element:', dayDetailModal);
    console.log('[DEBUG] Modal computed display:', window.getComputedStyle(dayDetailModal).display);
}

function addSwipeGesture(container, content) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let hasMoved = false; // Track if actual movement occurred

    // Store event ID from container's data if available
    const swipeContainer = content.closest('.swipe-container');

    content.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
        hasMoved = false; // Reset on each touch
        // Don't add 'swiping' class yet - wait for actual movement
    });

    content.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        // Only allow right swipe (positive diff) for delete
        if (diff > 0 && Math.abs(diff) > 10) {
            hasMoved = true; // Mark as moved
            content.classList.add('swiping'); // Now add swiping class
            e.preventDefault();
            content.style.transform = `translateX(${diff}px)`;
        }
    });

    content.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = currentX - startX;

        if (hasMoved && diff > 80) {
            // Swipe right - delete immediately
            content.style.transform = 'translateX(100%)';
            content.style.opacity = '0';

            // Find delete button and trigger delete
            const deleteBtn = container.querySelector('.swipe-action-delete, .list-swipe-delete');
            if (deleteBtn) {
                setTimeout(() => {
                    deleteBtn.click();
                }, 200);
            }
        } else {
            // Reset
            content.style.transform = 'translateX(0)';
        }

        // Remove swiping class immediately
        content.classList.remove('swiping');
        hasMoved = false;
    });

    // Mouse events for desktop testing
    content.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        currentX = startX;
        isDragging = true;
        hasMoved = false;
        content.style.cursor = 'grabbing';
    });

    content.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
        const diff = currentX - startX;

        // Only allow right swipe
        if (diff > 0 && Math.abs(diff) > 10) {
            hasMoved = true;
            content.classList.add('swiping');
            content.style.transform = `translateX(${diff}px)`;
        }
    });

    content.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        content.style.cursor = 'pointer';

        const diff = currentX - startX;

        if (hasMoved && diff > 80) {
            // Swipe right - delete immediately
            content.style.transform = 'translateX(100%)';
            content.style.opacity = '0';

            const deleteBtn = container.querySelector('.swipe-action-delete, .list-swipe-delete');
            if (deleteBtn) {
                setTimeout(() => {
                    deleteBtn.click();
                }, 200);
            }
        } else {
            content.style.transform = 'translateX(0)';
        }

        content.classList.remove('swiping');
        hasMoved = false;
    });

    content.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            content.style.cursor = 'pointer';
            content.style.transform = 'translateX(0)';
            content.classList.remove('swiping');
            hasMoved = false;
        }
    });
}

function deleteEventFromDetail(eventId) {
    // Delete immediately without confirmation
    const eventToDelete = events.find(e => e.id === eventId);
    if (eventToDelete) {
        deletedEvents.push({
            uid: eventToDelete.uid,
            googleId: eventToDelete.googleId
        });
    }
    events = events.filter(e => e.id !== eventId);
    saveEvents();

    // Refresh the day detail modal
    const dayEvents = events.filter(e => isSameDay(e.start, selectedDetailDate));
    openDayDetailModal(selectedDetailDate, dayEvents);
} // End of deleteEventFromDetail

// --- Tab Logic ---
if (tabCalendar && tabList) {
    tabCalendar.addEventListener('click', () => {
        tabCalendar.classList.add('active');
        tabList.classList.remove('active');
        calendarSection.classList.remove('hidden');
        eventListSection.classList.add('hidden');
    });

    tabList.addEventListener('click', () => {
        tabList.classList.add('active');
        tabCalendar.classList.remove('active');
        calendarSection.classList.add('hidden');
        eventListSection.classList.remove('hidden');
        renderEventList();
    });
}

// --- Event List Rendering ---
function renderEventList() {
    if (!eventListContainer) return;
    eventListContainer.innerHTML = '';
    const sortedEvents = [...events].sort((a, b) => a.start - b.start);
    const grouped = {};

    sortedEvents.forEach(e => {
        // Normalize start to 00:00
        let current = new Date(e.start);
        current.setHours(0, 0, 0, 0);

        const end = new Date(e.end);

        // Loop through each day
        const tempDate = new Date(current);

        // Special case: if start >= end (invalid?), show at least once
        if (tempDate >= end) {
            const dateKey = tempDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(e);
        } else {
            while (tempDate < end) {
                const dateKey = tempDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(e);

                // Next day
                tempDate.setDate(tempDate.getDate() + 1);

                // Safety break
                if (tempDate - current > 365 * 24 * 60 * 60 * 1000) break; // > 1 year
            }
        }
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const parseDate = (str) => {
            const nums = str.match(/\d+/g);
            if (!nums) return 0;
            return new Date(nums[0], nums[1] - 1, nums[2]);
        };
        return parseDate(a) - parseDate(b);
    });

    // Find nearest date to scroll to
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let scrollTargetId = null;
    let minDiff = Infinity;

    sortedKeys.forEach((dateStr, index) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'list-date-group';

        // Parse date from string (e.g., "2025년 11월 30일")
        const nums = dateStr.match(/\d+/g);
        const groupDate = new Date(nums[0], nums[1] - 1, nums[2]);

        // Check if this is the nearest future date (or today)
        if (groupDate >= today && groupDate - today < minDiff) {
            minDiff = groupDate - today;
            scrollTargetId = `date-group-${index}`;
        }
        groupEl.id = `date-group-${index}`;

        const headerEl = document.createElement('h3');
        headerEl.className = 'list-date-header';

        // Format: 2025년 11월 30일 -> 25년 11월 30일
        headerEl.textContent = dateStr.replace(/^20(\d{2})년/, '$1년');
        groupEl.appendChild(headerEl);

        grouped[dateStr].forEach(e => {
            // Swipe Container
            const swipeContainer = document.createElement('div');
            swipeContainer.className = 'swipe-container';

            // Delete Action
            const deleteAction = document.createElement('div');
            deleteAction.className = 'list-swipe-delete'; // Use new class
            deleteAction.innerHTML = '<span>삭제</span>'; // Gray text only
            deleteAction.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm('정말 삭제하시겠습니까?')) {
                    // Delete logic
                    if (e.id) {
                        deletedEvents.push({
                            uid: e.uid,
                            googleId: e.googleId
                        });
                    }
                    events = events.filter(evt => evt.id !== e.id);
                    saveEvents();
                    renderEventList(); // Re-render list
                    renderCalendar(); // Update calendar view
                } else {
                    // Reset swipe if cancelled
                    itemEl.style.transform = 'translateX(0)';
                    itemEl.classList.remove('swiping');
                }
            });

            const itemEl = document.createElement('div');
            itemEl.className = 'list-item';

            // Add color indicator
            itemEl.style.borderLeft = `4px solid ${e.color || '#3b82f6'}`;

            const timeEl = document.createElement('div');
            timeEl.className = 'list-item-time';

            let timeText = '';
            if (e.isAllDay) {
                timeText = '종일';
            } else {
                // Parse dateStr to check if it's start or end day
                const nums = dateStr.match(/\d+/g);
                const currentDay = new Date(nums[0], nums[1] - 1, nums[2]);
                const eventStart = new Date(e.start);
                const eventEnd = new Date(e.end);

                const isStartDay = isSameDay(currentDay, eventStart);
                const isEndDay = isSameDay(currentDay, eventEnd);

                if (isStartDay && isEndDay) {
                    timeText = eventStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                } else if (isStartDay) {
                    timeText = eventStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ~';
                } else if (isEndDay) {
                    timeText = '~ ' + eventEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                } else {
                    timeText = '종일';
                }
            }

            timeEl.textContent = timeText;
            const titleEl = document.createElement('div');
            titleEl.className = 'list-item-title';
            titleEl.textContent = e.title;
            itemEl.appendChild(timeEl);
            itemEl.appendChild(titleEl);

            // Click to open modal (unless swiping)
            itemEl.addEventListener('click', () => {
                if (!itemEl.classList.contains('swiping')) {
                    openModal(e);
                }
            });

            swipeContainer.appendChild(deleteAction);
            swipeContainer.appendChild(itemEl);

            // Add swipe gesture
            addSwipeGesture(swipeContainer, itemEl);

            groupEl.appendChild(swipeContainer);
        });
        eventListContainer.appendChild(groupEl);
    });

    if (sortedKeys.length === 0) {
        eventListContainer.innerHTML = '<p style="text-align:center; color:var(--text-color); opacity:0.7; margin-top:2rem;">일정이 없습니다.</p>';
    } else if (scrollTargetId) {
        // Scroll to the nearest upcoming event
        setTimeout(() => {
            const target = document.getElementById(scrollTargetId);
            if (target) {
                target.scrollIntoView({ behavior: 'auto', block: 'start' }); // Instant scroll
            }
        }, 0); // Immediate
    }
}

// ===== REMINDER FEATURE =====

// Reminder Elements
const editReminderEnabled = document.getElementById('edit-reminder-enabled');
const reminderPickerModal = document.getElementById('reminder-picker-modal');
const closeReminderPicker = document.getElementById('close-reminder-picker');
const dialDays = document.getElementById('dial-days');
const dialHours = document.getElementById('dial-hours');
const dialMinutes = document.getElementById('dial-minutes');
const btnReminderSave = document.getElementById('btn-reminder-save');

// Reminder state
let currentReminderValue = { days: 0, hours: 0, minutes: 0 };

// Initialize dial pickers
function initializeDialPickers() {
    // Days: 0-30
    for (let i = 0; i <= 30; i++) {
        const item = document.createElement('div');
        item.className = 'dial-item';
        item.textContent = i;
        item.dataset.value = i;
        dialDays.appendChild(item);
    }

    // Hours: 0-23
    for (let i = 0; i <= 23; i++) {
        const item = document.createElement('div');
        item.className = 'dial-item';
        item.textContent = i;
        item.dataset.value = i;
        dialHours.appendChild(item);
    }

    // Minutes: 0-59
    for (let i = 0; i <= 59; i++) {
        const item = document.createElement('div');
        item.className = 'dial-item';
        item.textContent = i;
        item.dataset.value = i;
        dialMinutes.appendChild(item);
    }

    // Add scroll listeners
    dialDays.addEventListener('scroll', () => updateDialHighlight(dialDays));
    dialHours.addEventListener('scroll', () => updateDialHighlight(dialHours));
    dialMinutes.addEventListener('scroll', () => updateDialHighlight(dialMinutes));
}

function updateDialHighlight(dialElement) {
    const items = dialElement.querySelectorAll('.dial-item');
    const scrollTop = dialElement.scrollTop;
    const centerPosition = scrollTop + dialElement.clientHeight / 2;

    let closestItem = null;
    let closestDistance = Infinity;

    items.forEach(item => {
        item.classList.remove('active');
        const itemCenter = item.offsetTop + item.clientHeight / 2;
        const distance = Math.abs(centerPosition - itemCenter);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestItem = item;
        }
    });

    if (closestItem) {
        closestItem.classList.add('active');
    }
}

function setDialValue(dialElement, value) {
    const items = dialElement.querySelectorAll('.dial-item');
    const target = Array.from(items).find(item => parseInt(item.dataset.value) === value);

    if (target) {
        const scrollTop = target.offsetTop - dialElement.clientHeight / 2 + target.clientHeight / 2;
        dialElement.scrollTop = scrollTop;
        updateDialHighlight(dialElement);
    }
}

function getDialValue(dialElement) {
    const activeItem = dialElement.querySelector('.dial-item.active');
    return activeItem ? parseInt(activeItem.dataset.value) : 0;
}

// Reminder checkbox listener
if (editReminderEnabled) {
    editReminderEnabled.addEventListener('change', async (e) => {
        if (e.target.checked) {
            // Request notification permission first
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert('알림 권한이 필요합니다. 브라우저 설정에서 알림을 허용해주세요.');
                    e.target.checked = false;
                    return;
                }
            } else if (Notification.permission === 'denied') {
                alert('알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.');
                e.target.checked = false;
                return;
            }

            // Open picker modal
            setDialValue(dialDays, currentReminderValue.days);
            setDialValue(dialHours, currentReminderValue.hours);
            setDialValue(dialMinutes, currentReminderValue.minutes);
            reminderPickerModal.classList.remove('hidden');
        }
    });
}

// Close reminder picker
if (closeReminderPicker) {
    closeReminderPicker.addEventListener('click', () => {
        reminderPickerModal.classList.add('hidden');
        editReminderEnabled.checked = false;
    });
}

// Save reminder
if (btnReminderSave) {
    btnReminderSave.addEventListener('click', () => {
        currentReminderValue = {
            days: getDialValue(dialDays),
            hours: getDialValue(dialHours),
            minutes: getDialValue(dialMinutes)
        };
        reminderPickerModal.classList.add('hidden');
    });
}

// Notification checker - runs every minute
function checkAndSendNotifications() {
    const now = new Date().getTime();

    events.forEach(event => {
        if (!event.reminder || !event.reminder.enabled) return;
        if (event.reminder.sent) return; // Already sent

        const eventTime = new Date(event.start).getTime();
        const reminderTime = eventTime - (
            event.reminder.days * 24 * 60 * 60 * 1000 +
            event.reminder.hours * 60 * 60 * 1000 +
            event.reminder.minutes * 60 * 1000
        );

        // Check if it's time to send (within 1 minute range)
        if (now >= reminderTime && now < reminderTime + 60000) {
            sendNotification(event);
            event.reminder.sent = true;
            saveEvents();
        }
    });
}

function sendNotification(event) {
    if (Notification.permission === 'granted') {
        const timeStr = event.isAllDay ? '종일' : new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

        new Notification('일정 알림', {
            body: `${event.title}\n${timeStr}`,
            icon: 'icon-192.png',
            badge: 'icon-192.png'
        });
    }
}

// Start notification checker
if (typeof Notification !== 'undefined') {
    initializeDialPickers();
    setInterval(checkAndSendNotifications, 60000); // Check every minute
    checkAndSendNotifications(); // Check immediately on load
}

// Auto set end time to 1 hour after start time
if (editStart) {
    editStart.addEventListener('change', () => {
        if (editStart.type === 'datetime-local' && editStart.value) {
            const startDate = new Date(editStart.value);
            if (!isNaN(startDate.getTime())) {
                const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
                editEnd.value = toLocalISOString(endDate).slice(0, 16);
            }
        }
    });
}

// ===== DRAG AND DROP FUNCTIONALITY =====

let dragState = {
    isDragging: false,
    draggedEvent: null,
    draggedEventDot: null,
    floatingClone: null,
    originalDate: null,
    currentDropTarget: null,
    longPressTimer: null,
    overlay: null
};

function initDragAndDrop(eventDot, event, dayDate) {
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    const handleStart = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        hasMoved = false;

        // Start long press timer
        dragState.longPressTimer = setTimeout(() => {
            if (!hasMoved) {
                startDrag(eventDot, event, dayDate);
            }
        }, 500);
    };

    const handleMove = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        const diffX = Math.abs(touch.clientX - startX);
        const diffY = Math.abs(touch.clientY - startY);

        if (diffX > 5 || diffY > 5) {
            hasMoved = true;
            clearTimeout(dragState.longPressTimer);
        }

        if (dragState.isDragging) {
            e.preventDefault();
            trackDrag(touch.clientX, touch.clientY);
        }
    };

    const handleEnd = (e) => {
        clearTimeout(dragState.longPressTimer);

        if (dragState.isDragging) {
            endDrag();
        }
    };

    eventDot.addEventListener('touchstart', handleStart, { passive: false });
    eventDot.addEventListener('mousedown', handleStart);

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mousemove', handleMove);

    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);
}

function startDrag(eventDot, event, dayDate) {
    dragState.isDragging = true;
    dragState.draggedEvent = event;
    dragState.draggedEventDot = eventDot;
    dragState.originalDate = new Date(dayDate);

    // Vibrate if available
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    // Hide original (make semi-transparent)
    eventDot.style.opacity = '0.3';

    // Create floating clone
    const clone = eventDot.cloneNode(true);
    clone.className = 'event-dot dragging-clone';
    clone.style.position = 'fixed';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '1001';
    clone.style.width = eventDot.offsetWidth + 'px';
    clone.style.transform = 'scale(1.5)';
    clone.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
    clone.style.opacity = '0.9';

    // Position at original location initially
    const rect = eventDot.getBoundingClientRect();
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';

    document.body.appendChild(clone);
    dragState.floatingClone = clone;

    // Create overlay
    dragState.overlay = document.createElement('div');
    dragState.overlay.className = 'drag-overlay';
    document.body.appendChild(dragState.overlay);

    console.log('[DRAG] Started dragging:', event.title);
}

function trackDrag(x, y) {
    // Move floating clone to follow pointer
    if (dragState.floatingClone) {
        dragState.floatingClone.style.left = (x - dragState.floatingClone.offsetWidth / 2) + 'px';
        dragState.floatingClone.style.top = (y - dragState.floatingClone.offsetHeight / 2) + 'px';
    }

    // Find element under pointer
    const elements = document.elementsFromPoint(x, y);
    const dayElement = elements.find(el => el.classList.contains('calendar-day'));

    // Clear previous drop target
    if (dragState.currentDropTarget) {
        dragState.currentDropTarget.classList.remove('drop-target');
    }

    // Set new drop target
    if (dayElement && dayElement.dataset.date) {
        dragState.currentDropTarget = dayElement;
        dayElement.classList.add('drop-target');
    } else {
        dragState.currentDropTarget = null;
    }
}

function endDrag() {
    if (!dragState.isDragging) return;

    // Restore original opacity
    if (dragState.draggedEventDot) {
        dragState.draggedEventDot.style.opacity = '';
    }

    // Remove floating clone
    if (dragState.floatingClone) {
        dragState.floatingClone.remove();
    }

    // Remove overlay
    if (dragState.overlay) {
        dragState.overlay.remove();
    }

    // Remove drop target highlight
    if (dragState.currentDropTarget) {
        dragState.currentDropTarget.classList.remove('drop-target');

        // Change event date
        const newDateStr = dragState.currentDropTarget.dataset.date;
        if (newDateStr) {
            const newDate = new Date(newDateStr);
            changeEventDate(dragState.draggedEvent, newDate);
        }
    }

    // Reset drag state
    dragState = {
        isDragging: false,
        draggedEvent: null,
        draggedEventDot: null,
        floatingClone: null,
        originalDate: null,
        currentDropTarget: null,
        longPressTimer: null,
        overlay: null
    };
}

function changeEventDate(event, newDate) {
    const oldStart = new Date(event.start);
    const oldEnd = new Date(event.end);

    // Calculate time difference (for multi-day events)
    const duration = oldEnd.getTime() - oldStart.getTime();

    // Create new start date with same time
    const newStart = new Date(newDate);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds(), oldStart.getMilliseconds());

    // Create new end date
    const newEnd = new Date(newStart.getTime() + duration);

    // Update event
    const eventIndex = events.findIndex(e => e.id === event.id);
    if (eventIndex !== -1) {
        events[eventIndex].start = newStart;
        events[eventIndex].end = newEnd;
        events[eventIndex].lastModified = Date.now();

        saveEvents();
        renderCalendar();

        console.log('[DRAG] Event moved from', oldStart, 'to', newStart);
    }
}
