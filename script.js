// script.js
// Pomodoro timer with robust state handling and edge case protection

(function () {
    'use strict';

    // constants for durations (in seconds)
    const DURATIONS = {
        FOCUS: 25 * 60,
        SHORT_BREAK: 5 * 60,
        LONG_BREAK: 15 * 60,
        LONG_BREAK_INTERVAL: 4
    };

    // state object storing runtime data
    const state = {
        session: 'FOCUS', // FOCUS | SHORT_BREAK | LONG_BREAK
        remaining: DURATIONS.FOCUS,
        completed: 0, // number of finished focus sessions
        timerActive: false,
        pauseTime: null, // timestamp when paused
        startTime: null, // timestamp when current countdown started
        expectedEnd: null, // timestamp when session should end
        intervalId: null
    };

    // DOM references
    const dom = {
        display: document.getElementById('timer-display'),
        label: document.getElementById('session-label'),
        subtitle: document.getElementById('session-subtitle'),
        start: document.getElementById('start-btn'),
        pause: document.getElementById('pause-btn'),
        reset: document.getElementById('reset-btn'),
        skip: document.getElementById('skip-btn'),
        progressCircle: document.getElementById('progress-circle'),
        completedSpan: document.getElementById('completed-count'),
        modeToggle: document.getElementById('mode-toggle'),
        body: document.body
    };

    // localStorage helpers
    function storageAvailable() {
        try {
            const x = '__storage_test__';
            localStorage.setItem(x, x);
            localStorage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    }

    function saveState() {
        if (!storageAvailable()) return;
        try {
            const copy = {
                session: state.session,
                remaining: state.remaining,
                completed: state.completed,
                timerActive: state.timerActive,
                expectedEnd: state.expectedEnd
            };
            localStorage.setItem('pomodoroState', JSON.stringify(copy));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    function loadState() {
        if (!storageAvailable()) return;
        try {
            const raw = localStorage.getItem('pomodoroState');
            if (!raw) return;
            const obj = JSON.parse(raw);
            if (
                typeof obj.session === 'string' &&
                typeof obj.remaining === 'number' &&
                typeof obj.completed === 'number'
            ) {
                state.session = obj.session;
                state.remaining = obj.remaining;
                state.completed = obj.completed;
                state.timerActive = obj.timerActive;
                state.expectedEnd = obj.expectedEnd;
                if (state.timerActive && state.expectedEnd) {
                    const now = Date.now();
                    state.remaining = Math.max(0, Math.ceil((state.expectedEnd - now) / 1000));
                    if (state.remaining === 0) {
                        endSession();
                    }
                }
            }
        } catch (e) {
            console.warn('Corrupted state, resetting', e);
            localStorage.removeItem('pomodoroState');
        }
    }

    // formatting helpers
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateSessionClass() {
        dom.body.classList.remove('focus-session', 'break-session', 'longbreak-session');
        if (state.session === 'FOCUS') {
            dom.body.classList.add('focus-session');
        } else if (state.session === 'SHORT_BREAK') {
            dom.body.classList.add('break-session');
        } else if (state.session === 'LONG_BREAK') {
            dom.body.classList.add('longbreak-session');
        }
    }

    function updateDisplay() {
        dom.display.textContent = formatTime(state.remaining);
        const sessionNames = {
            FOCUS: 'Focus',
            SHORT_BREAK: 'Short Break',
            LONG_BREAK: 'Long Break'
        };
        dom.label.textContent = sessionNames[state.session];
        
        // Update subtitle
        if (state.session === 'FOCUS') {
            dom.subtitle.textContent = `#${state.completed + 1} Time to focus!`;
        } else if (state.session === 'SHORT_BREAK') {
            dom.subtitle.textContent = 'Time for a short break!';
        } else {
            dom.subtitle.textContent = 'Time for a long break!';
        }
        
        dom.completedSpan.textContent = state.completed;
        updateProgressCircle();
        updateSessionClass();
    }

    function updateProgressCircle() {
        const total = DURATIONS[state.session];
        const elapsed = total - state.remaining;
        const circumference = 565; // 2 * PI * 90 (radius)
        const offset = circumference - (elapsed / total) * circumference;
        dom.progressCircle.style.strokeDashoffset = offset;
    }

    function clearIntervalSafe() {
        if (state.intervalId !== null) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
    }

    function startTimer() {
        if (state.timerActive) return; // prevent duplicates
        state.timerActive = true;
        dom.start.disabled = true;
        dom.pause.disabled = false;

        state.startTime = Date.now();
        state.expectedEnd = state.startTime + state.remaining * 1000;

        state.intervalId = setInterval(tick, 500);
        saveState();
    }

    function tick() {
        const now = Date.now();
        state.remaining = Math.max(0, Math.ceil((state.expectedEnd - now) / 1000));
        updateDisplay();
        // update title dynamically
        document.title = formatTime(state.remaining) + ' - Pomodoro';
        if (state.remaining <= 0) {
            endSession();
        }
    }

    function pauseTimer() {
        if (!state.timerActive) return;
        clearIntervalSafe();
        state.timerActive = false;
        dom.start.disabled = false;
        dom.pause.disabled = true;
        // remaining already updated by tick
        saveState();
    }

    function resetTimer() {
        clearIntervalSafe();
        state.timerActive = false;
        dom.start.disabled = false;
        dom.pause.disabled = true;
        state.remaining = DURATIONS[state.session];
        state.expectedEnd = null;
        updateDisplay();
        saveState();
    }

    function nextSession() {
        // increment completed when moving from focus
        if (state.session === 'FOCUS') {
            state.completed += 1;
        }
        if (state.session === 'FOCUS') {
            if (state.completed % DURATIONS.LONG_BREAK_INTERVAL === 0) {
                state.session = 'LONG_BREAK';
            } else {
                state.session = 'SHORT_BREAK';
            }
        } else {
            state.session = 'FOCUS';
        }
        state.remaining = DURATIONS[state.session];
        state.timerActive = false;
        dom.start.disabled = false;
        dom.pause.disabled = true;
        state.expectedEnd = null;
    }

    function skipSession() {
        clearIntervalSafe();
        nextSession();
        updateDisplay();
        saveState();
    }

    function endSession() {
        clearIntervalSafe();
        state.timerActive = false;
        dom.start.disabled = false;
        dom.pause.disabled = true;
        // notify
        notifyEnd();
        nextSession();
        updateDisplay();
        saveState();
    }

    function notifyEnd() {
        // page title update
        document.title = 'Timer done!';
        // sound optional (short beep)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            // Fallback: try audio element
            try {
                const audio = new Audio();
                audio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQIAAAAA';
                audio.play().catch(() => {});
            } catch {}
        }
        
        // browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Pomodoro', { body: 'Session complete!' });
        }
    }

    function requestNotificationPermission() {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function attachEventListeners() {
        dom.start.addEventListener('click', startTimer);
        dom.pause.addEventListener('click', pauseTimer);
        dom.reset.addEventListener('click', resetTimer);
        dom.skip.addEventListener('click', skipSession);
        dom.modeToggle.addEventListener('click', toggleMode);
        window.addEventListener('beforeunload', saveState);
        requestNotificationPermission();
    }

    function toggleMode() {
        document.body.classList.toggle('dark');
    }

    function init() {
        loadState();
        updateDisplay();
        attachEventListeners();
    }

    // initialize
    document.addEventListener('DOMContentLoaded', init);
})();