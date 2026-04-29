window.onerror = function(msg, url, lineNo, columnNo, error) {
    tg.showAlert("Ошибка JS: " + msg + "\nСтрока: " + lineNo);
    return false;
};

// --- КОНФИГУРАЦИЯ ---
const OWNER_ID = 827979452;
const API_URL = "https://old-shortly-grower.ngrok-free.dev/api"; // ОБНОВИ NGROK!
let tg = window.Telegram.WebApp;
tg.expand();

const urlParams = new URLSearchParams(window.location.search);
let userId = parseInt(urlParams.get('uid') || '0');
if (!userId && tg.initDataUnsafe?.user) userId = tg.initDataUnsafe.user.id;

let currentRole = parseInt(urlParams.get('role') || '0');
let userName = "Загрузка...";
let curImg = null;
let editingId = null;
let globalTimers = { manualSec: 0, autoSec: 0, autoActive: false };

// Хранилище для объявлений, чтобы не ломать кавычки в HTML
window.allAds = {};

// --- РЕГИСТРАЦИЯ ФУНКЦИЙ В ГЛОБАЛЬНОЙ ОБЛАСТИ ---
window.openMenu = () => { 
    document.getElementById('drawer').classList.add('active'); 
    document.getElementById('overlay').style.display='block'; 
};

window.closeMenu = () => { 
    document.getElementById('drawer').classList.remove('active'); 
    document.getElementById('overlay').style.display='none'; 
};

window.showPage = (id) => {
    window.closeMenu();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if (id === 'create' || id === 'auto') window.fetchUserStatus();
};

window.openAutoPR = () => {
    window.showPage('auto');
    const lock = document.getElementById('auto-lock');
    const content = document.getElementById('auto-content');
    if (currentRole === 0 && userId !== OWNER_ID) {
        if(lock) lock.style.display = 'block';
        if(content) content.style.display = 'none';
    } else {
        if(lock) lock.style.display = 'none';
        if(content) content.style.display = 'block';
    }
};

window.openSrv = () => {
    const modal = document.getElementById('srv-modal');
    if(modal) modal.style.display = 'block';
};

window.selectSrv = (s) => {
    const name = document.getElementById('current-srv-name');
    const modal = document.getElementById('srv-modal');
    if(name) name.innerText = s;
    if(modal) modal.style.display = 'none';
    window.loadFeed(s);
};

window.fetchUserStatus = async function() {
    if (!userId) return;
    try {
        const r = await fetch(`${API_URL}/user-status?uid=${userId}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const data = await r.json();
        
        userName = data.username || "Игрок";
        document.getElementById('user-display-name').innerText = userName;
        document.getElementById('user-initials').innerText = userName.replace('@', '').charAt(0).toUpperCase();

        currentRole = data.role;
        window.updateRoleBadge(userId, currentRole);

        globalTimers.manualSec = (userId === OWNER_ID) ? 0 : data.manual_cd;
        globalTimers.autoActive = data.auto.active;
        globalTimers.autoSec = data.auto.next_run_sec;

        if (document.getElementById('a-txt') && data.auto.text && !document.getElementById('a-txt').value) {
            document.getElementById('a-txt').value = data.auto.text;
            document.getElementById('a-int').value = data.auto.interval;
        }
    } catch(e) { console.error("Status error", e); }
};

window.loadFeed = async function(srv) {
    const feed = document.getElementById('home-feed');
    if(!feed) return;
    feed.innerHTML = '<center style="padding:40px; color:#555">Загрузка...</center>';
    try {
        const r = await fetch(`${API_URL}/ads?server=${srv}&uid=${userId}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const ads = await r.json();
        
        if (ads.error === "BANNED") { tg.showAlert("Вы заблокированы!"); tg.close(); return; }

        let htmlOutput = '';
        window.allAds = {}; // Очищаем кэш перед загрузкой

        ads.forEach(ad => {
            // Сохраняем данные в объект по ID
            window.allAds[ad.id] = ad;

            const isOwnerPost = (ad.user_id === OWNER_ID);
            const isPremiumPost = (ad.is_premium === 1 || isOwnerPost);
            const isMod = (userId === OWNER_ID || currentRole === 2 || ad.user_id == userId);
            
            let cardClass = isPremiumPost ? 'premium-ad' : '';
            let badge = isOwnerPost ? '<span class="owner-badge">👑 ОСНОВАТЕЛЬ</span>' : 
                        (isPremiumPost ? '<span style="color:#ffd700; font-size:11px; font-weight:900;">💎 PREMIUM</span>' : '');

            htmlOutput += `
            <div class="ad-card ${cardClass}" id="ad-${ad.id}">
                <div class="ad-header"><span class="status-tag">${ad.server}</span>${badge}</div>
                <div class="ad-user">👤 ${ad.username}</div>
                <div class="ad-text">${ad.text}</div>
                ${ad.photo ? `<img src="${ad.photo}" class="ad-img">` : ''}
                ${isMod ? `<div class="action-row">
                    <button class="btn-edit" onclick="window.openEdit(${ad.id})">📝 Изменить</button>
                    <button class="btn-del" onclick="window.deleteAd(${ad.id})">🗑 Удалить</button>
                </div>` : ''}
            </div>`;
        });
        feed.innerHTML = htmlOutput || '<center style="padding:40px; color:#555">Объявлений нет</center>';
    } catch (e) { feed.innerHTML = '<center style="color:red; padding:40px">Ошибка связи</center>'; }
};

window.updateRoleBadge = (uid, role) => {
    const b = document.getElementById('role-badge');
    if (!b) return;
    if (uid === OWNER_ID) { b.innerText = "Основатель"; b.style.background = "#ff0055"; }
    else if (role === 2) { b.innerText = "Админ"; b.style.background = "#00ff88"; b.style.color = "#000"; }
    else if (role === 1) { b.innerText = "Premium"; b.style.background = "#ffd700"; b.style.color = "#000"; }
    else { b.innerText = "Игрок"; b.style.background = "#251d3a"; b.style.color = "#a0a0c0"; }
};

window.submitCreate = async function() {
    if (globalTimers.manualSec > 0 && userId !== OWNER_ID) return tg.showAlert("Ожидайте КД!");
    const t = document.getElementById('f-txt').value;
    const s = document.getElementById('f-srv').value;
    if (t.length < 5) return tg.showAlert("Текст короткий!");
    
    try {
        const res = await fetch(`${API_URL}/create`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, server: s, text: t, photo: curImg, role: currentRole })
        });
        if (res.ok) { tg.showAlert("✅ Опубликовано!"); window.showPage('home'); window.loadFeed('Все'); }
        else { const d = await res.json(); tg.showAlert(d.error); }
    } catch(e) { tg.showAlert("Ошибка сервера"); }
};

window.deleteAd = (id) => {
    tg.showConfirm("Удалить это объявление?", async (confirm) => {
        if (confirm) {
            try {
                const res = await fetch(`${API_URL}/delete`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ id: id, user_id: userId, role: currentRole }) 
                });
                if (res.ok) {
                    const el = document.getElementById(`ad-${id}`);
                    if (el) el.remove();
                }
            } catch(e) { tg.showAlert("Ошибка при удалении"); }
        }
    });
};

window.openEdit = (id) => {
    const ad = window.allAds[id];
    if(!ad) return;
    editingId = id;
    document.getElementById('e-txt').value = ad.text;
    document.getElementById('e-srv').value = ad.server;
    document.getElementById('edit-modal').style.display = 'block';
};

window.closeEdit = () => { 
    document.getElementById('edit-modal').style.display = 'none'; 
};

window.saveEdit = async () => {
    const t = document.getElementById('e-txt').value;
    const s = document.getElementById('e-srv').value;
    try {
        const res = await fetch(`${API_URL}/update`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, user_id: userId, text: t, server: s, photo: curImg, role: currentRole })
        });
        if (res.ok) {
            window.closeEdit();
            window.loadFeed('Все');
            tg.showAlert("✅ Изменено!");
        }
    } catch(e) { tg.showAlert("Ошибка обновления"); }
};

window.saveAutoPR = async (active) => {
    const t = document.getElementById('a-txt').value;
    const i = parseInt(document.getElementById('a-int').value);
    if (i < 30 && userId !== OWNER_ID) return tg.showAlert("Минимум 30 мин!");
    try {
        await fetch(`${API_URL}/auto-pr/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, text: t, photo: curImg, interval: i, active: active })
        });
        tg.showAlert(active ? "🚀 Запущено!" : "⏸ Остановлено!"); window.fetchUserStatus();
    } catch(e) { tg.showAlert("Ошибка связи"); }
};

// --- ВСПОМОГАТЕЛЬНОЕ ---
const setupFile = (i, p) => {
    const el = document.getElementById(i);
    if(!el) return;
    el.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
            curImg = ev.target.result;
            const prev = document.getElementById(p);
            if(prev) {
                prev.style.backgroundImage = `url(${curImg})`;
                prev.style.backgroundSize = "contain";
                prev.innerHTML = "";
            }
        };
        r.readAsDataURL(f);
    };
};

// Инициализация
window.onload = () => {
    const srvs = ["Vice-City", "Phoenix", "Tucson", "Scottdale", "Chandler", "Brainburg", "Saint Rose", "Mesa", "Red-Rock", "Yuma", "Surprise", "Prescott", "Glendale", "Kingman", "Winslow", "Payson", "Gilbert", "Show-Low", "Casa-Grande", "Page", "Sun-City", "Queen-Creek", "Sedona", "Holiday", "Christmas", "Faraway", "Bumble Bee", "Mirage", "Love", "Drake"];
    const fSrv = document.getElementById('f-srv');
    const eSrv = document.getElementById('e-srv');
    const sGrid = document.getElementById('srv-grid');
    
    if(fSrv && eSrv && sGrid) {
        srvs.forEach(s => {
            fSrv.appendChild(new Option(s, s));
            eSrv.appendChild(new Option(s, s));
            let d = document.createElement('div'); d.className = 'srv-item'; d.innerText = s; 
            d.onclick = () => window.selectSrv(s);
            sGrid.appendChild(d);
        });
    }

    setupFile('file-input', 'photo-preview');
    setupFile('edit-file-input', 'edit-photo-preview');
    setupFile('auto-file-input', 'auto-photo-preview');

    window.fetchUserStatus();
    window.loadFeed('Все');

    setInterval(() => {
        const btn = document.getElementById('f-btn');
        const st = document.getElementById('auto-status');
        if (globalTimers.manualSec > 0) {
            globalTimers.manualSec--;
            if(btn) btn.innerText = `ОЖИДАЙТЕ (${globalTimers.manualSec}с)`;
        } else if (btn) { btn.innerText = "ОПУБЛИКОВАТЬ"; }
        
        if (globalTimers.autoActive && globalTimers.autoSec > 0) {
            globalTimers.autoSec--;
            if(st) st.innerText = `✅ ПОСТ ЧЕРЕЗ: ${globalTimers.autoSec}с`;
        }
    }, 1000);
};
