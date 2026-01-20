// 注册Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // 注册Service Worker
      const registration = await navigator.serviceWorker.register('/服务工作者.js', {
        scope: '/'
      });
      
      console.log('Service Worker 注册成功:', registration);
      
      // 监听Service Worker更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('发现Service Worker更新:', newWorker.state);
        
        newWorker.addEventListener('statechange', () => {
          console.log('Service Worker 状态变化:', newWorker.state);
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本已安装，提示用户刷新
            showUpdateNotification(registration);
          }
        });
      });
      
      // 检查更新
      if (registration.waiting) {
        showUpdateNotification(registration);
      }
      
      // 监听消息
      navigator.serviceWorker.addEventListener('message', event => {
        const { type, data } = event.data;
        console.log('收到Service Worker消息:', type, data);
        
        switch (type) {
          case 'SW_ACTIVATED':
            console.log(`Service Worker ${data.version} 已激活`);
            break;
            
          case 'SYNC_COMPLETE':
            showNotification('同步完成', `${data.count}个菜谱已同步`, 'success');
            break;
            
          case 'CACHE_UPDATED':
            console.log('缓存已更新:', data);
            break;
            
          case 'CACHE_INFO':
            updateCacheInfo(data);
            break;
        }
      });
      
      // 定期检查更新
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // 每小时检查一次
      
    } catch (error) {
      console.error('Service Worker 注册失败:', error);
    }
  });
}

// 显示更新通知
function showUpdateNotification(registration) {
  if (confirm('发现新版本，是否立即更新？')) {
    // 发送消息给Service Worker，要求跳过等待
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // 刷新页面
    window.location.reload();
  }
}

// 显示通知
function showNotification(title, message, type = 'info') {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/图标.png'
    });
  } else if (type === 'info') {
    console.log(`${title}: ${message}`);
  }
}

// 更新缓存信息显示
function updateCacheInfo(data) {
  const cacheInfoElement = document.getElementById('缓存信息');
  if (cacheInfoElement) {
    cacheInfoElement.innerHTML = `
      <div>版本: ${data.version}</div>
      <div>缓存项目: ${data.cachedItems}个</div>
      <div>缓存大小: ${data.cacheSize}</div>
      <div>最后更新: ${new Date(data.lastUpdated).toLocaleString()}</div>
    `;
  }
}

// 手动清理缓存
async function clearCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    showNotification('缓存清理', '正在清理缓存...', 'info');
  }
}

// 手动更新缓存
async function updateCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_CACHE' });
    showNotification('缓存更新', '正在更新缓存...', 'info');
  }
}

// 获取缓存信息
async function getCacheInfo() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'GET_CACHE_INFO' });
  }
}

// 请求通知权限
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('通知权限已授予');
      return true;
    }
  }
  return false;
}

// 注册后台同步
async function registerBackgroundSync(tag = 'sync-recipes') {
  if ('SyncManager' in window && navigator.serviceWorker.ready) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      console.log('后台同步已注册:', tag);
      return true;
    } catch (error) {
      console.error('后台同步注册失败:', error);
      return false;
    }
  }
  return false;
}

// 导出全局函数
window.clearCache = clearCache;
window.updateCache = updateCache;
window.getCacheInfo = getCacheInfo;
window.requestNotificationPermission = requestNotificationPermission;
window.registerBackgroundSync = registerBackgroundSync;
