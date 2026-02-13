import { Sound, Effects, injectHeader, injectFooter, injectMenu, getParams, discoverSets } from './ui.js';

let allQuestions = [];
let displayQuestions = [];
let currentSetId = 1;
let availableSets = [1];

async function init() {
    const { topic, level, set } = getParams();
    currentSetId = set;

    // 1. Load Config for Header Control
    let config = {};
    try {
        const configModule = await import(`../data/${topic}/${level}/config.js`);
        config = configModule.default;
    } catch (e) {
        console.error("Config not found, using defaults");
    }

    // 2. Inject Header with Config Values or Fallbacks
    injectHeader(
        config.headerTitle || topic.replace(/-/g, ' '), 
        `${config.headerSubtitlePrefix || "By Chiranjibi Sir"} • ${level.toUpperCase()} • SET ${set}`
    );
    
    injectFooter();

    // 3. Discover Sets First (Async probe)
    availableSets = await discoverSets(topic, level);

    // 4. Load Data
    const url = `../data/${topic}/${level}/set${set}.json`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Set not found");
        allQuestions = await res.json();
        displayQuestions = [...allQuestions];
        setupMenu(); // Re-render menu with discovered sets
        render();
    } catch (e) {
        document.getElementById('quiz-container').innerHTML = `<div class="text-center py-20 text-slate-500 font-bold">Failed to load: ${url}<br>${e.message}</div>`;
        setupMenu(); // Still render menu so user can switch sets
    }
}

function setupMenu() {
    injectMenu(
        currentSetId,
        availableSets, // Pass ARRAY of existing sets
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
        // CHANGED: Reduced 'mb-6' to 'mb-4' for better density
        card.className = "bg-[#1e293b] rounded-xl md:rounded-2xl shadow-2xl border-2 border-slate-700 overflow-hidden break-inside-avoid mb-4";
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
            btn.className = "option-btn w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-xl border-2 border-slate-600 text-slate-100 font-bold text-base md:text-lg bg-slate-800 hover:bg-slate-700 hover:border-slate-500 focus:outline-none relative overflow-hidden group flex items-center shadow-lg transition-all";

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
}

// Fixed TEACHER MODE Logic:
// UNLIMITED INTERACTION: No locks, no disabling, infinite re-clicks allowed.
function handleAnswer(btn, index, correctIndex, container, card) {
    const badge = btn.querySelector('span');

    // Reset animations so they can play again on re-click
    btn.classList.remove('animate-shake');
    void btn.offsetWidth; // Force reflow

    if (index === correctIndex) {
        // CORRECT
        // Style: Green, but keep fully interactive
        btn.className = "option-btn w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-xl border-2 border-[#22c55e] bg-[#16a34a] text-white font-bold text-base md:text-lg shadow-[0_0_15px_rgba(34,197,94,0.4)] flex items-center opacity-100";
        if (badge) {
            badge.className = "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black mr-3 shrink-0 border border-white text-white bg-transparent";
        }

        // Mark as answered (optional for logic, but doesn't block interaction now)
        card.setAttribute('data-answered', 'true');

        Sound.playCorrect();
        Effects.triggerConfetti();

        // NOTE: We do NOT disable siblings anymore. 
        // User can click Correct again to hear sound/see confetti again.

    } else {
        // WRONG
        // Style: Red, but keep fully interactive
        btn.className = "option-btn w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-xl border-2 border-[#ef4444] bg-[#dc2626] text-white font-bold text-base md:text-lg shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-shake flex items-center opacity-100";
        if (badge) {
            badge.className = "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black mr-3 shrink-0 border border-white text-white bg-transparent";
        }

        // NOTE: We do NOT disable the button. 
        // User can retry or mis-click again (classroom behavior).
        Sound.playWrong();
    }
}

init();