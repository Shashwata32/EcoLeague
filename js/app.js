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

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, increment, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- SECTION 1: CONFIGURATION ---
// 🔴 ACTION REQUIRED: PASTE YOUR FIREBASE KEYS HERE
const firebaseConfig = {
    apiKey: "AIzaSyACJNaRSI4h5FeNySneMJxUh-cjkehcTqk",
    authDomain: "ecoleague-fcf32.firebaseapp.com",
    projectId: "ecoleague-fcf32",
    storageBucket: "ecoleague-fcf32.firebasestorage.app",
    messagingSenderId: "740456061890",
    appId: "1:740456061890:web:357d89fa4559eae3f8145b",
    measurementId: "G-3YL5M07LXD"
};

// --- SECTION 2: INITIALIZATION ---
let app, auth, db;
const APP_COLLECTION_ID = 'eco-league-v2';

try {
    // Handle environment injection for previews, fallback to local config
    const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Initialization Failed:", e);
    // We don't alert here to avoid spamming the user if keys are just missing
}

// --- SECTION 3: STATE MANAGEMENT ---
// Single source of truth for the application state
let state = {
    currentUser: null,
    areas: [],
    submissions: [],    // Required for Admin Charts
    wallOfFame: [],     // Filtered list for Home Screen
    pastWinners: [],    // Required for History Tab
    isAdminLoggedIn: false,
    timerInterval: null // Reference to clear timer on page changes
};

// --- SECTION 4: DOM ELEMENTS ---
// Cached references to avoid repeated DOM queries
const elements = {
    loginScreen: document.getElementById('login-screen'),
    mainScreen: document.getElementById('main-screen'),
    contentArea: document.getElementById('content-area'),
    navBar: document.querySelector('nav'),
    navLinks: document.querySelectorAll('.nav-link'),
};

// --- SECTION 5: ENTRY POINT ---
function init() {
    if (!auth) return;
    
    // Listen for Authentication Status
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User connected:", user.uid);
            state.currentUser = user;
            
            // Transition UI
            elements.loginScreen.classList.add('hidden');
            elements.mainScreen.classList.remove('hidden');
            
            // Start App Systems
            startDataListeners();
            startCountdownTicker(); 
            
            // Default View
            window.switchView('home');
        } else {
            // Auto-login anonymously
            signInAnonymously(auth).catch(error => {
                console.error("Auth Error:", error);
                alert("Connection failed. Please refresh.");
            });
        }
    });
}

// --- SECTION 6: REAL-TIME DATA LAYER ---
function startDataListeners() {
    // Listener 1: Areas (The Leaderboard)
    onSnapshot(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas'), (snap) => {
        state.areas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort: Highest score first
        state.areas.sort((a, b) => b.score - a.score);
        
        // Safety: Seed data if DB is empty
        if (snap.empty && !snap.metadata.fromCache) seedInitialData();
        
        refreshCurrentView();
    });

    // Listener 2: Submissions (Feed & Charts)
    onSnapshot(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions'), (snap) => {
        state.submissions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter Wall of Fame items
        state.wallOfFame = state.submissions.filter(sub => sub.hallOfFame === true);
        
        refreshCurrentView();
    });

    // Listener 3: History (Past Winners)
    onSnapshot(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'history'), (snap) => {
        state.pastWinners = snap.docs.map(doc => doc.data());
        // Sort: Newest winners first
        state.pastWinners.sort((a,b) => (b.monthTimestamp?.seconds || 0) - (a.monthTimestamp?.seconds || 0));
        
        refreshCurrentView();
    });
}

async function seedInitialData() {
    console.log("Seeding initial database structure...");
    const ref = collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas');
    const areas = [
        { name: 'Green Valley', score: 0, badge: 'Contender' },
        { name: 'Sunrise Apts', score: 0, badge: 'Contender' }
    ];
    // Use Promise.all for concurrent writes
    await Promise.all(areas.map(a => addDoc(ref, a)));
}

// --- SECTION 7: NAVIGATION & ROUTING ---
window.switchView = (viewName) => {
    // Guard: Admin Mode restrictions
    if (state.isAdminLoggedIn) {
        if(elements.navBar) elements.navBar.classList.add('hidden'); // Admins don't need user nav
        if(viewName === 'upload') return; // Admins don't upload
    } else {
        if(elements.navBar) elements.navBar.classList.remove('hidden');
    }

    // UI: Update Active Tab State
    elements.navLinks.forEach(l => {
        l.classList.remove('text-green-600', 'border-t-2', 'border-green-600');
        l.classList.add('text-gray-400');
    });

    const activeBtn = document.getElementById(`nav-${viewName}`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-green-600', 'border-t-2', 'border-green-600');
    }

    // Routing: Render the requested view
    if (viewName === 'home') renderHome();
    if (viewName === 'upload') renderUpload();
    if (viewName === 'prizes') renderPrizes();
    if (viewName === 'admin') {
        if(state.isAdminLoggedIn) renderAdminDashboard();
        else renderAdminLogin();
    }
};

function refreshCurrentView() {
    // Helper to redraw the screen when data updates in the background
    if(document.getElementById('leaderboard-container')) renderHome();
    if(document.getElementById('admin-dashboard-container')) renderAdminDashboard();
    if(document.getElementById('prizes-container')) renderPrizes();
}

// --- SECTION 8: TIMER LOGIC ---
function startCountdownTicker() {
    if(state.timerInterval) clearInterval(state.timerInterval);
    // Update every second
    state.timerInterval = setInterval(() => {
        const el = document.getElementById('countdown-timer');
        if(el) el.innerHTML = getRemainingTimeHTML();
    }, 1000);
}

function getRemainingTimeHTML() {
    const now = new Date();
    // Logic: Countdown to the end of the current month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const diff = endOfMonth - now;

    if (diff <= 0) return `<span class="text-yellow-200 font-bold tracking-widest animate-pulse">CALCULATING RESULTS...</span>`;

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    // High-Fidelity Timer UI with glassmorphism boxes
    return `
        <div class="flex items-center gap-3 text-center text-white">
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm">
                <span class="text-xl font-bold font-fredoka block leading-none">${d}</span>
                <span class="text-[8px] font-bold uppercase opacity-70 tracking-wider">Days</span>
            </div>
            <span class="text-xl font-bold opacity-50">:</span>
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm">
                <span class="text-xl font-bold font-fredoka block leading-none">${h}</span>
                <span class="text-[8px] font-bold uppercase opacity-70 tracking-wider">Hrs</span>
            </div>
            <span class="text-xl font-bold opacity-50">:</span>
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm">
                <span class="text-xl font-bold font-fredoka block leading-none">${m}</span>
                <span class="text-[8px] font-bold uppercase opacity-70 tracking-wider">Min</span>
            </div>
            <span class="text-xl font-bold opacity-50">:</span>
            <div class="bg-black/20 backdrop-blur-sm rounded-lg p-2 min-w-[40px] border border-white/10 shadow-sm">
                <span class="text-xl font-bold font-fredoka block leading-none">${s}</span>
                <span class="text-[8px] font-bold uppercase opacity-70 tracking-wider">Sec</span>
            </div>
        </div>
    `;
}

// --- SECTION 9: PUBLIC VIEWS (Home, Upload, Prizes) ---

function renderHome() {
    const timerHTML = getRemainingTimeHTML();
    
    // Header for the list
    let html = `
        <div id="leaderboard-container" class="animate-fade-in p-5 space-y-8 pb-24">
            <!-- Hero Card -->
            <div class="bg-gradient-to-br from-green-600 to-emerald-800 rounded-3xl p-6 text-white shadow-xl shadow-green-200 relative overflow-hidden">
                <div class="relative z-10">
                    <h2 class="text-xs font-bold uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">
                        <i class="fas fa-flag-checkered"></i> Race to the finish
                    </h2>
                    <div id="countdown-timer" class="flex justify-start">${timerHTML}</div>
                </div>
                <i class="fas fa-leaf absolute -bottom-6 -right-6 text-9xl text-white opacity-10 transform rotate-12"></i>
                <div class="absolute top-0 left-0 w-full h-full bg-white opacity-5"></div>
            </div>

            <!-- Wall of Fame Section -->
            ${state.wallOfFame.length > 0 ? `
                <div class="space-y-3">
                    <div class="flex justify-between items-end px-1">
                        <h3 class="font-bold text-gray-800 flex items-center gap-2">
                            <i class="fas fa-star text-yellow-400 drop-shadow-sm"></i> Wall of Fame
                        </h3>
                        <span class="text-[10px] uppercase tracking-wider font-bold text-gray-400">Verified</span>
                    </div>
                    <div class="flex gap-4 overflow-x-auto pb-6 snap-x px-1 -mx-1" style="scrollbar-width: none;">
                        ${state.wallOfFame.map(item => `
                            <div class="snap-start shrink-0 w-48 relative group transition-transform hover:scale-95">
                                <div class="w-48 h-56 rounded-2xl overflow-hidden shadow-lg border-2 border-white relative">
                                    <img src="${item.image}" class="w-full h-full object-cover">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                    <div class="absolute bottom-0 left-0 p-3 w-full">
                                        <p class="text-white text-xs font-bold truncate">
                                            ${state.areas.find(a=>a.id===item.areaId)?.name || 'Community'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Live Rankings List -->
            <div class="space-y-4">
                <div class="flex justify-between items-end px-1">
                    <h3 class="font-bold text-gray-800">Live Rankings</h3>
                    <span class="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full animate-pulse">● Live</span>
                </div>
    `;

    // Render Rows
    state.areas.forEach((area, index) => {
        let rankStyles = "bg-white border border-gray-100";
        let icon = `<span class="text-gray-400 font-bold text-lg w-8 text-center">#${index+1}</span>`;
        let scoreColor = "text-gray-800";
        
        // Highlight Top 3
        if(index === 0) {
            rankStyles = "bg-gradient-to-r from-yellow-50 to-orange-50 border-orange-100 ring-2 ring-orange-100 ring-offset-2";
            icon = `<div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-sm"><i class="fas fa-trophy"></i></div>`;
            scoreColor = "text-yellow-700";
        } else if (index === 1) {
            icon = `<div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><i class="fas fa-medal"></i></div>`;
        } else if (index === 2) {
            icon = `<div class="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-amber-700"><i class="fas fa-medal"></i></div>`;
        }

        html += `
            <div class="${rankStyles} rounded-2xl p-4 shadow-sm flex items-center justify-between transform transition hover:scale-[1.02]">
                <div class="flex items-center gap-4">
                    ${icon}
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">${area.name}</h3>
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-white/50 border border-gray-100 text-gray-500 font-medium">${area.badge || 'Contender'}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-black ${scoreColor} font-fredoka">${area.score}</div>
                    <div class="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Points</div>
                </div>
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
                <!-- Area Selector -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Area</label>
                    <div class="relative">
                        <select id="input-area" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl appearance-none font-medium text-gray-700 outline-none">
                            ${options}
                        </select>
                        <i class="fas fa-chevron-down absolute right-4 top-4 text-gray-400 pointer-events-none"></i>
                    </div>
                </div>

                <!-- Drop Zone Upload -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Evidence</label>
                    <div id="drop-zone" onclick="document.getElementById('file-input').click()" class="border-2 border-dashed border-gray-300 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-green-400 transition-all group overflow-hidden relative">
                        <input type="file" id="file-input" accept="image/*" class="hidden" onchange="window.previewImage(this)">
                        
                        <!-- Initial Placeholder -->
                        <div id="upload-placeholder" class="text-center p-4">
                            <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-100 transition-colors">
                                <i class="fas fa-camera text-xl text-gray-400 group-hover:text-green-600"></i>
                            </div>
                            <p class="text-sm font-bold text-gray-600">Tap to upload photo</p>
                            <p class="text-xs text-gray-400 mt-1">Max 1MB</p>
                        </div>

                        <!-- Image Preview -->
                        <div id="preview-container" class="hidden w-full h-full relative">
                            <img id="preview-img" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span class="text-white text-xs font-bold border border-white px-3 py-1 rounded-full backdrop-blur-md">Change</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Description -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                    <textarea id="input-desc" rows="3" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 outline-none" placeholder="We cleaned the park..."></textarea>
                </div>

                <button onclick="window.submitReport()" id="btn-submit" class="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                    <span>Submit</span><i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
}

function renderPrizes() {
    let historyHtml = '';
    
    // Logic: If past winners exist, show Hall of Fame
    if (state.pastWinners.length > 0) {
        historyHtml = `
            <div class="mt-8 border-t border-gray-200 pt-8">
                <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <i class="fas fa-history text-gray-400"></i> Hall of Fame
                </h3>
                <div class="space-y-3">
        `;
        state.pastWinners.forEach(winner => {
            historyHtml += `
                <div class="bg-gray-800 text-white rounded-xl p-4 flex justify-between items-center shadow-lg border border-gray-700 relative overflow-hidden">
                    <div class="flex items-center gap-4 relative z-10">
                        <div class="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black">
                            <i class="fas fa-crown"></i>
                        </div>
                        <div>
                            <div class="font-bold text-sm text-yellow-100">${winner.winnerName}</div>
                            <div class="text-[10px] text-gray-400 uppercase tracking-wide font-medium">${winner.monthName}</div>
                        </div>
                    </div>
                    <div class="font-fredoka text-xl text-green-400 relative z-10">${winner.finalScore} pts</div>
                </div>`;
        });
        historyHtml += `</div></div>`;
    } else {
        // Empty state for history
        historyHtml = `
            <div class="mt-8 pt-6 border-t border-dashed border-gray-300 text-center">
                <p class="text-gray-400 text-xs italic">Past winners will appear here after the month ends.</p>
            </div>`;
    }

    elements.contentArea.innerHTML = `
        <div id="prizes-container" class="animate-fade-in p-5 pb-24">
            <div class="text-center mb-8 mt-2">
                <span class="text-green-600 text-xs font-bold uppercase tracking-widest bg-green-100 px-3 py-1 rounded-full">Rewards Program</span>
                <h2 class="text-3xl font-bold font-fredoka text-gray-800 mt-3">Monthly Prizes</h2>
                <p class="text-gray-500 text-sm mt-1">Motivating the community to do better.</p>
            </div>
            
            <div class="grid grid-cols-1 gap-4">
                <!-- Prize 1 -->
                <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div class="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-yellow-100">
                        <i class="fas fa-trophy text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-lg">Golden Broom</h3>
                        <p class="text-sm text-gray-500">Championship Trophy</p>
                    </div>
                </div>
                <!-- Prize 2 -->
                <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div class="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100">
                        <i class="fas fa-tree text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-lg">Green Upgrade</h3>
                        <p class="text-sm text-gray-500">50 Tree Saplings</p>
                    </div>
                </div>
            </div>
            
            ${historyHtml}
        </div>
    `;
}

// --- SECTION 10: ADMIN FEATURES ---

function renderAdminLogin() {
    elements.contentArea.innerHTML = `
        <div class="animate-fade-in p-8 flex flex-col justify-center min-h-[80vh]">
            <div class="text-center mb-10">
                <h2 class="text-3xl font-bold font-fredoka text-gray-900">Admin Analytics</h2>
                <p class="text-gray-500">Restricted Access</p>
            </div>
            <div class="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-5">
                <input type="text" id="admin-id" class="w-full p-4 bg-gray-50 rounded-xl outline-none border border-transparent focus:border-gray-300 transition" placeholder="Admin ID">
                <input type="password" id="admin-pass" class="w-full p-4 bg-gray-50 rounded-xl outline-none border border-transparent focus:border-gray-300 transition" placeholder="Password">
                <button onclick="window.attemptAdminLogin()" class="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg">Access Dashboard</button>
            </div>
            <button onclick="window.switchView('home')" class="mt-8 text-gray-400 text-sm w-full hover:text-gray-600">Back to Public App</button>
        </div>
    `;
}

window.attemptAdminLogin = () => {
    const id = document.getElementById('admin-id').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    
    // Authentication Logic (Case Insensitive for ID)
    if (id.toLowerCase() === 'admin' && pass === 'TeamZyrox') {
        state.isAdminLoggedIn = true;
        window.switchView('admin');
    } else {
        alert("Access Denied.\nID: Admin\nPass: TeamZyrox");
    }
};

window.logoutAdmin = () => {
    state.isAdminLoggedIn = false;
    window.switchView('home');
};

function renderAdminDashboard() {
    elements.contentArea.innerHTML = `
        <div id="admin-dashboard-container" class="animate-fade-in p-5 pb-24">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h2 class="text-2xl font-bold font-fredoka text-gray-900">Dashboard</h2>
                    <p class="text-xs text-gray-500 font-medium">Team Zyrox</p>
                </div>
                <button onclick="window.logoutAdmin()" class="text-red-500 text-sm font-bold bg-red-50 px-3 py-1 rounded-lg">Logout</button>
            </div>

            <!-- 1. ZONE MANAGEMENT (CRUD) -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <h3 class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                    <i class="fas fa-map-signs text-blue-500"></i> Manage Zones
                </h3>
                
                <div class="flex gap-2 mb-4">
                    <input type="text" id="new-area-name" placeholder="New Area Name" class="flex-1 bg-gray-50 px-4 py-2 rounded-lg text-sm border border-gray-200 outline-none">
                    <button onclick="window.createArea()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><i class="fas fa-plus"></i> Add</button>
                </div>

                <div class="space-y-2 max-h-40 overflow-y-auto">
                    ${state.areas.map(area => `
                        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <span class="text-sm font-medium text-gray-700">${area.name}</span>
                            <div class="flex gap-1">
                                <button onclick="window.renameArea('${area.id}', '${area.name}')" class="text-blue-400 hover:text-blue-600 p-1"><i class="fas fa-pen"></i></button>
                                <button onclick="window.deleteArea('${area.id}')" class="text-red-400 hover:text-red-600 p-1"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 2. WALL OF FAME MANAGEMENT -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <h3 class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                    <i class="fas fa-star text-yellow-500"></i> Manage Wall of Fame
                </h3>
                ${state.wallOfFame.length === 0 ? '<p class="text-xs text-gray-400 italic">No active items.</p>' : ''}
                <div class="flex gap-2 overflow-x-auto pb-2">
                    ${state.wallOfFame.map(item => `
                        <div class="shrink-0 w-24 relative group">
                            <img src="${item.image}" class="w-24 h-24 object-cover rounded-lg border border-gray-100">
                            <button onclick="window.removeFromWall('${item.id}')" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shadow-md"><i class="fas fa-times"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 3. ACTIONS & ANALYTICS -->
            <div class="mb-8">
                <button onclick="window.announceWinners()" class="w-full bg-yellow-100 text-yellow-900 p-4 rounded-xl text-left hover:scale-[1.01] transition border border-yellow-200 flex justify-between items-center">
                    <div>
                        <span class="text-xs font-bold uppercase block opacity-70">End of Month Protocol</span>
                        <span class="font-bold text-lg">Announce Winner & Reset</span>
                    </div>
                    <i class="fas fa-trophy text-2xl"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-8">
                 <div class="bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div class="relative h-32 w-full"><canvas id="participationChart"></canvas></div></div>
                 <div class="bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div class="relative h-32 w-full"><canvas id="scoreChart"></canvas></div></div>
            </div>

            <!-- 4. PENDING INSPECTIONS -->
            <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <i class="fas fa-clipboard-check text-green-600"></i> Pending Inspections
            </h3>
            <div id="submissions-list" class="space-y-4"></div>
        </div>
    `;

    // Render Charts after DOM injection
    setTimeout(renderCharts, 100);
    loadSubmissionsForAdmin();
}

// Chart.js Rendering Logic
function renderCharts() {
    const ctx1 = document.getElementById('participationChart');
    const ctx2 = document.getElementById('scoreChart');
    if(!ctx1 || !ctx2) return;

    // Aggregate Data
    const areaCounts = {};
    state.areas.forEach(a => areaCounts[a.name] = 0);
    state.submissions.forEach(sub => {
        const area = state.areas.find(a => a.id === sub.areaId);
        if(area) areaCounts[area.name]++;
    });

    // Chart 1: Participation (Doughnut)
    new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(areaCounts),
            datasets: [{
                data: Object.values(areaCounts),
                backgroundColor: ['#16a34a', '#ca8a04', '#2563eb', '#9333ea'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Chart 2: Scores (Bar)
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: state.areas.map(a => a.name.split(' ')[0]),
            datasets: [{
                label: 'Pts',
                data: state.areas.map(a => a.score),
                backgroundColor: '#16a34a',
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, display: false }, x: { display: false } }
        }
    });
}

// --- SECTION 11: LOGIC HANDLERS (CRUD & Actions) ---

// 1. Load Admin List
function loadSubmissionsForAdmin() {
    const list = document.getElementById('submissions-list');
    if(!list) return;
    const pendingDocs = state.submissions.filter(doc => doc.status === 'pending');
    
    if (pendingDocs.length === 0) {
        list.innerHTML = `<div class="bg-gray-50 rounded-xl p-8 text-center"><p class="text-gray-400 text-sm">All caught up!</p></div>`;
        return;
    }

    list.innerHTML = pendingDocs.map(sub => `
        <div class="bg-white rounded-2xl shadow-sm p-4 border border-gray-200">
            <div class="flex justify-between items-center mb-2">
                <span class="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded uppercase">${state.areas.find(a => a.id === sub.areaId)?.name || 'Unknown'}</span>
            </div>
            ${sub.image ? `<img src="${sub.image}" class="w-full h-40 object-cover rounded-xl mb-3 bg-gray-50 shadow-sm" />` : ''}
            <p class="text-gray-800 text-sm font-medium mb-3">"${sub.description}"</p>
            <div class="flex gap-2">
                <button onclick="window.gradeSubmission('${sub.id}', '${sub.areaId}', 5)" class="flex-1 bg-white border border-gray-200 text-green-600 py-2 rounded-lg text-xs font-bold">Accept (+5)</button>
                <button onclick="window.gradeSubmission('${sub.id}', '${sub.areaId}', 10, true)" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold">Fame (+10)</button>
                <button onclick="window.rejectSubmission('${sub.id}')" class="px-3 text-red-400 hover:bg-red-50 rounded-lg"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `).join('');
}

// 2. Create Area
window.createArea = async () => {
    const nameInput = document.getElementById('new-area-name');
    const name = nameInput.value.trim();
    if(!name) return alert("Enter a name!");
    try {
        await addDoc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas'), {
            name: name, score: 0, badge: 'Contender'
        });
        nameInput.value = '';
    } catch(e) { console.error(e); alert("Error adding area"); }
};

// 3. Delete Area
window.deleteArea = async (id) => {
    if(!confirm("Delete this area? This cannot be undone.")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', id));
    } catch(e) { console.error(e); alert("Error deleting area"); }
};

// 4. Rename Area
window.renameArea = async (id, oldName) => {
    const newName = prompt("Enter new name:", oldName);
    if(newName && newName !== oldName) {
        try {
            await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', id), { name: newName });
        } catch(e) { console.error(e); alert("Error renaming"); }
    }
};

// 5. Moderation
window.removeFromWall = async (id) => {
    if(!confirm("Remove from Wall of Fame? (Score remains)")) return;
    try {
        await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', id), { hallOfFame: false });
    } catch(e) { console.error(e); alert("Error updating"); }
};

// 6. End of Month Protocol
window.announceWinners = async () => {
    if(!confirm("⚠️ END MONTH: Declare Winner, Archive, and RESET scores to 0?")) return;
    if(state.areas.length === 0) return;
    const winner = state.areas[0];
    const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    try {
        const batch = writeBatch(db);
        // Archive
        batch.set(doc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'history')), { winnerName: winner.name, finalScore: winner.score, monthName: monthName, monthTimestamp: serverTimestamp() });
        // Reset
        state.areas.forEach(area => batch.update(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', area.id), { score: 0, badge: 'Contender' }));
        await batch.commit();
        alert(`🏆 ${winner.name} declared Winner! Scores reset.`);
    } catch(e) { console.error(e); }
};

// 7. Grading
window.gradeSubmission = async (subId, areaId, points, fame = false) => {
    try { 
        // FIX: Update Score FIRST, then status. Prevents race condition where report disappears from list before score updates.
        await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'areas', areaId), { score: increment(Number(points)) }); 
        await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', subId), { status: 'approved', pointsAwarded: points, hallOfFame: fame }); 
    } catch (e) { 
        console.error("Error grading:", e); 
        alert("Failed to update score. Check console.");
    }
};

window.rejectSubmission = async (subId) => {
     if(!confirm("Reject?")) return;
     await updateDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions', subId), { status: 'rejected' });
};

// 8. Image Handling
window.previewImage = (input) => {
    const file = input.files[0];
    if (file) {
        if(file.size > 1000000) return alert("Image too large (Max 1MB)");
        const reader = new FileReader();
        reader.onload = (e) => { document.getElementById('preview-img').src = e.target.result; document.getElementById('preview-container').classList.remove('hidden'); document.getElementById('upload-placeholder').classList.add('hidden'); };
        reader.readAsDataURL(file);
    }
};

window.submitReport = async () => {
    const btn = document.getElementById('btn-submit');
    const areaId = document.getElementById('input-area').value;
    const desc = document.getElementById('input-desc').value;
    const fileInput = document.getElementById('file-input');
    if (!areaId || !desc) return alert("Missing fields.");
    
    // UI Feedback
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;
    btn.disabled = true;

    try {
        let imageData = null;
        if(fileInput.files[0]) imageData = await new Promise(resolve => { const r = new FileReader(); r.onload = (e) => resolve(e.target.result); r.readAsDataURL(fileInput.files[0]); });
        
        await addDoc(collection(db, 'artifacts', APP_COLLECTION_ID, 'public', 'data', 'submissions'), { areaId, userId: state.currentUser.uid, description: desc, image: imageData, status: 'pending', hallOfFame: false, timestamp: serverTimestamp() });
        
        alert("Submitted!"); 
        window.switchView('home');
    } catch (e) {
        console.error(e);
        alert("Upload failed.");
    } finally {
        // Reset Button safely even if we changed view
        if(btn) {
            btn.innerHTML = `Submit`; 
            btn.disabled = false;
        }
    }
};

// --- SECTION 12: BOOTSTRAP ---
init();