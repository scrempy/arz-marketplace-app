// Функция для вывода ошибок прямо в интерфейс Telegram
window.onerror = function(msg, url, line) {
    alert("ОШИБКА: " + msg + "\nЛиния: " + line);
    return false;
};

// --- 1. ПЕРЕМЕННЫЕ ---
const OWNER_ID = 827979452;
const API_URL = "https://old-shortly-grower.ngrok-free.dev/api"; 
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
window.allAds = {}; // Кэш для данных объявлений

// --- 2. ФУНКЦИИ (ОБЪЯВЛЕНЫ ГЛОБАЛЬНО) ---

window.openMenu = function() {
    document.getElementById('drawer').classList.add('active');
    document.getElementById('overlay').style.display = 'block';
};

window.closeMenu = function() {
    document.getElementById('drawer').classList.remove('active');
    document.getElementById('overlay').style.display = 'none';
};

window.showPage = function(id) {
    window.closeMenu();
    let pages = document.querySelectorAll('.page');
    for (let p of pages) p.classList.remove('active');
    let target = document.getElementById('page-' + id);
    if (target) target.classList.add('active');
    if (id === 'create' || id === 'auto') window.fetchUserStatus();
};

window.openAutoPR = function() {
    window.showPage('auto');
    let lock = document.getElementById('auto-lock');
    let content = document.getElementById('auto-content');
    if (currentRole === 0 && userId !== OWNER_ID) {
        if (lock) lock.style.display = 'block';
        if (content) content.style.display = 'none';
    } else {
        if (lock) lock.style.display = 'none';
        if (content) content.style.display = 'block';
    }
};

window.openSrv = function() {
    let m = document.getElementById('srv-modal');
    if (m) m.style.display = 'block';
};

window.selectSrv = function(s) {
    let n = document.getElementById('current-srv-name');
    if (n) n.innerText = s;
    let m = document.getElementById('srv-modal');
    if (m) m.style.display = 'none';
    window.loadFeed(s);
};

window.openEdit = function(id) {
    let ad = window.allAds[id];
    if (!ad) return alert("Данные не найдены");
    editingId = id;
    document.getElementById('e-txt').value = ad.text;
    document.getElementById('e-srv').value = ad.server;
    document.getElementById('edit-modal').style.display = 'block';
};

window.closeEdit = function() {
    document.getElementById('edit-modal').style.display = 'none';
};

window.saveEdit = async function() {
    let t = document.getElementById('e-txt').value;
    let s = document.getElementById('e-srv').value;
    try {
        const res = await fetch(`${API_URL}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, user_id: userId, text: t, server: s, photo: curImg, role: currentRole })
        });
        if (res.ok) {
            window.closeEdit();
            window.loadFeed('Все');
            tg.showAlert("✅ Изменено!");
        }
    } catch (e) { alert("Ошибка при сохранении"); }
};

window.deleteAd = function(id) {
    tg.showConfirm("Удалить это объявление?", async function(ok) {
        if (ok) {
            try {
                await fetch(`${API_URL}/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, user_id: userId, role: currentRole })
                });
                let el = document.getElementById(`ad-${id}`);
                if (el) el.remove();
            } catch (e) { alert("Ошибка при удалении"); }
        }
    });
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
    } catch (e) {}
};

window.updateRoleBadge = function(uid, role) {
    let b = document.getElementById('role-badge');
    if (!b) return;
    if (uid === OWNER_ID) { b.innerText = "Основатель"; b.style.background = "#ff0055"; }
    else if (role === 2) { b.innerText = "Админ"; b.style.background = "#00ff88"; b.style.color = "#000"; }
    else if (role === 1) { b.innerText = "Premium"; b.style.background = "#ffd700"; b.style.color = "#000"; }
    else { b.innerText = "Игрок"; b.style.background = "#3d3159"; }
};

window.loadFeed = async function(srv) {
    let feed = document.getElementById('home-feed');
    if (!feed) return;
    feed.innerHTML = '<center style="padding:40px; color:#555">Загрузка...</center>';
    try {
        const r = await fetch(`${API_URL}/ads?server=${srv}&uid=${userId}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const ads = await r.json();
        let htmlOutput = '';
        window.allAds = {}; 

        ads.forEach(ad => {
            window.allAds[ad.id] = ad;
            let isOwnerPost = (ad.user_id === OWNER_ID);
            let isPremiumPost = (ad.is_premium === 1 || isOwnerPost);
            let isMod = (userId === OWNER_ID || currentRole === 2 || ad.user_id == userId);
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
        feed.innerHTML = htmlOutput || '<center style="padding:40px; color:#555">Пусто</center>';
    } catch (e) { feed.innerHTML = '<center style="color:red">Ошибка загрузки</center>'; }
};

window.submitCreate = async function() {
    if (globalTimers.manualSec > 0 && userId !== OWNER_ID) return tg.showAlert("Ожидайте КД!");
    let t = document.getElementById('f-txt').value;
    let s = document.getElementById('f-srv').value;
    if (t.length < 5) return tg.showAlert("Короткий текст");
    const res = await fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, server: s, text: t, photo: curImg, role: currentRole })
    });
    if (res.ok) { tg.showAlert("✅ Опубликовано!"); window.showPage('home'); window.loadFeed('Все'); }
};

window.saveAutoPR = async function(active) {
    let t = document.getElementById('a-txt').value;
    let i = parseInt(document.getElementById('a-int').value);
    if (i < 30 && userId !== OWNER_ID) return tg.showAlert("Мин. 30 мин");
    await fetch(`${API_URL}/auto-pr/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, text: t, photo: curImg, interval: i, active: active })
    });
    tg.showAlert("Готово!"); window.fetchUserStatus();
};

// --- 3. ИНИЦИАЛИЗАЦИЯ (ВЫПОЛНЯЕТСЯ ПРИ ЗАГРУЗКЕ) ---

window.onload = function() {
    const srvs = ["Vice-City", "Phoenix", "Tucson", "Scottdale", "Chandler", "Brainburg", "Saint Rose", "Mesa", "Red-Rock", "Yuma", "Surprise", "Prescott", "Glendale", "Kingman", "Winslow", "Payson", "Gilbert", "Show-Low", "Casa-Grande", "Page", "Sun-City", "Queen-Creek", "Sedona", "Holiday", "Christmas", "Faraway", "Bumble Bee", "Mirage", "Love", "Drake"];
    let fSrv = document.getElementById('f-srv');
    let eSrv = document.getElementById('e-srv');
    let sGrid = document.getElementById('srv-grid');

    if (fSrv && eSrv && sGrid) {
        srvs.forEach(s => {
            fSrv.appendChild(new Option(s, s));
            eSrv.appendChild(new Option(s, s));
            let d = document.createElement('div');
            d.className = 'srv-item';
            d.innerText = s;
            d.onclick = function() { window.selectSrv(s); };
            sGrid.appendChild(d);
        });
    }

    const setup = (i, p) => {
        let el = document.getElementById(i);
        if (el) el.onchange = (e) => {
            let f = e.target.files[0];
            if (!f) return;
            let r = new FileReader();
            r.onload = (ev) => {
                curImg = ev.target.result;
                let prev = document.getElementById(p);
                if (prev) { prev.style.backgroundImage = `url(${curImg})`; prev.style.backgroundSize = "contain"; prev.innerHTML = ""; }
            };
            r.readAsDataURL(f);
        };
    };
    setup('file-input', 'photo-preview');
    setup('edit-file-input', 'edit-photo-preview');
    setup('auto-file-input', 'auto-photo-preview');

    window.fetchUserStatus();
    window.loadFeed('Все');

    setInterval(() => {
        let b = document.getElementById('f-btn');
        if (globalTimers.manualSec > 0) {
            globalTimers.manualSec--;
            if (b) b.innerText = `ОЖИДАЙТЕ (${globalTimers.manualSec}с)`;
        } else if (b) { b.innerText = "ОПУБЛИКОВАТЬ"; }
    }, 1000);
};
