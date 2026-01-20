// ============================================
// 智能菜谱推荐系统 - Service Worker
// ============================================

// 版本控制
const VERSION = '1.0.0';
const CACHE_NAME = `smart-recipe-cache-v${VERSION}`;

// 需要缓存的资源
const CACHE_ASSETS = [
  // 核心文件
  '/',
  '/index.html',
  '/样式.css',
  '/脚本.js',
  
  // 图标和manifest
  '/manifest.json',
  '/图标.png',
  
  // 字体
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  
  // 外部库
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://unpkg.com/localforage@1.10.0/dist/localforage.min.js',
  
  // 离线页面
  '/离线页面.html',
  
  // 菜谱数据（预缓存关键数据）
  '/分类索引/菜品分类.json',
  '/分类索引/时令数据.json'
];

// 需要动态缓存的API端点
const API_CACHE_PATTERNS = [
  '/api/recommend',
  '/api/recipes',
  '/api/categories'
];

// 不缓存的资源（动态内容、实时数据）
const NO_CACHE_PATTERNS = [
  '/api/upload',
  '/api/analytics',
  '/api/errors'
];

// ============================================
// Service Worker 安装事件
// ============================================

self.addEventListener('install', event => {
  console.log(`[Service Worker] 安装 v${VERSION}`);
  
  // 跳过等待阶段，立即激活
  self.skipWaiting();
  
  // 预缓存关键资源
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 开始预缓存资源');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] 预缓存完成');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] 预缓存失败:', error);
      })
  );
});

// ============================================
// Service Worker 激活事件
// ============================================

self.addEventListener('activate', event => {
  console.log(`[Service Worker] 激活 v${VERSION}`);
  
  event.waitUntil(
    // 清理旧缓存
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // 声明控制权
      return self.clients.claim();
    })
    .then(() => {
      // 发送激活通知
      sendMessageToClients({ type: 'SW_ACTIVATED', version: VERSION });
    })
    .then(() => {
      console.log('[Service Worker] 激活完成');
    })
  );
});

// ============================================
// 网络请求拦截和处理
// ============================================

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // 不处理非GET请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 检查是否应该跳过Service Worker
  if (shouldSkipCache(request)) {
    return;
  }
  
  // 根据请求类型选择缓存策略
  if (isApiRequest(url)) {
    // API请求：网络优先，失败时使用缓存
    event.respondWith(handleApiRequest(event));
  } else if (isStaticAsset(url)) {
    // 静态资源：缓存优先，失败时使用网络
    event.respondWith(handleStaticRequest(event));
  } else if (isExternalResource(url)) {
    // 外部资源：网络优先，不缓存
    event.respondWith(handleExternalRequest(event));
  } else {
    // 其他请求：网络优先
    event.respondWith(handleDefaultRequest(event));
  }
});

// ============================================
// 缓存策略函数
// ============================================

// 处理API请求：网络优先，失败时使用缓存
async function handleApiRequest(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 尝试从网络获取
    const networkResponse = await fetch(request);
    
    // 如果成功，缓存响应
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      event.waitUntil(
        cache.put(request, responseClone)
      );
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] 网络请求失败，尝试使用缓存:', request.url);
    
    // 从缓存中查找
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果没有缓存，返回离线响应
    return createOfflineResponse(request);
  }
}

// 处理静态资源请求：缓存优先，失败时使用网络
async function handleStaticRequest(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_NAME);
  
  // 首先尝试从缓存获取
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // 检查缓存是否过期（24小时）
    if (!isCacheExpired(cachedResponse)) {
      // 在后台更新缓存
      event.waitUntil(
        updateCache(request, cache)
      );
      return cachedResponse;
    }
  }
  
  try {
    // 从网络获取
    const networkResponse = await fetch(request);
    
    // 缓存新的响应
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      event.waitUntil(
        cache.put(request, responseClone)
      );
    }
    
    return networkResponse;
  } catch (error) {
    // 网络失败，如果有缓存就使用缓存
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 没有缓存，返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('/离线页面.html');
    }
    
    return createOfflineResponse(request);
  }
}

// 处理外部资源：网络优先，不缓存
async function handleExternalRequest(event) {
  try {
    return await fetch(event.request);
  } catch (error) {
    return createOfflineResponse(event.request);
  }
}

// 处理默认请求：网络优先
async function handleDefaultRequest(event) {
  try {
    return await fetch(event.request);
  } catch (error) {
    return createOfflineResponse(event.request);
  }
}

// ============================================
// 工具函数
// ============================================

// 检查是否应该跳过缓存
function shouldSkipCache(request) {
  const url = new URL(request.url);
  
  // 跳过不需要缓存的模式
  for (const pattern of NO_CACHE_PATTERNS) {
    if (url.pathname.startsWith(pattern)) {
      return true;
    }
  }
  
  // 跳过浏览器扩展
  if (url.protocol === 'chrome-extension:') {
    return true;
  }
  
  return false;
}

// 检查是否为API请求
function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => 
    url.pathname.startsWith(pattern)
  );
}

// 检查是否为静态资源
function isStaticAsset(url) {
  // 同源静态资源
  if (url.origin === self.location.origin) {
    const staticExtensions = ['.css', '.js', '.json', '.html', '.png', '.jpg', '.svg', '.ico'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
  }
  return false;
}

// 检查是否为外部资源
function isExternalResource(url) {
  return url.origin !== self.location.origin;
}

// 检查缓存是否过期
function isCacheExpired(cachedResponse) {
  const cachedDate = new Date(cachedResponse.headers.get('date'));
  const now = new Date();
  const hoursDiff = (now - cachedDate) / (1000 * 60 * 60);
  
  // 24小时过期
  return hoursDiff > 24;
}

// 更新缓存
async function updateCache(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
  } catch (error) {
    // 更新失败，保留旧缓存
    console.log('[Service Worker] 缓存更新失败:', error);
  }
}

// 创建离线响应
function createOfflineResponse(request) {
  // 如果是HTML页面请求，返回离线页面
  if (request.mode === 'navigate') {
    return caches.match('/离线页面.html');
  }
  
  // 对于API请求，返回离线数据
  if (request.url.includes('/api/')) {
    return new Response(
      JSON.stringify({
        成功: false,
        错误: '网络连接失败',
        离线模式: true,
        提示: '当前处于离线模式，部分功能可能受限',
        缓存时间: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // 对于其他请求，返回错误
  return new Response(
    '网络连接失败，请检查网络连接后重试',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    }
  );
}

// ============================================
// 消息处理
// ============================================

self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      clearCache();
      break;
      
    case 'UPDATE_CACHE':
      updateCacheAssets(data);
      break;
      
    case 'GET_CACHE_INFO':
      sendCacheInfo(event.source);
      break;
      
    case 'SYNC_RECIPES':
      backgroundSyncRecipes();
      break;
  }
});

// 发送消息给客户端
async function sendMessageToClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// 获取缓存信息
async function sendCacheInfo(client) {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  client.postMessage({
    type: 'CACHE_INFO',
    data: {
      version: VERSION,
      cacheName: CACHE_NAME,
      cachedItems: keys.length,
      cacheSize: await calculateCacheSize(cache),
      lastUpdated: new Date().toISOString()
    }
  });
}

// 计算缓存大小
async function calculateCacheSize(cache) {
  const keys = await cache.keys();
  let totalSize = 0;
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        totalSize += parseInt(contentLength);
      }
    }
  }
  
  // 转换为可读格式
  if (totalSize < 1024) {
    return `${totalSize} B`;
  } else if (totalSize < 1024 * 1024) {
    return `${(totalSize / 1024).toFixed(2)} KB`;
  } else {
    return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// 清理缓存
async function clearCache() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  
  // 发送通知
  sendMessageToClients({
    type: 'CACHE_CLEARED',
    data: { timestamp: new Date().toISOString() }
  });
}

// 更新缓存资源
async function updateCacheAssets(assets = CACHE_ASSETS) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    await cache.addAll(assets);
    
    sendMessageToClients({
      type: 'CACHE_UPDATED',
      data: {
        updatedAt: new Date().toISOString(),
        updatedItems: assets.length
      }
    });
    
    return true;
  } catch (error) {
    console.error('[Service Worker] 更新缓存失败:', error);
    return false;
  }
}

// ============================================
// 后台同步功能
// ============================================

// 注册后台同步
self.addEventListener('sync', event => {
  console.log('[Service Worker] 后台同步事件:', event.tag);
  
  switch (event.tag) {
    case 'sync-recipes':
      event.waitUntil(syncRecipes());
      break;
      
    case 'sync-settings':
      event.waitUntil(syncSettings());
      break;
      
    case 'sync-favorites':
      event.waitUntil(syncFavorites());
      break;
  }
});

// 同步菜谱数据
async function syncRecipes() {
  try {
    // 从IndexedDB获取待同步的数据
    const pendingRecipes = await getPendingRecipes();
    
    if (pendingRecipes.length === 0) {
      return;
    }
    
    // 同步到服务器
    const response = await fetch('/api/sync/recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipes: pendingRecipes })
    });
    
    if (response.ok) {
      // 同步成功，清除待同步数据
      await clearPendingRecipes();
      
      // 发送通知
      sendMessageToClients({
        type: 'SYNC_COMPLETE',
        data: {
          type: 'recipes',
          count: pendingRecipes.length,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('[Service Worker] 同步菜谱失败:', error);
  }
}

// 同步设置
async function syncSettings() {
  // 实现类似syncRecipes的逻辑
}

// 同步收藏
async function syncFavorites() {
  // 实现类似syncRecipes的逻辑
}

// 从IndexedDB获取待同步的菜谱
async function getPendingRecipes() {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['pendingRecipes'], 'readonly');
    const store = transaction.objectStore('pendingRecipes');
    const recipes = await store.getAll();
    return recipes;
  } catch (error) {
    console.error('[Service Worker] 获取待同步菜谱失败:', error);
    return [];
  }
}

// 清除已同步的菜谱
async function clearPendingRecipes() {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['pendingRecipes'], 'readwrite');
    const store = transaction.objectStore('pendingRecipes');
    await store.clear();
  } catch (error) {
    console.error('[Service Worker] 清除待同步菜谱失败:', error);
  }
}

// 打开IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RecipeSyncDB', 1);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // 创建待同步菜谱存储
      if (!db.objectStoreNames.contains('pendingRecipes')) {
        const store = db.createObjectStore('pendingRecipes', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 创建离线操作存储
      if (!db.objectStoreNames.contains('offlineActions')) {
        const store = db.createObjectStore('offlineActions', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      reject(event.target.error);
    };
  });
}

// ============================================
// 推送通知功能
// ============================================

self.addEventListener('push', event => {
  console.log('[Service Worker] 收到推送消息');
  
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || '食刻智能菜谱有新消息',
    icon: '/图标.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: '查看详情'
      },
      {
        action: 'dismiss',
        title: '关闭'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || '食刻智能菜谱', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] 通知被点击');
  
  event.notification.close();
  
  if (event.action === 'open') {
    // 打开相关页面
    const url = event.notification.data.url || '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  } else if (event.action === 'dismiss') {
    // 用户关闭通知，不做任何操作
  } else {
    // 默认点击行为
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] 通知被关闭');
});

// ============================================
// 后台定时任务
// ============================================

// 定期清理过期缓存
async function scheduleCleanup() {
  const now = Date.now();
  const lastCleanup = await getLastCleanupTime();
  
  // 每天清理一次
  if (now - lastCleanup > 24 * 60 * 60 * 1000) {
    await cleanupExpiredCache();
    await setLastCleanupTime(now);
  }
}

// 清理过期缓存
async function cleanupExpiredCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  let cleanedCount = 0;
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response && isCacheExpired(response)) {
      await cache.delete(request);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[Service Worker] 清理了 ${cleanedCount} 个过期缓存`);
  }
}

// 获取上次清理时间
async function getLastCleanupTime() {
  try {
    const cache = await caches.open('sw-meta');
    const response = await cache.match('last-cleanup');
    if (response) {
      const data = await response.json();
      return data.timestamp;
    }
  } catch (error) {
    // 忽略错误
  }
  return 0;
}

// 设置清理时间
async function setLastCleanupTime(timestamp) {
  try {
    const cache = await caches.open('sw-meta');
    const response = new Response(
      JSON.stringify({ timestamp }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    await cache.put('last-cleanup', response);
  } catch (error) {
    console.error('[Service Worker] 保存清理时间失败:', error);
  }
}

// ============================================
// 健康检查
// ============================================

// 定期检查Service Worker状态
async function healthCheck() {
  try {
    // 检查缓存是否正常
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    // 检查核心文件是否缓存
    const coreFiles = ['/', '/index.html', '/样式.css', '/脚本.js'];
    const missingFiles = [];
    
    for (const file of coreFiles) {
      const response = await cache.match(file);
      if (!response) {
        missingFiles.push(file);
      }
    }
    
    // 如果有缺失文件，重新缓存
    if (missingFiles.length > 0) {
      console.log('[Service Worker] 发现缺失的核心文件:', missingFiles);
      await cache.addAll(missingFiles);
    }
    
    return {
      status: 'healthy',
      cacheSize: keys.length,
      missingFiles: missingFiles.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Service Worker] 健康检查失败:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================
// Service Worker 生命周期管理
// ============================================

// 监听Service Worker错误
self.addEventListener('error', event => {
  console.error('[Service Worker] 发生错误:', event.error);
  
  // 发送错误报告
  sendErrorReport(event.error);
});

// 监听未处理的Promise拒绝
self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker] 未处理的Promise拒绝:', event.reason);
  
  // 发送错误报告
  sendErrorReport(event.reason);
});

// 发送错误报告
async function sendErrorReport(error) {
  try {
    const errorData = {
      type: 'service-worker-error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      version: VERSION
    };
    
    // 存储错误到IndexedDB，稍后同步
    await storeErrorReport(errorData);
  } catch (reportError) {
    console.error('[Service Worker] 发送错误报告失败:', reportError);
  }
}

// 存储错误报告
async function storeErrorReport(errorData) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['errorReports'], 'readwrite');
    const store = transaction.objectStore('errorReports');
    await store.add(errorData);
  } catch (error) {
    console.error('[Service Worker] 存储错误报告失败:', error);
  }
}

// ============================================
// 离线页面内容
// ============================================

// 如果无法加载离线页面，动态生成一个
const OFFLINE_PAGE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>食刻智能菜谱 - 离线模式</title>
    <style>
        body {
            font-family: 'Noto Sans SC', sans-serif;
            background: linear-gradient(135deg, #f8fff8 0%, #f0f7f0 100%);
            color: #2C3E50;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
        }
        
        .offline-container {
            max-width: 600px;
            padding: 40px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(46, 139, 87, 0.1);
        }
        
        .offline-icon {
            font-size: 80px;
            color: #2E8B57;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #2E8B57;
            margin-bottom: 20px;
        }
        
        p {
            line-height: 1.6;
            margin-bottom: 20px;
            color: #7F8C8D;
        }
        
        .features {
            text-align: left;
            margin: 30px 0;
        }
        
        .feature {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .feature i {
            color: #2E8B57;
            margin-right: 10px;
            font-size: 20px;
        }
        
        button {
            background: linear-gradient(135deg, #2E8B57, #4ECDC4);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s;
            margin: 10px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(46, 139, 87, 0.3);
        }
        
        .secondary {
            background: #F8FFF8;
            color: #2E8B57;
            border: 2px solid #2E8B57;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">
            <i class="fas fa-wifi-slash"></i>
        </div>
        
        <h1>网络连接已断开</h1>
        
        <p>您目前处于离线状态，但别担心！食刻智能菜谱的大部分功能仍然可用：</p>
        
        <div class="features">
            <div class="feature">
                <i class="fas fa-book"></i>
                <span>查看已缓存的菜谱</span>
            </div>
            <div class="feature">
                <i class="fas fa-shopping-cart"></i>
                <span>使用购物清单</span>
            </div>
            <div class="feature">
                <i class="fas fa-heart"></i>
                <span>查看收藏的菜谱</span>
            </div>
            <div class="feature">
                <i class="fas fa-cog"></i>
                <span>调整设置</span>
            </div>
        </div>
        
        <p>当网络恢复后，系统将自动同步您的更改。</p>
        
        <div>
            <button onclick="window.location.reload()">
                <i class="fas fa-redo"></i> 重新加载
            </button>
            <button class="secondary" onclick="history.back()">
                <i class="fas fa-arrow-left"></i> 返回上一页
            </button>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px;">
            <i class="fas fa-info-circle"></i>
            要获得完整功能，请连接到互联网。
        </p>
    </div>
    
    <script>
        // 检查网络状态
        function checkNetworkStatus() {
            if (navigator.onLine) {
                window.location.reload();
            }
        }
        
        // 每30秒检查一次网络状态
        setInterval(checkNetworkStatus, 30000);
        
        // 监听网络状态变化
        window.addEventListener('online', checkNetworkStatus);
    </script>
</body>
</html>
`;

// 如果请求离线页面但缓存中没有，返回动态生成的页面
self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('/离线页面.html') || 
      (event.request.mode === 'navigate' && !navigator.onLine)) {
    
    event.respondWith(
      caches.match('/离线页面.html')
        .then(response => {
          if (response) {
            return response;
          }
          // 返回动态生成的离线页面
          return new Response(OFFLINE_PAGE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
  }
});

// ============================================
// 初始化完成
// ============================================

console.log('[Service Worker] 已加载，版本:', VERSION);

// 启动定时任务
setTimeout(scheduleCleanup, 60000); // 1分钟后开始清理
setInterval(scheduleCleanup, 24 * 60 * 60 * 1000); // 每天清理一次

// 启动健康检查
setTimeout(async () => {
  const health = await healthCheck();
  console.log('[Service Worker] 健康检查结果:', health);
}, 5000);
