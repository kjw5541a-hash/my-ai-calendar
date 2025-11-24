// DOM Elements
const inputText = document.getElementById('input-text');
const eventColorInput = document.getElementById('event-color');
const colorPalette = document.getElementById('color-palette');
const btnQuickAdd = document.getElementById('btn-quick-add');
const parsingFeedback = document.getElementById('parsing-feedback');
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYear = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const btnOpenSync = document.getElementById('btn-open-sync');

// Modal Elements
const modal = document.getElementById('event-modal');
const closeModal = document.getElementById('close-modal');
const editTitle = document.getElementById('edit-title');
const editStart = document.getElementById('edit-start');
const editEnd = document.getElementById('edit-end');
const editDesc = document.getElementById('edit-desc');
const editColor = document.getElementById('edit-color');
const colorPreviewText = document.getElementById('color-preview-text');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnDelete = document.getElementById('modal-btn-delete');
const modalBtnGoogle = document.getElementById('modal-btn-google');

// API Config
const CLIENT_ID = '548955285266-anr16ad0iudd6ej88oceg5ahs6je6lgs.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// State
let currentDate = new Date(); // For calendar view
let events = []; // Array of event objects
let deletedEvents = []; // Array of { uid, googleId }
let editingEventId = null; // ID of event currently being edited
let inputDebounceTimer = null;

// Preset Colors
const PRESET_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#64748b'  // Slate
];

// Initialization
// Initialization
loadEvents();
renderCalendar();
// Initialize Main Palette
renderColorPaletteWithLogic(colorPalette, eventColorInput);
// Initialize Modal Palette
const modalColorPalette = document.getElementById('modal-color-palette'); // Need to get this element
if (modalColorPalette) {
    renderColorPaletteWithLogic(modalColorPalette, document.getElementById('edit-color'));
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
inputText.addEventListener('input', handleInputDebounce);
inputText.addEventListener('keydown', handleInputKeydown);
btnQuickAdd.addEventListener('click', handleQuickAdd);
prevMonthBtn.addEventListener('click', () => changeMonth(-1));
nextMonthBtn.addEventListener('click', () => changeMonth(1));
btnOpenSync.addEventListener('click', handleSyncClick);

// Modal Listeners
closeModal.addEventListener('click', hideModal);
modalBtnSave.addEventListener('click', saveModalEvent);
modalBtnDelete.addEventListener('click', deleteModalEvent);

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

    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Days of week headers
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

    // Empty slots for previous month
    for (let i = 0; i < firstDay.getDay(); i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day empty';
        calendarGrid.appendChild(el);
    }

    // Days
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        const el = document.createElement('div');
        el.className = 'calendar-day';

        // Check if today
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            el.classList.add('today');
        }

        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = i;
        el.appendChild(dayNum);

        // Render events for this day
        const dayEvents = events.filter(e => isSameDay(e.start, date));

        // Sort by time
        dayEvents.sort((a, b) => a.start - b.start);

        dayEvents.forEach(e => {
            const eventEl = document.createElement('div');
            eventEl.className = 'event-dot';

            // Time logic: Show time only if NOT all day
            let displayText = e.title;
            if (!e.isAllDay) {
                const timeStr = e.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                displayText = `${timeStr} ${e.title}`;
            }

            eventEl.textContent = displayText;
            eventEl.title = displayText; // Tooltip
            eventEl.addEventListener('click', (ev) => {
                ev.stopPropagation(); // Prevent clicking day
                openModal(e);
            });
            el.appendChild(eventEl);
        });

        // Click on day to add event
        el.addEventListener('click', () => {
            openModal({
                id: null,
                title: '',
                start: date, // Default to 9 AM on that day
                end: new Date(date.getTime() + 60 * 60 * 1000),
                description: '',
                isAllDay: true // Default to all day for manual click
            });
            // Adjust time to 9 AM if it was just a date click
            if (editingEventId === null) {
                const start = new Date(date);
                start.setHours(9, 0, 0, 0);
                editStart.value = toLocalISOString(start).slice(0, 16);
            }
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
        // 0. Process Deletions First
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

        // 1. Fetch Google Events (next 1 year)
        const now = new Date();
        const nextYear = new Date(now);
        nextYear.setFullYear(now.getFullYear() + 1);

        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': now.toISOString(),
            'timeMax': nextYear.toISOString(),
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

function createGoogleEventResource(le) {
    const start = le.isAllDay ? { date: formatDateForGoogleAllDay(le.start) } : { dateTime: le.start.toISOString() };
    const end = le.isAllDay ? { date: formatDateForGoogleAllDay(le.end) } : { dateTime: le.end.toISOString() };

    return {
        'summary': `[AI] ${le.title}`,
        'description': `${le.description || ''}\n\nUID:${le.uid}`, // Backup UID in description
        'start': start,
        'end': end,
        'extendedProperties': {
            'private': {
                'uid': le.uid
            }
        }
    };
}

function updateLocalEventFromGoogle(le, ge) {
    le.title = ge.summary.replace('[AI] ', '');
    le.description = ge.description ? ge.description.split('\n\nUID:')[0] : '';
    le.googleId = ge.id; // Ensure linked

    if (ge.start.date) {
        le.isAllDay = true;
        le.start = new Date(ge.start.date);
        le.end = new Date(ge.end.date);
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
        title: ge.summary.replace('[AI] ', ''),
        description: ge.description ? ge.description.split('\n\nUID:')[0] : '',
        lastModified: new Date(ge.updated).getTime()
    };

    if (ge.start.date) {
        newEvent.isAllDay = true;
        newEvent.start = new Date(ge.start.date);
        newEvent.end = new Date(ge.end.date);
    } else {
        newEvent.isAllDay = false;
        newEvent.start = new Date(ge.start.dateTime);
        newEvent.end = new Date(ge.end.dateTime);
    }
    events.push(newEvent);
}

// --- NLP & Input ---

function parseText(text) {
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
        if (text.includes('모레')) {
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

    // 4. Time Fallback (Regex)
    if (!hasTime) {
        const timeMatch = text.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?분?/) || text.match(/(\d{1,2}):(\d{2})/);
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
                if (ampm === '오전' && hour === 12) hour = 0;
            }
            mergedDate.setHours(hour, min, 0, 0);
            hasTime = true;
            isAllDay = false;
            matchedTimePatternText = timeMatch[0];
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

    return { title, start: mergedDate, end: finalEndDate, description: text, isAllDay };
}

function handleInputDebounce(e) {
    if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
    inputDebounceTimer = setTimeout(() => {
        handleInputPreview(e);
    }, 500); // 500ms delay
}

function handleInputPreview(e) {
    const val = e.target.value;
    if (!val.trim()) {
        parsingFeedback.textContent = '';
        return;
    }

    const parsed = parseText(val);
    if (parsed) {
        const timeStr = parsed.isAllDay ? '(종일)' : parsed.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        parsingFeedback.textContent = `💡 인식됨: ${parsed.start.toLocaleDateString('ko-KR')} ${timeStr} - ${parsed.title}`;
        parsingFeedback.style.color = '#10b981';
    } else {
        // Debug info to help diagnose
        parsingFeedback.innerHTML = `❓ 날짜를 찾을 수 없습니다.<br><span style="font-size:0.8em; color:#64748b">입력값: "${val}"</span>`;
        parsingFeedback.style.color = '#94a3b8';
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

    const parsed = parseText(text);
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
        parsingFeedback.textContent = '✅ 일정이 추가되었습니다!';

        // Move calendar to that date
        currentDate = new Date(parsed.start);
        renderCalendar();
    } else {
        alert("날짜를 인식하지 못했습니다.");
    }
}

// --- Modal ---

function openModal(event) {
    editingEventId = event.id;
    editTitle.value = event.title;
    editStart.value = toLocalISOString(event.start).slice(0, 16);
    editEnd.value = toLocalISOString(event.end).slice(0, 16); // Set End Date
    editDesc.value = event.description || '';
    editColor.value = event.color || '#3b82f6'; // Set Color
    colorPreviewText.textContent = event.color || '#3b82f6';

    // Update Google Link
    const googleLink = generateGoogleLink(event);
    modalBtnGoogle.href = googleLink;

    modal.classList.remove('hidden');
}

// Color picker listener
editColor.addEventListener('input', (e) => {
    colorPreviewText.textContent = e.target.value;
});

function hideModal() {
    modal.classList.add('hidden');
}

function saveModalEvent() {
    const title = editTitle.value;
    const start = new Date(editStart.value);
    const end = new Date(editEnd.value); // Get End Date
    const desc = editDesc.value;
    const color = editColor.value; // Get Color

    // Determine isAllDay: if duration is multiple of 24h and starts at 00:00?
    // Or just keep existing flag? 
    // For now, let's infer: if start/end are at 00:00, assume all day?
    // Better: check if user changed time. 
    // Let's stick to: if it was all day, keep it. 
    // But we need a way to toggle. For now, assume manual edit keeps isAllDay unless we add a checkbox.
    // However, if user changes time to non-00:00, it should probably be timed.
    let isAllDay = false;
    if (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0) {
        // Maybe all day?
    }
    // Re-use existing isAllDay if editing
    if (editingEventId) {
        const old = events.find(e => e.id === editingEventId);
        if (old) isAllDay = old.isAllDay;
    }

    if (editingEventId) {
        const idx = events.findIndex(e => e.id === editingEventId);
        if (idx !== -1) {
            events[idx] = {
                ...events[idx],
                title, start, end, description: desc, isAllDay, color,
                lastModified: Date.now()
            };
        }
    } else {
        const id = Date.now().toString();
        const newEvent = {
            id: id,
            uid: `${id}@aicalendar`,
            title, start, end, description: desc, isAllDay, color,
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
    // Local app uses inclusive end date (e.g., 23:59:59). Google needs the NEXT day (00:00:00).
    let endDateForGoogle = le.end;
    if (le.isAllDay) {
        endDateForGoogle = new Date(le.end.getTime() + 1000); // Add 1 second (or just > 1ms) to cross to next day
    }

    const end = le.isAllDay ? { date: formatDateForGoogleAllDay(endDateForGoogle) } : { dateTime: le.end.toISOString() };

    return {
        'summary': le.title,
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
        le.start = new Date(ge.start.date);
        // Google end date is exclusive, so subtract 1ms to make it inclusive for local app?
        // Local app: 12/8 ~ 12/12 (inclusive) -> End is 12/12 23:59:59
        // Google: Start 12/8, End 12/13
        // If we read 12/13 from Google, we want 12/12 23:59:59.
        const googleEnd = new Date(ge.end.date);
        le.end = new Date(googleEnd.getTime() - 1000);
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
        title: ge.summary.replace(/^\[AI\]\s+/, ''), // Remove [AI] if present
        description: ge.description ? ge.description.split('\n\nUID:')[0] : '',
        lastModified: new Date(ge.updated).getTime(),
        color: color
    };

    if (ge.start.date) {
        newEvent.isAllDay = true;
        newEvent.start = new Date(ge.start.date);
        // Google end date is exclusive
        const googleEnd = new Date(ge.end.date);
        newEvent.end = new Date(googleEnd.getTime() - 1000);
    } else {
        newEvent.isAllDay = false;
        newEvent.start = new Date(ge.start.dateTime);
        newEvent.end = new Date(ge.end.dateTime);
    }
    events.push(newEvent);
}

// Update renderCalendar to show multi-day events and colors
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

        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            el.classList.add('today');
        }

        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = i;
        el.appendChild(dayNum);

        // Filter events that overlap with this day
        // Day range: 00:00:00 to 23:59:59
        const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = events.filter(e => {
            // Check overlap
            return e.start <= dayEnd && e.end >= dayStart;
        });

        dayEvents.sort((a, b) => a.start - b.start);

        dayEvents.forEach(e => {
            const eventEl = document.createElement('div');
            eventEl.className = 'event-dot';

            let displayText = e.title;
            if (e.isAllDay) {
                displayText = `[Day] ${displayText}`;
            } else {
                // Only show time if it's the start day of the event
                if (isSameDay(e.start, date)) {
                    const timeStr = e.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                    displayText = `[${timeStr}] ${e.title}`;
                } else {
                    // Continuation
                    displayText = `(계속) ${displayText}`;
                }
            }

            eventEl.textContent = displayText;
            eventEl.title = displayText;

            // Apply Color
            const bgColor = e.color || '#3b82f6';
            eventEl.style.backgroundColor = bgColor;
            eventEl.style.color = getContrastColor(bgColor);

            eventEl.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openModal(e);
            });
            el.appendChild(eventEl);
        });

        el.addEventListener('click', () => {
            openModal({
                id: null,
                title: '',
                start: date,
                end: new Date(date.getTime() + 60 * 60 * 1000),
                description: '',
                isAllDay: true,
                color: eventColorInput.value // Use current picker value
            });
            if (editingEventId === null) {
                const start = new Date(date);
                start.setHours(9, 0, 0, 0);
                editStart.value = toLocalISOString(start).slice(0, 16);
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                editEnd.value = toLocalISOString(end).slice(0, 16);
            }
        });

        calendarGrid.appendChild(el);
    }
}
// --- Palette Logic ---

function renderColorPaletteWithLogic(container, inputElement) {
    container.innerHTML = '';

    PRESET_COLORS.forEach(color => {
        const dot = document.createElement('div');
        dot.className = 'color-option';
        dot.style.backgroundColor = color;
        dot.dataset.color = color; // Store hex
        dot.addEventListener('click', () => {
            inputElement.value = color;
            // Trigger input event manually to update UI
            inputElement.dispatchEvent(new Event('input'));

            if (inputElement.id === 'edit-color') {
                const previewText = document.getElementById('color-preview-text');
                if (previewText) previewText.textContent = color;
            }
            highlightSelected(container, color);
        });
        container.appendChild(dot);
    });

    // Custom Picker Button
    const customBtn = document.createElement('div');
    customBtn.className = 'color-option custom-picker-btn';
    customBtn.style.background = 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)';
    customBtn.title = "사용자 지정 색상";
    customBtn.addEventListener('click', () => {
        inputElement.click();
    });
    container.appendChild(customBtn);

    // Sync Input
    inputElement.addEventListener('input', (e) => {
        highlightSelected(container, e.target.value);
    });
}

function highlightSelected(container, color) {
    const dots = container.querySelectorAll('.color-option');
    dots.forEach(dot => {
        dot.classList.remove('selected');
        // Check if color matches (case insensitive)
        if (dot.dataset.color && dot.dataset.color.toLowerCase() === color.toLowerCase()) {
            dot.classList.add('selected');
        }
    });
}
