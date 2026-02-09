// --- 1. TAILWIND CONFIGURATION ---
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        theme: {
            extend: {
                fontFamily: { sans: ['Inter', 'sans-serif'] },
                screens: { 'xs': '375px' },
                colors: {
                    slate: { 850: '#1e293b', 900: '#0f172a', 950: '#020617' },
                    gold: { 400: '#FACC15', 500: '#EAB308', 600: '#CA8A04' }
                },
                animation: {
                    'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
                    'pop': 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                },
                keyframes: {
                    shake: {
                        '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
                        '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
                        '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
                        '40%, 60%': { transform: 'translate3d(4px, 0, 0)' }
                    },
                    pop: {
                        '0%': { transform: 'scale(0.8)', opacity: '0' },
                        '100%': { transform: 'scale(1)', opacity: '1' }
                    }
                }
            }
        }
    };
}

// --- 2. GLOBAL STATE ---
const UI_STATE = {
    sound: true,
    confetti: true,
    audioCtx: null,
    isMenuOpen: false
};

// --- 3. HELPER: SET DISCOVERY ---
// Scans for set1.json, set2.json, etc. until a 404 occurs.
export async function discoverSets(topic, level) {
    const sets = [];
    let current = 1;
    let keepLooking = true;
    const MAX_SAFETY_LIMIT = 50; // Prevent infinite loops if server misbehaves

    while (keepLooking && current <= MAX_SAFETY_LIMIT) {
        try {
            // Using HEAD request is lighter, but simple fetch is more robust on some static hosts
            const url = `../data/${topic}/${level}/set${current}.json`;
            const response = await fetch(url, { method: 'HEAD' });
            
            // Fallback for servers that don't support HEAD or return 405
            if (response.status === 405 || response.status === 404) {
                 if (response.status === 404) {
                     keepLooking = false;
                 } else {
                     // If 405 (Method Not Allowed), try GET
                     const getRes = await fetch(url);
                     if (getRes.ok) sets.push(current);
                     else keepLooking = false;
                 }
            } else if (response.ok) {
                sets.push(current);
            } else {
                keepLooking = false;
            }
        } catch (e) {
            // Network error or offline usually means stop
            keepLooking = false;
        }
        
        if (keepLooking) current++;
    }

    // Always return at least set 1 to prevent UI crash if discovery fails completely
    return sets.length > 0 ? sets : [1];
}

// --- 4. SOUND ENGINE ---
function initAudio() {
    if (!UI_STATE.audioCtx) {
        UI_STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (UI_STATE.audioCtx.state === 'suspended') {
        UI_STATE.audioCtx.resume();
    }
}

function playTone(freq, type, duration) {
    if (!UI_STATE.sound || !UI_STATE.audioCtx) return;
    const osc = UI_STATE.audioCtx.createOscillator();
    const gain = UI_STATE.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(UI_STATE.audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, UI_STATE.audioCtx.currentTime + duration);
    osc.stop(UI_STATE.audioCtx.currentTime + duration);
}

export const Sound = {
    playCorrect: () => {
        initAudio();
        playTone(800, 'sine', 0.1);
        setTimeout(() => playTone(1200, 'sine', 0.2), 100);
    },
    playWrong: () => {
        initAudio();
        if (!UI_STATE.audioCtx) return;
        const osc = UI_STATE.audioCtx.createOscillator();
        const gain = UI_STATE.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, UI_STATE.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, UI_STATE.audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(UI_STATE.audioCtx.destination);
        osc.start();
        gain.gain.setValueAtTime(0.5, UI_STATE.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, UI_STATE.audioCtx.currentTime + 0.3);
        osc.stop(UI_STATE.audioCtx.currentTime + 0.3);
    }
};

export const Effects = {
    triggerConfetti: () => {
        if (UI_STATE.confetti && window.confetti) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    },
    toggleSound: (btn) => {
        UI_STATE.sound = !UI_STATE.sound;
        btn.classList.toggle('effect-disabled', !UI_STATE.sound);
        initAudio();
    },
    toggleConfetti: (btn) => {
        UI_STATE.confetti = !UI_STATE.confetti;
        btn.classList.toggle('effect-disabled', !UI_STATE.confetti);
    }
};

// --- 5. APP SHELL INJECTION (Header + Menu Assembly) ---

export function injectHeader(title, subtitle) {
    // Inject Custom Scrollbar CSS for Menu
    const style = document.createElement('style');
    style.textContent = `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
    `;
    document.head.appendChild(style);

    const html = `
    <!-- MAIN APP SHELL WRAPPER -->
    <div class="fixed top-0 left-0 w-full z-50">
        
        <!-- HEADER (Z-INDEX 20: Sits on top of menu) -->
        <header class="relative z-20 bg-[#020617]/95 backdrop-blur-md shadow-2xl border-b border-slate-800">
            <div class="w-full max-w-[98%] mx-auto px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center gap-2 sm:gap-4 flex-nowrap">
                
                <!-- BRANDING -->
                <div class="flex items-stretch gap-2 sm:gap-4 self-center min-w-0">
                    <div class="w-1 sm:w-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] self-stretch shrink-0"></div>
                    <div class="flex flex-col justify-center min-w-0">
                        <h1 class="text-sm xs:text-base sm:text-xl md:text-2xl font-black tracking-wide text-white uppercase leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                            ${title} <span class="text-blue-400 hidden xs:inline">PRACTICE</span>
                        </h1>
                        <p class="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold text-slate-400 tracking-[0.15em] mt-0.5 sm:mt-1 uppercase leading-tight truncate">
                            ${subtitle}
                        </p>
                    </div>
                </div>
                
                <!-- CONTROLS -->
                <div class="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
                    <!-- Sound -->
                    <button id="btn-sound" class="relative overflow-hidden group flex items-center justify-center w-8 h-8 xs:w-9 xs:h-9 sm:w-11 sm:h-11 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500 hover:bg-slate-700 transition-all shadow-lg text-slate-200">
                        <span class="text-base xs:text-lg sm:text-xl">🔊</span>
                        <div class="slash-line absolute top-1/2 left-1/2 w-[80%] h-[2px] bg-red-500 -translate-x-1/2 -translate-y-1/2 -rotate-45 hidden"></div>
                    </button>
                    
                    <!-- Confetti -->
                    <button id="btn-confetti" class="relative overflow-hidden group flex items-center justify-center w-8 h-8 xs:w-9 xs:h-9 sm:w-11 sm:h-11 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500 hover:bg-slate-700 transition-all shadow-lg text-slate-200">
                        <span class="text-base xs:text-lg sm:text-xl">🎉</span>
                        <div class="slash-line absolute top-1/2 left-1/2 w-[80%] h-[2px] bg-red-500 -translate-x-1/2 -translate-y-1/2 -rotate-45 hidden"></div>
                    </button>

                    <div class="w-px h-6 sm:h-8 bg-slate-700 mx-0.5 sm:mx-1"></div>

                    <!-- Home -->
                    <a href="../index.html" class="group flex items-center justify-center w-8 h-8 xs:w-9 xs:h-9 sm:w-11 sm:h-11 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500 hover:bg-slate-700 transition-all shadow-lg text-slate-400 hover:text-white">
                        <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                    </a>

                    <!-- MENU TOGGLE (Responsive: Gear on small, TOOLS on large) -->
                    <button id="menu-toggle-btn" class="group flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 xs:px-3 xs:py-2 sm:px-5 sm:py-2.5 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500 hover:bg-slate-700 transition-all shrink-0 shadow-lg cursor-pointer">
                        <span class="text-[10px] xs:text-xs sm:text-sm font-bold text-slate-300 group-hover:text-white tracking-wide">
                            <span class="sm:hidden text-lg">⚙</span>
                            <span class="hidden sm:inline">TOOLS</span>
                        </span>
                        <!-- CHANGED: Added 'hidden sm:block' to hide arrow on mobile -->
                        <svg class="hidden sm:block h-3.5 w-3.5 sm:h-5 sm:w-5 text-slate-400 group-hover:text-blue-400 transition-transform duration-300" id="menu-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>

        <!-- SLIDING MENU -->
        <nav id="teacher-menu" class="absolute top-full left-0 w-full z-10 bg-[#0f172a] border-b border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform -translate-y-[150%] transition-transform duration-300 ease-out origin-top">
            <div id="menu-content" class="py-4 px-3 md:py-8 md:px-6">
                <!-- Content injected via JS -->
            </div>
        </nav>

    </div>
    
    <!-- CLICK OUTSIDE OVERLAY -->
    <div id="menu-overlay" class="fixed inset-0 bg-black/20 z-40 hidden backdrop-blur-[2px] transition-opacity duration-300"></div>
    `;

    document.getElementById('header-mount').innerHTML = html;

    // Attach Basic Listeners
    document.getElementById('btn-sound').onclick = function () { Effects.toggleSound(this); };
    document.getElementById('btn-confetti').onclick = function () { Effects.toggleConfetti(this); };

    // Attach Menu Logic
    initMenuSystem();
}

function initMenuSystem() {
    const btn = document.getElementById('menu-toggle-btn');
    const menu = document.getElementById('teacher-menu');
    const arrow = document.getElementById('menu-arrow');
    const overlay = document.getElementById('menu-overlay');

    function toggleMenu() {
        UI_STATE.isMenuOpen = !UI_STATE.isMenuOpen;
        updateMenuState();
    }

    function closeMenu() {
        if (!UI_STATE.isMenuOpen) return;
        UI_STATE.isMenuOpen = false;
        updateMenuState();
    }

    function updateMenuState() {
        if (UI_STATE.isMenuOpen) {
            menu.classList.remove('-translate-y-[150%]');
            menu.classList.add('translate-y-0');
            arrow.classList.add('rotate-180');

            overlay.classList.remove('hidden');
            requestAnimationFrame(() => overlay.classList.remove('opacity-0'));

            btn.classList.add('border-blue-500', 'bg-slate-700');
        } else {
            menu.classList.add('-translate-y-[150%]');
            menu.classList.remove('translate-y-0');
            arrow.classList.remove('rotate-180');

            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);

            btn.classList.remove('border-blue-500', 'bg-slate-700');
        }
    }

    btn.onclick = (e) => { e.stopPropagation(); toggleMenu(); };
    overlay.onclick = () => closeMenu();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI_STATE.isMenuOpen) closeMenu(); });
    window.closeAppMenu = closeMenu;
}

// Accepts activeSets as an ARRAY of integers e.g. [1, 2, 3]
export function injectMenu(currentSet, activeSets, onSetClick, onFilter, onRandom) {
    let setButtonsHtml = '';
    
    // Sort just in case
    activeSets.sort((a, b) => a - b);

    activeSets.forEach(i => {
        const isActive = (i == currentSet) ? 'bg-[#16a34a] border-[#22c55e] text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700';
        setButtonsHtml += `<button data-set="${i}" class="btn-set py-2 md:py-3 border font-bold rounded-lg transition-all text-xs md:text-base ${isActive}"><span class="md:hidden">${i}</span><span class="hidden md:inline">Set ${i}</span></button>`;
    });

    const html = `
    <div class="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-10">
        <!-- Sets (Fixed Height + Scroll) -->
        <div class="col-span-2 md:col-span-1 space-y-2 md:space-y-4">
            <h3 class="text-purple-400 text-xs font-black uppercase tracking-widest border-b border-slate-800 pb-2 flex justify-between">
                <span>Select Set</span>
                <span class="text-slate-600">${activeSets.length} Available</span>
            </h3>
            <!-- INTERNAL SCROLL CONTAINER -->
            <div class="max-h-[160px] md:max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                <div class="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-3 gap-2 md:gap-3" id="menu-set-grid">
                    ${setButtonsHtml}
                </div>
            </div>
        </div>
        
        <!-- Filters -->
        <div class="col-span-1 space-y-2 md:space-y-4">
            <h3 class="text-yellow-400 text-xs font-black uppercase tracking-widest border-b border-slate-800 pb-2">Filter</h3>
            <div class="flex md:grid md:grid-cols-2 gap-2 md:gap-4 h-10 md:h-auto">
                <button id="btn-odd" class="flex-1 md:py-8 bg-slate-800 border border-slate-700 text-slate-400 font-black rounded-lg md:rounded-xl hover:text-white hover:bg-slate-700 hover:border-indigo-500 flex items-center justify-center transition-all text-sm md:text-5xl">O</button>
                <button id="btn-even" class="flex-1 md:py-8 bg-slate-800 border border-slate-700 text-slate-400 font-black rounded-lg md:rounded-xl hover:text-white hover:bg-slate-700 hover:border-indigo-500 flex items-center justify-center transition-all text-sm md:text-5xl">E</button>
            </div>
        </div>
        
        <!-- Random -->
        <div class="col-span-1 space-y-2 md:space-y-4">
            <h3 class="text-indigo-500 text-xs font-black uppercase tracking-widest border-b border-slate-800 pb-2">Random</h3>
            <div class="flex flex-col gap-2 md:gap-3">
                <div class="flex gap-2 h-10 md:h-auto">
                    <div class="relative w-12 md:w-24 shrink-0">
                        <input type="number" id="random-count" placeholder="10" value="10" class="w-full h-full bg-slate-800 border border-slate-700 rounded-lg pl-1 pr-1 md:pl-3 md:pr-2 text-white font-bold focus:border-emerald-500 focus:outline-none text-center text-xs md:text-base">
                    </div>
                    <button id="btn-random" class="flex-1 md:py-3 bg-emerald-900/10 hover:bg-emerald-600 border border-emerald-900 hover:border-emerald-500 text-emerald-500 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-xs md:text-base px-2">
                        <span>GENERATE</span>
                    </button>
                </div>
                <!-- CHANGED: Added 'hidden md:block' to hide on mobile -->
                <p class="hidden md:block text-[10px] md:text-xs text-slate-500 font-medium leading-relaxed">
                    Generates a unique test from the entire pool of questions. Options are automatically shuffled.
                </p>
            </div>
        </div>
    </div>
    `;

    document.getElementById('menu-content').innerHTML = html;

    // Attach Logic
    document.querySelectorAll('.btn-set').forEach(btn => {
        btn.onclick = () => {
            if (window.closeAppMenu) window.closeAppMenu();
            onSetClick(btn.dataset.set);
        };
    });

    document.getElementById('btn-odd').onclick = () => { if (window.closeAppMenu) window.closeAppMenu(); onFilter('odd'); };
    document.getElementById('btn-even').onclick = () => { if (window.closeAppMenu) window.closeAppMenu(); onFilter('even'); };
    document.getElementById('btn-random').onclick = () => { if (window.closeAppMenu) window.closeAppMenu(); onRandom(document.getElementById('random-count').value); };
}

export function injectFooter() {
    const html = `
    <div class="fixed bottom-3 w-full text-center pointer-events-none select-none z-0">
        <p class="text-slate-600 opacity-40 text-[10px] font-bold tracking-[0.2em] uppercase">Designed by Subham Kumar Mallick</p>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

export function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
        topic: p.get('subject') || 'tenses',
        level: p.get('level') || 'high',
        set: p.get('set') || '1'
    };
}