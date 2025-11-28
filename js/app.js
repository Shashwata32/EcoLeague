/**
 * ECO LEAGUE - APPLICATION LOGIC
 * ==============================
 * This file handles the entire logic of the application including:
 * 1. Firebase Connection
 * 2. User Authentication
 * 3. Real-time Database Listeners
 * 4. UI Rendering & Navigation
 * 5. Admin Functionality
 */

// apiKey: "AIzaSyACJNaRSI4h5FeNySneMJxUh-cjkehcTqk",
//     authDomain: "ecoleague-fcf32.firebaseapp.com",
//     projectId: "ecoleague-fcf32",
//     storageBucket: "ecoleague-fcf32.firebasestorage.app",
//     messagingSenderId: "740456061890",
//     appId: "1:740456061890:web:357d89fa4559eae3f8145b",
//     measurementId: "G-3YL5M07LXD"

/**
 * ECO LEAGUE - APPLICATION LOGIC V5.1 (Bug Fixes)
 * ==========================================================
 * This file combines the High-Fidelity UI of V3 with the Admin Superpowers of V4.
 * * FEATURES INCLUDED:
 * 1. 🟢 Public: Real-time Leaderboard, Drop-zone Uploads, Wall of Fame.
 * 2. 🛡️ Admin: Dashboard with Charts, Zone Management (CRUD), Content Moderation.
 * 3. ⚡ Core: Real-time Countdown Timer, Data Persistence, History Archival.
 */

/**
 * ECO LEAGUE - APPLICATION LOGIC V6.1 (Final Polish)
 * ==================================================
 * FIXED: Chart Color Stability (Colors stay fixed to Area Names)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, increment, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyACJNaRSI4h5FeNySneMJxUh-cjkehcTqk",
    authDomain: "ecoleague-fcf32.firebaseapp.com",
    projectId: "ecoleague-fcf32",
    storageBucket: "ecoleague-fcf32.firebasestorage.app",
    messagingSenderId: "740456061890",
    appId: "1:740456061890:web:357d89fa4559eae3f8145b",
    measurementId: "G-3YL5M07LXD"
};

// --- INITIALIZATION ---
let app, auth, db;
const APP_COLLECTION_ID = 'eco-league-v2';

try {
    const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Init Failed:", e);
}

// --- STATE ---
let state = {
    currentUser: null,
    areas: [],
    submissions: [],
    wallOfFame: [],
    pastWinners: [],
    isAdminLoggedIn: false,
    timerInterval: null,
    charts: { participation: null, score: null }
};

// --- DOM ---
const elements = {
    loginScreen: document.getElementById('login-screen'),
    mainScreen: document.getElementById('main-screen'),
    contentArea: document.getElementById('content-area'),
    navBar: document.querySelector('nav'),
    navLinks: document.querySelectorAll('.nav-link'),
};

// --- ENTRY POINT ---
function init() {
    if (!auth) return;
    createLightbox();
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.currentUser = user;
            elements.loginScreen.classList.add('hidden');
            elements.mainScreen.classList.remove('hidden');
            startDataListeners();
            startCountdownTicker(); 
            window.switchView('home');
        } else {
            signInAnonymously(auth).catch(console.error);
        }
    });
}

function createLightbox() {
    const lightbox = document.createElement('div');
    lightbox.id = 'img-lightbox';
    lightbox.className = 'fixed inset-0 z-[100] bg-black/90 hidden flex items-center justify-center p-4 cursor-pointer';
    lightbox.onclick = () => lightbox.classList.add('hidden');
    lightbox.innerHTML = `
        <img id="lightbox-img" class="max-w-full max-h-full rounded-lg shadow-2xl transform transition-transform duration-300 scale-100">
        <div class="absolute top-4 right-4 text-white"><i class="fas fa-times text-2xl"></i></div>
    `;
    document.body.appendChild(lightbox);
}

// --- DATA LAYER ---
function startDataListeners() {
    // Areas
    onSnapshot(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas'), (snap) => {
        state.areas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort Leaderboard by Score
        state.areas.sort((a, b) => b.score - a.score);
        if (snap.empty && !snap.metadata.fromCache) seedInitialData();
        refreshCurrentView();
    });

    // Submissions
    onSnapshot(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions'), (snap) => {
        state.submissions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.wallOfFame = state.submissions.filter(sub => sub.hallOfFame === true);
        refreshCurrentView();
    });

    // History
    onSnapshot(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'history'), (snap) => {
        state.pastWinners = snap.docs.map(doc => doc.data());
        state.pastWinners.sort((a,b) => (b.monthTimestamp?.seconds || 0) - (a.monthTimestamp?.seconds || 0));
        refreshCurrentView();
    });
}

async function seedInitialData() {
    const ref = collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas');
    const areas = [
        { name: 'Green Valley', score: 0, badge: 'Contender' },
        { name: 'Sunrise Apts', score: 0, badge: 'Contender' }
    ];
    await Promise.all(areas.map(a => addDoc(ref, a)));
}

// --- NAVIGATION ---
window.switchView = (viewName) => {
    if (state.isAdminLoggedIn) {
        if(elements.navBar) elements.navBar.classList.add('hidden');
        if(viewName === 'upload') return; 
    } else {
        if(elements.navBar) elements.navBar.classList.remove('hidden');
    }

    elements.navLinks.forEach(l => {
        l.classList.remove('text-green-600', 'border-t-2', 'border-green-600');
        l.classList.add('text-gray-400');
    });

    const activeBtn = document.getElementById(`nav-${viewName}`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-green-600', 'border-t-2', 'border-green-600');
    }

    if (viewName === 'admin' && state.isAdminLoggedIn) {
        const dashboard = document.getElementById('admin-dashboard-container');
        if (!dashboard) renderAdminDashboard(); else updateAdminDashboardData();
    } else {
        // Cleanup charts
        if (state.charts.participation) { state.charts.participation.destroy(); state.charts.participation = null; }
        if (state.charts.score) { state.charts.score.destroy(); state.charts.score = null; }
        
        if (viewName === 'home') renderHome();
        if (viewName === 'upload') renderUpload();
        if (viewName === 'prizes') renderPrizes();
        if (viewName === 'admin' && !state.isAdminLoggedIn) renderAdminLogin();
    }
};

function refreshCurrentView() {
    if(document.getElementById('leaderboard-container')) renderHome();
    if(document.getElementById('prizes-container')) renderPrizes();
    if(document.getElementById('admin-dashboard-container')) updateAdminDashboardData();
}

// --- TIMER ---
function startCountdownTicker() {
    if(state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        const el = document.getElementById('countdown-timer');
        if(el) el.innerHTML = getRemainingTimeHTML();
    }, 1000);
}

function getRemainingTimeHTML() {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const diff = endOfMonth - now;

    if (diff <= 0) return `<span class="text-yellow-200 font-bold tracking-widest animate-pulse">CALCULATING...</span>`;

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    return `
        <div class="flex items-center gap-3 text-center text-white">
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm"><span class="text-xl font-bold font-fredoka block leading-none">${d}</span><span class="text-[8px] font-bold uppercase opacity-70">Days</span></div>
            <span class="text-xl font-bold opacity-50">:</span>
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm"><span class="text-xl font-bold font-fredoka block leading-none">${h}</span><span class="text-[8px] font-bold uppercase opacity-70">Hrs</span></div>
            <span class="text-xl font-bold opacity-50">:</span>
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm"><span class="text-xl font-bold font-fredoka block leading-none">${m}</span><span class="text-[8px] font-bold uppercase opacity-70">Min</span></div>
            <span class="text-xl font-bold opacity-50">:</span>
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm"><span class="text-xl font-bold font-fredoka block leading-none">${s}</span><span class="text-[8px] font-bold uppercase opacity-70">Sec</span></div>
        </div>
    `;
}

// --- PUBLIC VIEWS ---

function renderHome() {
    const timerHTML = getRemainingTimeHTML();
    let html = `
        <div id="leaderboard-container" class="animate-fade-in p-5 space-y-8 pb-24">
            <div class="bg-gradient-to-br from-green-600 to-emerald-800 rounded-3xl p-6 text-white shadow-xl shadow-green-200 relative overflow-hidden">
                <div class="relative z-10">
                    <h2 class="text-xs font-bold uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2"><i class="fas fa-flag-checkered"></i> Race to the finish</h2>
                    <div id="countdown-timer" class="flex justify-start">${timerHTML}</div>
                </div>
                <i class="fas fa-leaf absolute -bottom-6 -right-6 text-9xl text-white opacity-10 transform rotate-12"></i>
            </div>
            ${state.wallOfFame.length > 0 ? `
                <div class="space-y-3">
                    <div class="flex justify-between items-end px-1"><h3 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-star text-yellow-400"></i> Wall of Fame</h3></div>
                    <div class="flex gap-4 overflow-x-auto pb-6 snap-x px-1 -mx-1" style="scrollbar-width: none;">
                        ${state.wallOfFame.map(item => `
                            <div class="snap-start shrink-0 w-48 relative group transition-transform hover:scale-95 cursor-pointer" onclick="window.zoomImage('${item.image}')">
                                <div class="w-48 h-56 rounded-2xl overflow-hidden shadow-lg border-2 border-white relative">
                                    <img src="${item.image}" class="w-full h-full object-cover">
                                    <div class="absolute bottom-0 left-0 p-3 w-full bg-gradient-to-t from-black/80 to-transparent">
                                        <p class="text-white text-xs font-bold truncate">${state.areas.find(a=>a.id===item.areaId)?.name || 'Community'}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="space-y-4">
                <div class="flex justify-between items-end px-1"><h3 class="font-bold text-gray-800">Live Rankings</h3><span class="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full animate-pulse">● Live</span></div>
    `;

    state.areas.forEach((area, index) => {
        let rankStyles = "bg-white border border-gray-100";
        let icon = `<span class="text-gray-400 font-bold text-lg w-8 text-center">#${index+1}</span>`;
        let scoreColor = "text-gray-800";
        if(index === 0) {
            rankStyles = "bg-gradient-to-r from-yellow-50 to-orange-50 border-orange-100 ring-2 ring-orange-100 ring-offset-2";
            icon = `<div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-sm"><i class="fas fa-trophy"></i></div>`;
            scoreColor = "text-yellow-700";
        } else if (index === 1) icon = `<div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><i class="fas fa-medal"></i></div>`;
        else if (index === 2) icon = `<div class="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-amber-700"><i class="fas fa-medal"></i></div>`;

        html += `
            <div class="${rankStyles} rounded-2xl p-4 shadow-sm flex items-center justify-between transform transition hover:scale-[1.02]">
                <div class="flex items-center gap-4">
                    ${icon}
                    <div><h3 class="font-bold text-gray-800 text-sm">${area.name}</h3><span class="text-[10px] px-2 py-0.5 rounded-md bg-white/50 border border-gray-100 text-gray-500 font-medium">${area.badge || 'Contender'}</span></div>
                </div>
                <div class="text-right"><div class="text-xl font-black ${scoreColor} font-fredoka">${area.score}</div><div class="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Points</div></div>
            </div>
        `;
    });
    html += `</div></div>`;
    elements.contentArea.innerHTML = html;
}

function renderUpload() {
    const options = state.areas.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    elements.contentArea.innerHTML = `
        <div class="animate-fade-in p-5 pb-24">
            <h2 class="text-2xl font-bold font-fredoka text-gray-800 mb-6">New Report</h2>
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Area</label><div class="relative"><select id="input-area" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl appearance-none font-medium text-gray-700 outline-none">${options}</select><i class="fas fa-chevron-down absolute right-4 top-4 text-gray-400 pointer-events-none"></i></div></div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Evidence</label>
                    <div id="drop-zone" onclick="document.getElementById('file-input').click()" class="border-2 border-dashed border-gray-300 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-green-400 transition-all group overflow-hidden relative">
                        <input type="file" id="file-input" accept="image/*" class="hidden" onchange="window.previewImage(this)">
                        <div id="upload-placeholder" class="text-center p-4"><div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-100 transition-colors"><i class="fas fa-camera text-xl text-gray-400 group-hover:text-green-600"></i></div><p class="text-sm font-bold text-gray-600">Tap to upload photo</p></div>
                        <div id="preview-container" class="hidden w-full h-full relative"><img id="preview-img" class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="text-white text-xs font-bold border border-white px-3 py-1 rounded-full backdrop-blur-md">Change</span></div></div>
                    </div>
                </div>
                <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label><textarea id="input-desc" rows="3" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 outline-none" placeholder="We cleaned the park..."></textarea></div>
                <button onclick="window.submitReport()" id="btn-submit" class="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2"><span>Submit</span><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;
}

function renderPrizes() {
    let historyHtml = '';
    if (state.pastWinners.length > 0) {
        historyHtml = `<div class="mt-8 border-t border-gray-200 pt-8"><h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-history text-gray-400"></i> Hall of Fame</h3><div class="space-y-3">`;
        state.pastWinners.forEach(winner => {
            historyHtml += `<div class="bg-gray-800 text-white rounded-xl p-4 flex justify-between items-center shadow-lg border border-gray-700 relative overflow-hidden"><div class="flex items-center gap-4 relative z-10"><div class="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black"><i class="fas fa-crown"></i></div><div><div class="font-bold text-sm text-yellow-100">${winner.winnerName}</div><div class="text-[10px] text-gray-400 uppercase tracking-wide font-medium">${winner.monthName}</div></div></div><div class="font-fredoka text-xl text-green-400 relative z-10">${winner.finalScore} pts</div></div>`;
        });
        historyHtml += `</div></div>`;
    } else {
        historyHtml = `<div class="mt-8 pt-6 border-t border-dashed border-gray-300 text-center"><p class="text-gray-400 text-xs italic">Past winners will appear here.</p></div>`;
    }
    elements.contentArea.innerHTML = `<div id="prizes-container" class="animate-fade-in p-5 pb-24"><div class="text-center mb-8 mt-2"><h2 class="text-3xl font-bold font-fredoka text-gray-800">Monthly Prizes</h2><p class="text-gray-500 text-sm">Keep your area clean to win!</p></div><div class="grid grid-cols-1 gap-4"><div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4"><div class="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-yellow-100"><i class="fas fa-trophy text-2xl"></i></div><div><h3 class="font-bold text-gray-800 text-lg">Golden Broom</h3><p class="text-sm text-gray-500">Championship Trophy</p></div></div><div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4"><div class="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100"><i class="fas fa-tree text-2xl"></i></div><div><h3 class="font-bold text-gray-800 text-lg">Green Upgrade</h3><p class="text-sm text-gray-500">50 Tree Saplings</p></div></div></div>${historyHtml}</div>`;
}

// --- ADMIN DASHBOARD ---

function renderAdminLogin() {
    elements.contentArea.innerHTML = `
        <div class="animate-fade-in p-8 flex flex-col justify-center min-h-[80vh]">
            <div class="text-center mb-10"><h2 class="text-3xl font-bold font-fredoka text-gray-900">Admin Analytics</h2><p class="text-gray-500">Restricted Access</p></div>
            <div class="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-5">
                <input type="text" id="admin-id" class="w-full p-4 bg-gray-50 rounded-xl outline-none border border-transparent focus:border-gray-300 transition" placeholder="Admin ID">
                <input type="password" id="admin-pass" class="w-full p-4 bg-gray-50 rounded-xl outline-none border border-transparent focus:border-gray-300 transition" placeholder="Password">
                <button onclick="window.attemptAdminLogin()" class="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg">Access Dashboard</button>
            </div>
            <button onclick="window.switchView('home')" class="mt-8 text-gray-400 text-sm w-full hover:text-gray-600">Back to Public App</button>
        </div>
    `;
}

function renderAdminDashboard() {
    elements.contentArea.innerHTML = `
        <div id="admin-dashboard-container" class="animate-fade-in p-5 pb-24">
            <div class="flex justify-between items-center mb-8">
                <div><h2 class="text-2xl font-bold font-fredoka text-gray-900">Dashboard</h2><p class="text-xs text-gray-500 font-medium">Team Zyrox</p></div>
                <button onclick="window.logoutAdmin()" class="text-red-500 text-sm font-bold bg-red-50 px-3 py-1 rounded-lg">Logout</button>
            </div>
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <h3 class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2"><i class="fas fa-map-signs text-blue-500"></i> Manage Zones</h3>
                <div class="flex gap-2 mb-4"><input type="text" id="new-area-name" placeholder="New Area Name" class="flex-1 bg-gray-50 px-4 py-2 rounded-lg text-sm border border-gray-200 outline-none"><button onclick="window.createArea()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><i class="fas fa-plus"></i> Add</button></div>
                <div id="admin-area-list" class="space-y-2 max-h-40 overflow-y-auto"></div>
            </div>
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <h3 class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2"><i class="fas fa-star text-yellow-500"></i> Manage Wall of Fame</h3>
                <div id="admin-wall-list" class="flex gap-2 overflow-x-auto pb-2 min-h-[50px]"></div>
            </div>
            <div class="mb-8"><button onclick="window.announceWinners()" class="w-full bg-yellow-100 text-yellow-900 p-4 rounded-xl text-left hover:scale-[1.01] transition border border-yellow-200 flex justify-between items-center"><div><span class="text-xs font-bold uppercase block opacity-70">End of Month Protocol</span><span class="font-bold text-lg">Announce Winner & Reset</span></div><i class="fas fa-trophy text-2xl"></i></button></div>
            <div class="grid grid-cols-2 gap-4 mb-8"><div class="bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div class="relative h-32 w-full"><canvas id="participationChart"></canvas></div></div><div class="bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div class="relative h-32 w-full"><canvas id="scoreChart"></canvas></div></div></div>
            <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-clipboard-check text-green-600"></i> Pending Inspections</h3>
            <div id="submissions-list" class="space-y-4"></div>
        </div>
    `;
    initCharts();
    updateAdminDashboardData();
}

function updateAdminDashboardData() {
    if (!state.isAdminLoggedIn) return;

    const areaList = document.getElementById('admin-area-list');
    if (areaList) {
        areaList.innerHTML = state.areas.map(area => `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                <span class="text-sm font-medium text-gray-700">${area.name}</span>
                <div class="flex gap-1">
                    <button onclick="window.renameArea('${area.id}', '${area.name}')" class="text-blue-400 hover:text-blue-600 p-1"><i class="fas fa-pen"></i></button>
                    <button onclick="window.deleteArea('${area.id}')" class="text-red-400 hover:text-red-600 p-1"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    const wallList = document.getElementById('admin-wall-list');
    if (wallList) {
        wallList.innerHTML = state.wallOfFame.length === 0 ? '<p class="text-xs text-gray-400 italic">No active items.</p>' : 
        state.wallOfFame.map(item => `
            <div class="shrink-0 w-24 relative group cursor-pointer" onclick="window.zoomImage('${item.image}')">
                <img src="${item.image}" class="w-24 h-24 object-cover rounded-lg border border-gray-100">
                <button onclick="window.removeFromWall('${item.id}'); event.stopPropagation();" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shadow-md"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    }

    const subList = document.getElementById('submissions-list');
    if (subList) {
        const pendingDocs = state.submissions.filter(doc => doc.status === 'pending');
        if (pendingDocs.length === 0) {
            subList.innerHTML = `<div class="bg-gray-50 rounded-xl p-8 text-center"><p class="text-gray-400 text-sm">All caught up!</p></div>`;
        } else {
            subList.innerHTML = pendingDocs.map(sub => `
                <div class="bg-white rounded-2xl shadow-sm p-4 border border-gray-200">
                    <div class="flex justify-between items-center mb-2"><span class="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded uppercase">${state.areas.find(a => a.id === sub.areaId)?.name || 'Unknown'}</span></div>
                    ${sub.image ? `<img src="${sub.image}" class="w-full h-40 object-cover rounded-xl mb-3 bg-gray-50 shadow-sm cursor-zoom-in" onclick="window.zoomImage('${sub.image}')" />` : ''}
                    <p class="text-gray-800 text-sm font-medium mb-3">"${sub.description}"</p>
                    


                    <div class="flex gap-2 items-center mt-3">
    <div class="relative w-16">
        <input type="number" id="score-${sub.id}" value="5" min="1" max="10" 
            class="w-full p-2 text-center font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-green-500">
    </div>
    
    <button onclick="window.gradeSubmission('${sub.id}', '${sub.areaId}')" 
        class="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition shadow-sm">
        Approve
    </button>
    
    <button onclick="window.rejectSubmission('${sub.id}')" 
        class="px-3 py-2 text-red-400 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition">
        <i class="fas fa-times"></i>
    </button>
</div>


                </div>
            `).join('');
        }
    }
    updateCharts();
}

/* <div class="flex gap-2">
                        <button onclick="window.gradeSubmission('${sub.id}', '${sub.areaId}', 5)" class="flex-1 bg-white border border-gray-200 text-green-600 py-2 rounded-lg text-xs font-bold">Accept (+5)</button>
                        <button onclick="window.gradeSubmission('${sub.id}', '${sub.areaId}', 10, true)" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold">Fame (+10)</button>
                        <button onclick="window.rejectSubmission('${sub.id}')" class="px-3 text-red-400 hover:bg-red-50 rounded-lg"><i class="fas fa-times"></i></button>
                    </div> */
function initCharts() {
    const ctx1 = document.getElementById('participationChart');
    const ctx2 = document.getElementById('scoreChart');
    if(!ctx1 || !ctx2) return;

    if(state.charts.participation) state.charts.participation.destroy();
    if(state.charts.score) state.charts.score.destroy();

    const colors = ['#16a34a', '#ca8a04', '#2563eb', '#9333ea', '#db2777', '#0891b2'];

    state.charts.participation = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    state.charts.score = new Chart(ctx2, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, display: false }, x: { display: false } } }
    });
}

function updateCharts() {
    if (!state.charts.participation || !state.charts.score) return;

    // FIX: Sort areas ALPHABETICALLY for charts so colors stick to names, not ranks
    const sortedAreas = [...state.areas].sort((a, b) => a.name.localeCompare(b.name));
    
    const areaCounts = {};
    const areaScores = [];
    const labels = [];
    
    sortedAreas.forEach(a => {
        areaCounts[a.name] = 0;
        labels.push(a.name.split(' ')[0]);
        areaScores.push(a.score);
    });
    
    state.submissions.forEach(sub => {
        const area = state.areas.find(a => a.id === sub.areaId);
        if(area) areaCounts[area.name]++;
    });

    state.charts.participation.data.labels = Object.keys(areaCounts);
    state.charts.participation.data.datasets[0].data = Object.values(areaCounts);
    state.charts.participation.update();

    state.charts.score.data.labels = labels;
    state.charts.score.data.datasets[0].data = areaScores;
    state.charts.score.update();
}

// --- LOGIC HANDLERS ---
window.attemptAdminLogin = () => {
    const id = document.getElementById('admin-id').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    if (id.toLowerCase() === 'admin' && pass === 'TeamZyrox') {
        state.isAdminLoggedIn = true;
        window.switchView('admin');
    } else alert("Access Denied.");
};

window.logoutAdmin = () => { state.isAdminLoggedIn = false; window.switchView('home'); };

window.createArea = async () => {
    const name = document.getElementById('new-area-name').value.trim();
    if(!name) return;
    try { await addDoc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas'), { name, score: 0, badge: 'Contender' }); document.getElementById('new-area-name').value = ''; } catch(e) { console.error(e); }
};
window.deleteArea = async (id) => { if(confirm("Delete area?")) await deleteDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', id)); };
window.renameArea = async (id, old) => { const n = prompt("New name:", old); if(n && n!==old) await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', id), { name: n }); };
window.removeFromWall = async (id) => { if(confirm("Remove from Wall?")) await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', id), { hallOfFame: false }); };

// window.announceWinners = async () => {
//     if(!confirm("End month & RESET scores?")) return;
//     if(state.areas.length === 0) return;
//     const winner = state.areas[0]; // Top score since default list is sorted
//     const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
//     try {
//         const batch = writeBatch(db);
//         batch.set(doc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'history')), { winnerName: winner.name, finalScore: winner.score, monthName: month, monthTimestamp: serverTimestamp() });
//         state.areas.forEach(a => batch.update(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', a.id), { score: 0, badge: 'Contender' }));
//         await batch.commit();
//         alert(`🏆 ${winner.name} Wins! Scores reset.`);
//     } catch(e) { console.error(e); }
// };

window.announceWinners = async () => {
    // 1. Update confirmation message to be clear
    if(!confirm("End month & RESET scores? This will clear all submissions and reset charts.")) return;
    
    if(state.areas.length === 0) return;
    
    // Sort logic is handled in listeners, but we take index 0 just to be safe
    const winner = state.areas[0]; 
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    try {
        const batch = writeBatch(db);

        // 2. Archive the Winner
        batch.set(doc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'history')), { 
            winnerName: winner.name, 
            finalScore: winner.score, 
            monthName: month, 
            monthTimestamp: serverTimestamp() 
        });

        // 3. Reset Area Scores (Fixes Bar Chart)
        state.areas.forEach(a => {
            batch.update(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', a.id), { 
                score: 0, 
                badge: 'Contender' 
            });
        });

        // 4. DELETE ALL SUBMISSIONS (Fixes Pie Chart)
        // We must delete these so the submission count goes back to 0
        state.submissions.forEach(sub => {
            batch.delete(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', sub.id));
        });

        await batch.commit();
        alert(`🏆 ${winner.name} Wins! Scores and Charts reset.`);
    } catch(e) { 
        console.error(e); 
        alert("Error during reset. Check console.");
    }
};

// window.gradeSubmission = async (subId, areaId, points, fame = false) => {
//     try { 
//         await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', areaId), { score: increment(Number(points)) }); 
//         await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', subId), { status: 'approved', pointsAwarded: points, hallOfFame: fame }); 
//     } catch (e) { console.error(e); }
// };

window.gradeSubmission = async (subId, areaId) => {
    // 1. Get the value from the specific input field for this submission
    const inputEl = document.getElementById(`score-${subId}`);
    if (!inputEl) return;

    const points = parseInt(inputEl.value);

    // 2. Validation
    if (isNaN(points) || points < 1 || points > 10) {
        alert("Please enter a score between 1 and 10.");
        return;
    }

    // 3. Determine Fame Status (Score > 8)
    const isFame = points > 8;

    try { 
        // Update Area Score
        await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', areaId), { 
            score: increment(points) 
        }); 
        
        // Update Submission Status
        await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', subId), { 
            status: 'approved', 
            pointsAwarded: points, 
            hallOfFame: isFame // Automatically set true if > 8
        }); 
        
    } catch (e) { 
        console.error(e); 
        alert("Error grading submission");
    }
};

window.rejectSubmission = async (subId) => { if(confirm("Reject?")) await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', subId), { status: 'rejected' }); };

window.zoomImage = (src) => {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('img-lightbox').classList.remove('hidden');
};

window.previewImage = (input) => {
    const file = input.files[0];
    if (file) {
        if(file.size > 20000000) return alert("Image too large (Max 1MB)");
        const reader = new FileReader();
        reader.onload = (e) => { document.getElementById('preview-img').src = e.target.result; document.getElementById('preview-container').classList.remove('hidden'); document.getElementById('upload-placeholder').classList.add('hidden'); };
        reader.readAsDataURL(file);
    }
};
// --- UPLOAD LOGIC ---

window.submitReport = async () => {
    const btn = document.getElementById('btn-submit');
    const areaId = document.getElementById('input-area').value;
    const desc = document.getElementById('input-desc').value;
    const fileInput = document.getElementById('file-input');
    
    if (!areaId || !desc) return alert("Please fill in all fields.");
    if (!fileInput.files[0]) return alert("Please select a photo.");

    // Visual Feedback
    btn.innerHTML = `<i class="fas fa-cog fa-spin"></i> Optimizing...`; 
    btn.disabled = true;

    try {
        // 1. SMART PROCESSING (Uses the library to avoid freezing)
        const finalImageBase64 = await processImage(fileInput.files[0]);

        btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Uploading...`;

        // 2. Upload to Firestore
        await addDoc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions'), { 
            areaId, 
            userId: state.currentUser?.uid || 'anonymous', 
            description: desc, 
            image: finalImageBase64, 
            status: 'pending', 
            hallOfFame: false, 
            timestamp: serverTimestamp() 
        });

        alert("Submitted Successfully!"); 
        window.switchView('home');

        // Clear form
        document.getElementById('input-desc').value = '';
        document.getElementById('file-input').value = '';
        document.getElementById('preview-container').classList.add('hidden');
        document.getElementById('upload-placeholder').classList.remove('hidden');

    } catch (e) { 
        console.error("Error:", e);
        // If it fails, give a clear reason
        alert("Upload failed. " + e.message); 
    } finally { 
        btn.innerHTML = `Submit <i class="fas fa-paper-plane"></i>`; 
        btn.disabled = false; 
    }
};

// --- HELPER: Professional Image Processor ---
async function processImage(file) {
    console.log("Starting processing...", file.type, file.size);

    // A. Handle iPhone HEIC files
    if (file.type === "image/heic" || file.name.toLowerCase().endsWith('.heic')) {
        try {
            console.log("HEIC detected. Converting...");
            // Only runs if heic2any is loaded
            if (typeof heic2any !== 'undefined') {
                const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
                file = convertedBlob; 
            }
        } catch (e) {
            console.warn("HEIC conversion skipped:", e);
        }
    }

    // B. Setup Compression Options
    const options = {
        maxSizeMB: 0.8,          // Target file size (0.8MB is safe for Firestore)
        maxWidthOrHeight: 1200,  // Max dimension (good balance of quality/size)
        useWebWorker: true,      // CRITICAL: Runs in background to prevent freezing
        fileType: "image/jpeg"   // Force JPEG format
    };

    try {
        // C. Run Compression
        const compressedFile = await imageCompression(file, options);
        console.log(`Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        // D. Convert to Base64 for Database
        return await imageCompression.getDataUrlFromFile(compressedFile);
    } catch (error) {
        console.error("Compression failed:", error);
        throw new Error("Could not compress image. Try a smaller one.");
    }
}

// window.submitReport = async () => {
//     const btn = document.getElementById('btn-submit');
//     const areaId = document.getElementById('input-area').value;
//     const desc = document.getElementById('input-desc').value;
//     const fileInput = document.getElementById('file-input');
    
//     if (!areaId || !desc) return alert("Please fill in all fields.");
//     if (!fileInput.files[0]) return alert("Please select a photo.");

//     btn.innerHTML = `<i class="fas fa-cog fa-spin"></i> Compressing...`; 
//     btn.disabled = true;

//     try {
//         // 1. SMART COMPRESSION
//         // This handles HEIC vs JPEG and guarantees the result is under 1MB
//         const finalImageBase64 = await compressImage(fileInput.files[0]);

//         btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Uploading...`;

//         // 2. Upload to Firestore
//         await addDoc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions'), { 
//             areaId, 
//             userId: state.currentUser.uid, 
//             description: desc, 
//             image: finalImageBase64, 
//             status: 'pending', 
//             hallOfFame: false, 
//             timestamp: serverTimestamp() 
//         });

//         alert("Submitted Successfully!"); 
//         window.switchView('home');

//     } catch (e) { 
//         console.error("Submission Error:", e);
//         alert("Upload failed. Try a different photo."); 
//     } finally { 
//         btn.innerHTML = `Submit`; 
//         btn.disabled = false; 
//     }
// };

// async function compressImage(file) {
//     // A. Handle HEIC Files (iPhone)
//     if (file.type === "image/heic" || file.name.toLowerCase().endsWith('.heic')) {
//         try {
//             console.log("HEIC detected. Converting to JPEG...");
//             // Convert to JPEG Blob
//             const convertedBlob = await heic2any({
//                 blob: file,
//                 toType: "image/jpeg",
//                 quality: 0.8
//             });
//             file = convertedBlob; // Swap original file with new JPEG
//         } catch (e) {
//             console.warn("HEIC conversion failed or not needed:", e);
//         }
//     }

//     // B. Resize & Compress Loop
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
        
//         reader.onload = (event) => {
//             const img = new Image();
//             img.src = event.target.result;
            
//             img.onload = () => {
//                 const canvas = document.createElement('canvas');
//                 let width = img.width;
//                 let height = img.height;

//                 // 1. Initial Resize (Max Width 1000px)
//                 // This usually cuts size by 80% immediately
//                 const MAX_WIDTH = 1000;
//                 if (width > MAX_WIDTH) {
//                     height *= MAX_WIDTH / width;
//                     width = MAX_WIDTH;
//                 }

//                 canvas.width = width;
//                 canvas.height = height;

//                 const ctx = canvas.getContext('2d');
//                 ctx.drawImage(img, 0, 0, width, height);

//                 // 2. Quality Reduction Loop
//                 // Start at 0.7 (70%) quality
//                 let quality = 0.7;
//                 let dataUrl = canvas.toDataURL('image/jpeg', quality);

//                 // While file size is > 900KB (approx 900,000 chars in Base64), reduce quality
//                 // We use 900KB to be safe because Firestore limit is strictly 1,048,576 bytes including other fields
//                 while (dataUrl.length > 900000 && quality > 0.1) {
//                     console.log(`Image still too big (${Math.round(dataUrl.length/1024)}KB). Compressing more...`);
//                     quality -= 0.1;
//                     dataUrl = canvas.toDataURL('image/jpeg', quality);
//                 }

//                 console.log(`Final Size: ${Math.round(dataUrl.length/1024)}KB`);
//                 resolve(dataUrl);
//             };
//             img.onerror = (err) => reject(err);
//         };
//         reader.onerror = (err) => reject(err);
//     });
// }

init();