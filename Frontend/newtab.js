// API基础地址和默认背景色
const API = "https://uapis.cn/"
const DEFAULT_BG_COLOR = "#ffffff";
const BING_WALLPAPER_CACHE = 'bing-wallpaper-cache';
const BING_WALLPAPER_RETENTION_DAYS = 7;
let activeWallpaperObjectUrl = null;

// 清理过期的Bing壁纸缓存
async function cleanupOldBingWallpapers(cache) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (BING_WALLPAPER_RETENTION_DAYS - 1));
    const requests = await cache.keys();
    await Promise.all(requests.map(async (request) => {
        const match = request.url.match(/\/(\d{4})_(\d{1,2})_(\d{1,2})\.png$/);
        if (!match) return;
        const savedDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (savedDate < cutoff) await cache.delete(request);
    }));
}

// 获取Bing壁纸原始Blob
async function getBingOriginalBlob() {
    const today = new Date();
    const fileName = `${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}.png`;
    const fullUrl = API + "api/v1/image/bing-daily";
    const cache = await caches.open(BING_WALLPAPER_CACHE);
    await cleanupOldBingWallpapers(cache);
    const cacheKey = new Request(`https://wallpaper-cache.invalid/Background/${fileName}`);

    let response = await cache.match(cacheKey);
    if (!response) {
        response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`壁纸下载失败：${response.status}`);
        await cache.put(cacheKey, response.clone());
    }
    return await response.blob();
}

// 获取压缩后的壁纸URL
async function getCompressedImageUrl(scale = 0.5) {
    const originalBlob = await getBingOriginalBlob();
    if (scale >= 1) {
        return URL.createObjectURL(originalBlob);
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(originalBlob);
        img.onload = () => {
            const screenWidth = window.screen.width * window.devicePixelRatio;
            const screenHeight = window.screen.height * window.devicePixelRatio;
            const outputWidth = Math.round(screenWidth * scale);
            const outputHeight = Math.round(screenHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
            canvas.toBlob((blob) => {
                if (!blob) reject(new Error("Canvas 压缩失败"));
                URL.revokeObjectURL(img.src);
                resolve(URL.createObjectURL(blob));
            }, 'image/jpeg', 0.9);
        };
        img.onerror = () => reject(new Error("图片加载失败"));
    });
}

let backgroundDom = null;

// 更新时间显示
function updateTime() {
    const timeDom = document.querySelector('#time');
    if (!timeDom) return;
    timeDom.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// 更新日期显示
function updateDate() {
    const dateDom = document.querySelector('#date');
    if (!dateDom) return;
    dateDom.textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

// 设置背景图片
function setBackground(imgUrl) {
    if (!backgroundDom) return;
    if (activeWallpaperObjectUrl && activeWallpaperObjectUrl !== imgUrl) {
        URL.revokeObjectURL(activeWallpaperObjectUrl);
        activeWallpaperObjectUrl = null;
    }
    backgroundDom.style.backgroundColor = DEFAULT_BG_COLOR;
    if (imgUrl) {
        if (imgUrl.startsWith('blob:')) activeWallpaperObjectUrl = imgUrl;
        backgroundDom.style.backgroundImage = `url(${imgUrl})`;
    } else {
        backgroundDom.style.backgroundImage = "none";
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    backgroundDom = document.querySelector('.background');
    const searchInput = document.querySelector('#searchInput');
    
    updateTime();
    updateDate();
    setInterval(updateTime, 1000);
    setInterval(updateDate, 60 * 1000);

    // 搜索功能
    searchInput?.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        const keyword = searchInput.value.trim();
        if (!keyword) return;
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
    });

    // 初始化壁纸设置
    let savedSettings = localStorage.getItem('wallpaperSettings');
    
    try {
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.type === 'local' && settings.localBase64) {
                setBackground(settings.localBase64);
            } else if (settings.type === 'bing') {
                const imgUrl = await getCompressedImageUrl(settings.scale || 0.5);
                setBackground(imgUrl);
            } else {
                setBackground(null);
            }
        } else {
            const imgUrl = await getCompressedImageUrl(0.5);
            setBackground(imgUrl);
        }
    } catch (err) {
        console.error("初始化壁纸失败", err);
        setBackground(null);
    }

    // 获取DOM元素
    const menuButton = document.getElementById('menuButton');
    const menu = document.getElementById('menu');
    const changeWallpaperButton = document.getElementById('changeWallpaper');
    const wallpaperPanel = document.getElementById('wallpaperPanel');
    const closePanelButton = document.getElementById('closePanel');
    const resolutionSelect = document.getElementById('resolutionSelect');
    
    const actionButtons = document.getElementById('actionButtons');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    
    const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
    const localImageInput = document.getElementById('localImageInput');

    // 状态变量
    let currentSelectedType = 'bing'; 
    let pendingLocalBase64 = null; 

    // 初始化下拉框状态
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        currentSelectedType = settings.type || 'bing';
        if (settings.scale) resolutionSelect.value = settings.scale;
    }

    // 菜单和面板交互
    menuButton.addEventListener('click', function(e) {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    changeWallpaperButton.addEventListener('click', function() {
        wallpaperPanel.classList.add('active');
        menu.style.display = 'none'; 
        actionButtons.style.display = 'none';
    });

    closePanelButton.addEventListener('click', function(e) {
        e.stopPropagation();
        wallpaperPanel.classList.remove('active');
    });

    wallpaperPanel.addEventListener('click', function(e) {
        if (e.target === wallpaperPanel) {
            wallpaperPanel.classList.remove('active');
        }
    });

    document.addEventListener('click', function(e) {
        if (!menuButton.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });

    // 面板选项交互
    const bingOptionBtn = document.querySelector('.wallpaper-option[data-type="bing"]');
    bingOptionBtn.addEventListener('click', function() {
        currentSelectedType = 'bing';
        pendingLocalBase64 = null;
        actionButtons.style.display = 'flex';
    });

    resolutionSelect.addEventListener('change', function() {
        actionButtons.style.display = 'flex';
    });

    uploadTriggerBtn.addEventListener('click', function() {
        localImageInput.click();
    });

    // 图片上传处理
    localImageInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            alert("图片过大，请选择 3MB 以内的图片，否则可能无法保存设置。");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            pendingLocalBase64 = e.target.result;
            currentSelectedType = 'local';
            actionButtons.style.display = 'flex';
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    });

    // 取消按钮处理
    cancelSettingsBtn.addEventListener('click', function() {
        actionButtons.style.display = 'none';
        pendingLocalBase64 = null; 
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            currentSelectedType = settings.type || 'bing';
            if (settings.scale) resolutionSelect.value = settings.scale;
        } else {
            currentSelectedType = 'bing';
            resolutionSelect.value = '0.5';
        }
    });

    // 保存按钮处理
    saveSettingsBtn.addEventListener('click', async function() {
        saveSettingsBtn.disabled = true;
        saveSettingsBtn.textContent = '应用中...';

        let settingsToSave = {
            type: currentSelectedType
        };

        try {
            if (currentSelectedType === 'bing') {
                const scale = parseFloat(resolutionSelect.value);
                settingsToSave.scale = scale;
                const imgUrl = await getCompressedImageUrl(scale);
                setBackground(imgUrl);
            } else if (currentSelectedType === 'local' && pendingLocalBase64) {
                setBackground(pendingLocalBase64);
                settingsToSave.localBase64 = pendingLocalBase64;
            } else {
                setBackground(null);
            }

            localStorage.setItem('wallpaperSettings', JSON.stringify(settingsToSave));
            savedSettings = localStorage.getItem('wallpaperSettings');

            actionButtons.style.display = 'none';
            wallpaperPanel.classList.remove('active');

        } catch (err) {
            console.error("应用壁纸失败", err);
            alert("应用失败，请重试");
        } finally {
            saveSettingsBtn.disabled = false;
            saveSettingsBtn.textContent = '应用并保存';
        }
    });
});
