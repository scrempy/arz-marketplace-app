// 1. Отлов ошибок
window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert("Ошибка JS: " + msg + " (Строка: " + lineNo + ")");
    return false;
};

// Константы
const OWNER_ID = 827979452;
const API_URL = "https://old-shortly-grower.ngrok-free.dev/api"; // ТВОЙ АКТУАЛЬНЫЙ NGROK
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

// 2. Объявление функций (прикрепляем к window, чтобы работали из HTML)
window.openMenu = () => { document.getElementById('drawer').classList.add('active'); document.getElementById('overlay').style.display='block'; };
window.closeMenu = () => { document.getElementById('drawer').classList.remove('active'); document.getElementById('overlay').style.display='none'; };

window.showPage = (id) => {
    closeMenu();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if (id === 'create') fetchUserStatus();
};

window.openSrv = () => document.getElementById('srv-modal').style.display = 'block';

window.selectSrv = (s) => {
    document.getElementById('current-srv-name').innerText = s;
    document.getElementById('srv-modal').style.display = 'none';
    loadFeed(s);
};

window.fetchUserStatus = async function() {
    if (!userId) return;
    try {
        const r = await fetch(`${API_URL}/user-status?uid=${userId}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const data = await r.json();
        
        // Синхронизация имени
        userName = data.username;
        document.getElementById('user-display-name').innerText = userName;

        // Синхронизация роли и бейджика
        currentRole = data.role;
        updateRoleBadge(userId, currentRole);

        // Таймеры
        globalTimers.manualSec = (userId === OWNER_ID) ? 0 : data.manual_cd;
        globalTimers.autoActive = data.auto.active;
        globalTimers.autoSec = data.auto.next_run_sec;

        if (document.getElementById('a-txt') && data.auto.text && !document.getElementById('a-txt').value) {
            document.getElementById('a-txt').value = data.auto.text;
            document.getElementById('a-int').value = data.auto.interval;
        }
        document.getElementById('auto-status').innerText = data.auto.active ? "✅ ВКЛЮЧЕН" : "⏸ ВЫКЛЮЧЕН";
    } catch (e) {}
};

window.loadFeed = async function(srv) {
    const feed = document.getElementById('home-feed');
    feed.innerHTML = '<center style="margin-top:20px">Загрузка...</center>';
    try {
        const r = await fetch(`${API_URL}/ads?server=${srv}&uid=${userId}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const ads = await r.json();
        if (ads.error === "BANNED") { tg.showAlert("Вы заблокированы!"); tg.close(); return; }

        let htmlOutput = '';
        ads.forEach(ad => {
            const isOwnerPost = (ad.user_id === OWNER_ID);
            const isPremiumPost = (ad.is_premium === 1 || isOwnerPost);
            const isMod = (userId === OWNER_ID || currentRole === 2 || ad.user_id == userId);
            
            let cardClass = isPremiumPost ? 'premium-ad' : '';
            let badge = isOwnerPost ? '<span class="owner-badge">👑 ОСНОВАТЕЛЬ</span>' : 
                        (isPremiumPost ? '<span style="color:var(--prem); font-size:11px; font-weight:bold;">💎 PREMIUM</span>' : '');

            htmlOutput += `
            <div class="ad-card ${cardClass}" id="ad-${ad.id}">
                <div class="ad-header"><span class="status-tag">${ad.server}</span>${badge}</div>
                <div class="ad-user">👤 ${ad.username}</div>
                <div class="ad-text">${ad.text}</div>
                ${ad.photo ? `<img src="${ad.photo}" class="ad-img">` : ''}
                ${isMod ? `<div class="action-row">
                    <button class="btn-edit" onclick='openEdit(${JSON.stringify(ad).replace(/'/g, "&apos;")})'>📝 Изменить</button>
                    <button class="btn-del" onclick="deleteAd(${ad.id})">🗑 Удалить</button>
                </div>` : ''}
            </div>`;
        });
        feed.innerHTML = htmlOutput || '<center style="margin-top:20px">📭 Пусто</center>';
    } catch (e) { feed.innerHTML = '<center style="color:red">Ошибка связи</center>'; }
};

window.updateRoleBadge = (uid, role) => {
    const b = document.getElementById('role-badge');
    if (!b) return;
    if (uid === OWNER_ID) { b.innerText = "Основатель"; b.style.background = "#ff0055"; }
    else if (role === 2) { b.innerText = "Админ"; b.style.background = "#00ff88"; }
    else if (role === 1) { b.innerText = "Premium"; b.style.background = "#ffd700"; }
    else { b.innerText = "Игрок"; b.style.background = "var(--primary)"; }
};

window.submitCreate = async function() {
    if (globalTimers.manualSec > 0 && userId !== OWNER_ID) return tg.showAlert("Подождите КД!");
    const t = document.getElementById('f-txt').value;
    if (t.length < 5) return tg.showAlert("Опишите товар!");
    const res = await fetch(`${API_URL}/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, server: document.getElementById('f-srv').value, text: t, photo: curImg, role: currentRole })
    });
    if (res.ok) { tg.showAlert("Опубликовано!"); showPage('home'); loadFeed('Все'); }
};

window.deleteAd = (id) => {
    tg.showConfirm("Удалить?", async (c) => {
        if (c) {
            await fetch(`${API_URL}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, user_id: userId, role: currentRole }) });
            document.getElementById(`ad-${id}`).remove();
        }
    });
};

window.openEdit = (ad) => {
    editingId = ad.id; document.getElementById('e-txt').value = ad.text;
    document.getElementById('e-srv').value = ad.server;
    document.getElementById('edit-modal').style.display = 'block';
};
window.closeEdit = () => { document.getElementById('edit-modal').style.display = 'none'; };

document.getElementById('e-save-btn').onclick = async () => {
    await fetch(`${API_URL}/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, user_id: userId, text: document.getElementById('e-txt').value, server: document.getElementById('e-srv').value, photo: curImg, role: currentRole })
    });
    closeEdit(); loadFeed('Все');
};

window.openAutoPR = () => {
    showPage('auto');
    if (currentRole === 0 && userId !== OWNER_ID) { document.getElementById('auto-lock').style.display = 'block'; return; }
    document.getElementById('auto-content').style.display = 'block';
    fetchUserStatus();
};

window.saveAutoPR = async (active) => {
    const i = parseInt(document.getElementById('a-int').value);
    if (i < 30 && userId !== OWNER_ID) return tg.showAlert("Мин. интервал 30 мин!");
    await fetch(`${API_URL}/auto-pr/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, text: document.getElementById('a-txt').value, photo: curImg, interval: i, active: active })
    });
    tg.showAlert("Выполнено!"); fetchUserStatus();
};

// 3. Запуск
const srvs = ["Vice-City", "Phoenix", "Tucson", "Scottdale", "Chandler", "Brainburg", "Saint Rose", "Mesa", "Red-Rock", "Yuma", "Surprise", "Prescott", "Glendale", "Kingman", "Winslow", "Payson", "Gilbert", "Show-Low", "Casa-Grande", "Page", "Sun-City", "Queen-Creek", "Sedona", "Holiday", "Christmas", "Faraway", "Bumble Bee", "Mirage", "Love", "Drake"];
srvs.forEach(s => {
    document.getElementById('f-srv').appendChild(new Option(s, s));
    document.getElementById('e-srv').appendChild(new Option(s, s));
    let d = document.createElement('div'); d.className = 'srv-item'; d.innerText = s; d.onclick = () => selectSrv(s);
    document.getElementById('srv-grid').appendChild(d);
});

const setupFile = (i, p) => {
    document.getElementById(i).onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader(); r.onload = (ev) => {
            curImg = ev.target.result; document.getElementById(p).style.backgroundImage = `url(${curImg})`;
        }; r.readAsDataURL(f);
    };
};
setupFile('file-input', 'photo-preview');
setupFile('edit-file-input', 'edit-photo-preview');
setupFile('auto-file-input', 'auto-photo-preview');

setInterval(() => {
    if (globalTimers.manualSec > 0) {
        globalTimers.manualSec--;
        document.getElementById('f-btn').innerText = `ОЖИДАЙТЕ (${globalTimers.manualSec}с)`;
        document.getElementById('f-btn').disabled = true;
    } else {
        document.getElementById('f-btn').innerText = "ОПУБЛИКОВАТЬ";
        document.getElementById('f-btn').disabled = false;
    }
    if (globalTimers.autoActive && globalTimers.autoSec > 0) {
        globalTimers.autoSec--;
        document.getElementById('auto-status').innerText = `✅ ВКЛЮЧЕН (Пост через: ${globalTimers.autoSec}с)`;
    }
}, 1000);

// Инициализация при старте
window.fetchUserStatus();
window.loadFeed('Все');
