let tg = window.Telegram.WebApp; 
tg.expand();

const urlParams = new URLSearchParams(window.location.search);
const role = parseInt(urlParams.get('role') || '0');

let userId = parseInt(urlParams.get('uid') || '0');
if (!userId && tg.initDataUnsafe?.user) {
    userId = tg.initDataUnsafe.user.id;
}

let userName = tg.initDataUnsafe?.user?.username 
    ? "@" + tg.initDataUnsafe.user.username 
    : (tg.initDataUnsafe?.user?.first_name || "Загрузка...");

// ТВОЙ ID
const OWNER_ID = 827979452;

// ВНИМАНИЕ: СЮДА НУЖНО ВСТАВЛЯТЬ АКТУАЛЬНЫЙ NGROK
const API_URL = "https://old-shortly-grower.ngrok-free.dev/api"; 

document.getElementById('user-display-name').innerText = userName;

// БЕЙДЖИК СТАТУСА В МЕНЮ
if(userId === OWNER_ID) {
    document.getElementById('role-badge').innerText = "Основатель";
    document.getElementById('role-badge').style.background = "#ff0055"; // Красный цвет
} else if(role >= 1) {
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
    if (!userId) return;
    try {
        const r = await fetch(`${API_URL}/user-status?uid=${userId}`, {headers:{"ngrok-skip-brows
