const API = "https://uapis.cn/"
const DEFAULT_BG_COLOR = "#ffffff";
const BING_WALLPAPER_CACHE = 'bing-wallpaper-cache';
const BING_WALLPAPER_RETENTION_DAYS = 7;
let activeWallpaperObjectUrl = null;

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

// Bing每日一图
async function getBingImageUrl() {
    const today = new Date();
    const fileName = `${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}.png`;
    const fullUrl = API + "api/v1/image/bing-daily";
    const cache = await caches.open(BING_WALLPAPER_CACHE);
    await cleanupOldBingWallpapers(cache);
    // Cache Storage 仅支持 http/https 请求作为键；该地址仅用于标识当天的缓存。
    const cacheKey = new Request(`https://wallpaper-cache.invalid/Background/${fileName}`);

    let response = await cache.match(cacheKey);
    if (!response) {
        response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`壁纸下载失败：${response.status}`);
        }
        await cache.put(cacheKey, response.clone());
    }

    const imageBlob = await response.blob();
    return URL.createObjectURL(imageBlob);
}

let backgroundDom = null;

function updateTime() {
    const timeDom = document.querySelector('#time');
    if (!timeDom) return;

    timeDom.textContent = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function updateDate() {
    const dateDom = document.querySelector('#date');
    if (!dateDom) return;

    dateDom.textContent = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
}

function setBackground(imgUrl) {
    if (!backgroundDom) return;
    if (activeWallpaperObjectUrl && activeWallpaperObjectUrl !== imgUrl) {
        URL.revokeObjectURL(activeWallpaperObjectUrl);
        activeWallpaperObjectUrl = null;
    }
    backgroundDom.style.backgroundColor = "#ffffff";
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
    console.log(backgroundDom);
    updateTime();
    updateDate();
    setInterval(updateTime, 1000);
    setInterval(updateDate, 60 * 1000);

    searchInput?.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;

        const keyword = searchInput.value.trim();
        if (!keyword) return;

        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
    });

    setBackground(null);
    // 尝试把背景换成bing壁纸
    try {
        const imgUrl = await getBingImageUrl();
        setBackground(imgUrl);
    } catch (err) {
        console.error("获取必应壁纸失败", err);
    }

});



