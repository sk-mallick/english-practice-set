import { Sound, Effects, injectHeader, injectFooter, injectMenu, getParams, discoverSets, UX, initPrintProtection } from './ui.js';

let allQuestions = [];
let displayQuestions = [];
let currentSetId = 1;
let availableSets = [1];

async function init() {
    // 0. Init Print Protection
    initPrintProtection();

    const { topic, level, set } = getParams();
    currentSetId = set;

    // 1. Show MCQ Specific Skeletons
    const container = document.getElementById('quiz-container');
    container.innerHTML = Array(5).fill(UX.Skeletons.getMCQSkeleton()).join('');

    // 2. Load Config for Header Control
    let config = {};
    try {
        const configModule = await import(`../data/${topic}/${level}/config.js`);
        config = configModule.default;
    } catch (e) {
        console.error("Config not found, using defaults");
    }

    // 3. Inject Header
    injectHeader(
        config.headerTitle || topic.replace(/-/g, ' '), 
        `${config.headerSubtitlePrefix || "By Chiranjibi Sir"} • ${level.toUpperCase()} • SET ${set}`
    );
    
    injectFooter();

    // 4. Discover Sets First (Async probe)
    availableSets = await discoverSets(topic, level);

    // 5. Load Data
    const url = `../data/${topic}/${level}/set${set}.json`;
    try {
        // PREFETCH NEXT SET (Performance Booster)
        UX.prefetchNextSet(topic, level, set);

        const res = await fetch(url);
        if (!res.ok) throw new Error("Set not found");
        allQuestions = await res.json();
        displayQuestions = [...allQuestions];
        setupMenu(); 
        render();
    } catch (e) {
        document.getElementById('quiz-container').innerHTML = `<div class="text-center py-20 text-slate-500 font-bold">Failed to load: ${url}<br>${e.message}</div>`;
        setupMenu(); 
    }
}

function setupMenu() {
    injectMenu(
        currentSetId,
        availableSets,
        (newSet) => {
            const { topic, level } = getParams();
            window.location.href = `?subject=${topic}&level=${level}&set=${newSet}`;
        },
        (filterType) => {
            if (filterType === 'odd') displayQuestions = allQuestions.filter((_, i) => (i + 1) % 2 !== 0);
            if (filterType === 'even') displayQuestions = allQuestions.filter((_, i) => (i + 1) % 2 === 0);
            render();
            closeMenu();
        },
        (count) => {
            const c = parseInt(count) || 10;
            const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
            displayQuestions = shuffled.slice(0, c);
            render();
            closeMenu();
        }
    );
}

function closeMenu() {
    document.getElementById('teacher-menu').classList.remove('open');
}

function render() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = '';

    if (displayQuestions.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-slate-500">No questions found.</div>`;
        return;
    }

    displayQuestions.forEach((item, index) => {
        const displayNum = index + 1;

        // Shuffle Options Logic
        const correctText = item.options[item.answer];
        let opts = item.options.map((opt, i) => ({ text: opt, originalIndex: i }));
        opts.sort(() => Math.random() - 0.5);
        const newAnswerIndex = opts.findIndex(o => o.text === correctText);

        const card = document.createElement('div');
        // Added opacity-0 and animation class
        card.className = "opacity-0 quiz-card-entry bg-[#1e293b] rounded-xl md:rounded-2xl shadow-2xl border-2 border-slate-700 overflow-hidden break-inside-avoid mb-4";
        card.setAttribute('data-answered', 'false');

        const header = document.createElement('div');
        header.className = "bg-[#0f172a] px-4 py-3 md:px-6 md:py-4 border-b border-slate-700 flex gap-3 md:gap-4 items-start";
        header.innerHTML = `
            <span class="font-black text-blue-400 text-lg md:text-xl whitespace-nowrap mt-0.5 bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-800 shadow-[0_0_10px_rgba(30,58,138,0.5)]">Q${displayNum}</span>
            <p class="text-white font-bold text-lg md:text-xl leading-relaxed tracking-wide pt-0.5">${item.q.replace(/_{2,}/g, '__________')}</p>
        `;

        const optsDiv = document.createElement('div');
        optsDiv.className = "p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4";

        const letters = ['A', 'B', 'C', 'D'];
        opts.forEach((optObj, i) => {
            const btn = document.createElement('button');
            btn.className = "option-btn w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-xl border-2 border-slate-600 text-slate-100 font-bold text-base md:text-lg bg-slate-800 hover:bg-slate-700 hover:border-slate-500 focus:outline-none relative overflow-hidden group flex items-center shadow-lg transition-all transform active:scale-95";

            btn.innerHTML = `
                <span class="badge-default inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black mr-3 transition-colors shrink-0 border border-slate-500 bg-slate-700 text-slate-400 group-hover:border-slate-400">${letters[i]}</span>
                <span class="flex-1">${optObj.text}</span>
            `;

            btn.onclick = () => handleAnswer(btn, i, newAnswerIndex, optsDiv, card);
            optsDiv.appendChild(btn);
        });

        card.appendChild(header);
        card.appendChild(optsDiv);
        container.appendChild(card);
    });

    // TRIGGER STAGGER ANIMATION (Reduced Delay to 30ms)
    UX.staggerElements('.quiz-card-entry', 30);
}

function handleAnswer(btn, index, correctIndex, container, card) {
    const badge = btn.querySelector('span');

    // 1. INSTANT FEEDBACK (Optimistic)
    // Scale down immediately to feel "pressed"
    btn.style.transform = "scale(0.98)";
    
    // Remove existing animations
    btn.classList.remove('animate-shake');
    void btn.offsetWidth; // Force reflow

    // 2. LOGIC & DELAYED FEEDBACK
    if (index === correctIndex) {
        // CORRECT: Instant Gratification
        Sound.playCorrect();
        Effects.triggerConfetti();
        
        btn.className = "option-btn w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-xl border-2 border-[#22c55e] bg-[#16a34a] text-white font-bold text-base md:text-lg shadow-[0_0_15px_rgba(34,197,94,0.4)] flex items-center opacity-100 transition-all duration-200";
        if (badge) badge.className = "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black mr-3 shrink-0 border border-white text-white bg-transparent";
        
        btn.style.transform = "scale(1)";
        card.setAttribute('data-answered', 'true');

    } else {
        // WRONG: Psychological Delay (Tension)
        setTimeout(() => {
            Sound.playWrong();
            btn.className = "option-btn w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-xl border-2 border-[#ef4444] bg-[#dc2626] text-white font-bold text-base md:text-lg shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-shake flex items-center opacity-100";
            if (badge) badge.className = "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black mr-3 shrink-0 border border-white text-white bg-transparent";
            btn.style.transform = "scale(1)";
        }, 150); 
    }
}

init();