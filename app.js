let tg = window.Telegram.WebApp; 
tg.expand();

const urlParams = new URLSearchParams(window.location.search);
const role = parseInt(urlParams.get('role') || '0');

// СТРОГАЯ ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ИЗ TELEGRAM
const user = tg.initDataUnsafe?.user;
const userId = user?.id || null; // Теперь null, а не 0, чтобы избежать бага с чужими объявлениями
let userName = user?.username ? "@" + user.username : (user?.first_name || "Аноним");

// ВНИМАНИЕ: СЮДА НУЖНО ВСТАВЛЯТЬ АКТУАЛЬНЫЙ NGROK ПРИ ПЕРЕЗАПУСКЕ
const API_URL = "https://old-shortly-grower.ngrok-free.dev/api"; 

document.getElementById('user-display-name').innerText = userName;
if(role >= 1) {
    document.getElementById('role-badge').innerText = (role === 2 ? "Админ" : "Premium");
    document.getElementById('role-badge').style.background = (role === 2 ? "#00ff88" : "#ffd700");
}

const srvs = ["Vice-City","Phoenix","Tucson","Scottdale","Chandler","Brainburg","Saint Rose","Mesa","Red-Rock","Yuma","Surprise","Prescott","Glendale","Kingman","Winslow","Payson","Gilbert","Show-Low","Casa-Grande","Page","Sun-City","Queen-Creek","Sedona","Holiday","Christmas","Faraway","Bumble Bee","Mirage","Love","Drake"];
const fSrv = document.getElementById('f-srv');
const eSrv = document.getElementById('e-srv');
const sGrid = document.getElementById('srv-grid');

srvs.forEach(s => {
    fSrv.appendChild(new Option(s, s));
    eSrv.appendChild(new Option(s, s));
    let d = document.createElement('div'); 
    d.className='srv-item'; 
    d.innerText=s; 
    d.onclick=()=>selectSrv(s); 
    sGrid.appendChild(d);
});

function openMenu() { document.getElementById('drawer').classList.add('active'); document.getElementById('overlay').style.display='block'; }
function closeMenu() { document.getElementById('drawer').classList.remove('active'); document.getElementById('overlay').style.display='none'; }
function showPage(id) { 
    closeMenu(); 
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); 
    document.getElementById('page-'+id).classList.add('active'); 
    if(id === 'create') fetchUserStatus(); 
}
function openSrv() { document.getElementById('srv-modal').style.display='block'; }
function selectSrv(s) { document.getElementById('current-srv-name').innerText=s; document.getElementById('srv-modal').style.display='none'; loadFeed(s); }

let curImg = null;
const setupFile = (inputId, prevId) => {
    document.getElementById(inputId).onchange = (e) => {
        const f = e.target.files[0]; if(!f) return;
        const r = new FileReader(); r.onload=(ev)=>{
            curImg = ev.target.result;
            document.getElementById(prevId).style.backgroundImage = `url(${curImg})`;
        }; r.readAsDataURL(f);
    };
};
setupFile('file-input', 'photo-preview');
setupFile('edit-file-input', 'edit-photo-preview');
setupFile('auto-file-input', 'auto-photo-preview');

let globalTimers = { manualSec: 0, autoSec: 0, autoActive: false };

function formatTime(sec) {
    if (sec <= 0) return "Готово!";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

setInterval(() => {
    if(globalTimers.manualSec > 0) {
        globalTimers.manualSec--;
        const cBtn = document.getElementById('f-btn');
        if(cBtn) {
            cBtn.innerText = `ОЖИДАЙТЕ (${formatTime(globalTimers.manualSec)})`;
            cBtn.disabled = true;
        }
    } else {
        const cBtn = document.getElementById('f-btn');
        if(cBtn && cBtn.disabled) {
            cBtn.innerText = "ОПУБЛИКОВАТЬ";
            cBtn.disabled = false;
        }
    }

    if(globalTimers.autoActive && globalTimers.autoSec > 0) {
        globalTimers.autoSec--;
        document.getElementById('auto-status').innerText = `✅ ВКЛЮЧЕН (Следующий пост через: ${formatTime(globalTimers.autoSec)})`;
    } else if (globalTimers.autoActive && globalTimers.autoSec <= 0) {
        document.getElementById('auto-status').innerText = `✅ ВКЛЮЧЕН (Отправка...)`;
        if (globalTimers.autoSec === 0) {
            globalTimers.autoSec = -1; 
            setTimeout(fetchUserStatus, 5000); 
        }
    }
}, 1000);

async function fetchUserStatus() {
    if (!userId) return; // Не делаем запрос, если нет ID
    try {
        const r = await fetch(`${API_URL}/user-status?uid=${userId}`, {headers:{"ngrok-skip-browser-warning":"true"}});
        if (!r.ok) return;
        const data = await r.json();
        
        globalTimers.manualSec = data.manual_cd;
        globalTimers.autoActive = data.auto.active;
        globalTimers.autoSec = data.auto.next_run_sec;
        
        if(document.getElementById('a-txt') && data.auto.text && !document.getElementById('a-txt').value) {
            document.getElementById('a-txt').value = data.auto.text;
            document.getElementById('a-int').value = data.auto.interval;
        }
        if(!data.auto.active) {
            document.getElementById('auto-status').innerText = "⏸ ВЫКЛЮЧЕН";
            document.getElementById('auto-status').style.color = "var(--hint)";
        } else {
            document.getElementById('auto-status').style.color = "var(--admin)";
        }
    } catch(e) { console.error("Ошибка обновления статуса", e); }
}

async function loadFeed(srv) {
    fetchUserStatus(); 
    const feed = document.getElementById('home-feed'); 
    feed.innerHTML='<center style="margin-top:20px">Загрузка...</center>';
    try {
        const r = await fetch(`${API_URL}/ads?server=${srv}&uid=${userId}`, {headers:{"ngrok-skip-browser-warning":"true"}});
        const ads = await r.json();
        
        if(ads.error === "BANNED") {
            tg.showAlert("Вы заблокированы администратором!");
            tg.close(); 
            return;
        }

        let htmlOutput = '';
        ads.forEach(ad => {
            // ИСПРАВЛЕНА ЛОГИКА КНОПОК РЕДАКТИРОВАНИЯ
            // 1. Если это твое объявление (твой ID совпадает с ID создателя)
            const isOwner = (userId !== null && ad.user_id == userId);
            // 2. Если ты Админ
            const isAdmin = (role === 2);
            // Показываем кнопки, если ты владелец ИЛИ админ
            const isMod = isOwner || isAdmin;
            
            const badge = (ad.is_premium || ad.user_id == 827979452) ? '<span style="color:var(--prem); font-size:11px; font-weight:bold;">💎 PREMIUM</span>' : '';
            
            htmlOutput += `
            <div class="ad-card" id="ad-${ad.id}">
                <div class="ad-header">
                    <span class="status-tag">${ad.server}</span>
                    ${badge}
                </div>
                <div class="ad-user">👤 ${ad.username}</div>
                <div class="ad-text">${ad.text}</div>
                ${ad.photo ? `<img src="${ad.photo}" class="ad-img">` : ''}
                ${isMod ? `
                <div class="action-row">
                    <button class="btn-edit" onclick='openEdit(${JSON.stringify(ad).replace(/'/g, "&apos;")})'>📝 Изменить</button>
                    <button class="btn-del" onclick="deleteAd(${ad.id})">🗑 Удалить</button>
                </div>` : ''}
            </div>`;
        });
        feed.innerHTML = htmlOutput || '<center style="margin-top:20px">📭 Пусто</center>';
    } catch(e) { feed.innerHTML='<center style="color:red">Ошибка связи с сервером</center>'; }
}

async function submitCreate() {
    if (!userId) return tg.showAlert("Ошибка: Откройте приложение через Telegram!");
    if(globalTimers.manualSec > 0) return tg.showAlert(`КД! Подождите еще ${formatTime(globalTimers.manualSec)}`);
    
    const t = document.getElementById('f-txt').value;
    if(t.length < 5) return tg.showAlert("Опишите товар!");
    
    const btn = document.getElementById('f-btn'); 
    btn.disabled = true;
    btn.innerText = "ОТПРАВКА...";
    
    try {
        const res = await fetch(`${API_URL}/create`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({user_id:userId, username:userName, server:document.getElementById('f-srv').value, text:t, photo:curImg, role:role})
        });
        const data = await res.json();
        if(res.ok) {
            tg.showAlert("✅ Опубликовано!");
            document.getElementById('f-txt').value=''; curImg=null;
            document.getElementById('photo-preview').style.backgroundImage='none';
            showPage('home'); loadFeed('Все');
        } else {
            tg.showAlert(data.error || "Ошибка публикации");
        }
    } catch(e) {
        tg.showAlert("Ошибка связи с сервером!");
    }
    
    btn.disabled = false;
    btn.innerText = "ОПУБЛИКОВАТЬ";
    fetchUserStatus(); 
}

let editingId = null;
function openEdit(ad) {
    editingId = ad.id;
    document.getElementById('e-txt').value = ad.text;
    document.getElementById('e-srv').value = ad.server;
    curImg = ad.photo;
    document.getElementById('edit-photo-preview').style.backgroundImage = ad.photo ? `url(${ad.photo})` : 'none';
    document.getElementById('edit-modal').style.display = 'block';
}
function closeEdit() { document.getElementById('edit-modal').style.display='none'; editingId=null; }

document.getElementById('e-save-btn').onclick = async () => {
    const btn = document.getElementById('e-save-btn');
    btn.innerText = "СОХРАНЕНИЕ...";
    try {
        const res = await fetch(`${API_URL}/update`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({id:editingId, user_id:userId, username:userName, text:document.getElementById('e-txt').value, server:document.getElementById('e-srv').value, photo:curImg, role:role})
        });
        if(res.ok) { 
            closeEdit(); 
            loadFeed('Все'); 
            tg.showAlert("Сохранено!"); 
        }
    } catch(e) {
        tg.showAlert("Ошибка связи с сервером");
    }
    btn.innerText = "СОХРАНИТЬ";
};

function deleteAd(id) {
    tg.showConfirm("Удалить объявление?", async function(confirmResult) {
        if (confirmResult) {
            try {
                const res = await fetch(`${API_URL}/delete`, {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({id:id, user_id:userId, role:role})
                });
                if(res.ok) {
                    const adElem = document.getElementById(`ad-${id}`);
                    if(adElem) adElem.remove();
                }
            } catch(e) {
                tg.showAlert("Ошибка при удалении");
            }
        }
    });
}

async function openAutoPR() {
    showPage('auto');
    if(role === 0) { document.getElementById('auto-lock').style.display='block'; return; }
    document.getElementById('auto-content').style.display='block';
    fetchUserStatus();
}

async function saveAutoPR(active) {
    if (!userId) return tg.showAlert("Ошибка: Откройте приложение через Telegram!");
    const i = parseInt(document.getElementById('a-int').value);
    if(i < 30) return tg.showAlert("Мин. интервал 30 мин!");
    
    try {
        const res = await fetch(`${API_URL}/auto-pr/save`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({user_id:userId, text:document.getElementById('a-txt').value, photo:curImg, interval:i, active:active})
        });
        if(res.ok) { 
            tg.showAlert(active ? "✅ Автопиар запущен!" : "⏸ Автопиар остановлен!"); 
            fetchUserStatus(); 
        }
    } catch (e) {
        tg.showAlert("Ошибка связи с сервером");
    }
}

loadFeed('Все');
