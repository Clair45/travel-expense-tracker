// 云端同步 API 服务
const API_BASE_URL = '/api';

// Socket.IO 客户端
let socket = null;

// ==================== 初始化 ====================
function initSocket() {
  if (socket) return socket;

  socket = io();

  socket.on('connect', () => {
    console.log('已连接到服务器');
  });

  socket.on('disconnect', () => {
    console.log('与服务器断开连接');
  });

  // 监听旅行更新事件
  socket.on('travel-created', (travel) => {
    console.log('新旅行已创建:', travel);
    refreshTravels();
  });

  socket.on('travel-updated', (travel) => {
    console.log('旅行已更新:', travel);
    if (currentTravelId === travel.id) {
      currentTravel = travel;
      updateUI();
    } else {
      updateTravelInList(travel);
    }
  });

  socket.on('travel-deleted', ({ id }) => {
    console.log('旅行已删除:', id);
    if (currentTravelId === id) {
      showMessage('旅行已被删除');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } else {
      removeTravelFromList(id);
    }
  });

  return socket;
}

// ==================== API 请求函数 ====================
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '请求失败');
    }

    return data.data;
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error;
  }
}

// ==================== 旅行操作 ====================
async function createTravelAPI(travelData) {
  try {
    const travel = await apiRequest('/travels', {
      method: 'POST',
      body: JSON.stringify(travelData)
    });

    // 加入旅行房间
    if (socket) {
      socket.emit('join-travel', travel.id);
    }

    return travel;
  } catch (error) {
    showMessage('创建旅行失败: ' + error.message);
    throw error;
  }
}

async function getAllTravelsAPI() {
  try {
    return await apiRequest('/travels');
  } catch (error) {
    console.error('获取旅行列表失败:', error);
    return [];
  }
}

async function getTravelAPI(travelId) {
  try {
    return await apiRequest(`/travels/${travelId}`);
  } catch (error) {
    console.error('获取旅行失败:', error);
    return null;
  }
}

async function updateTravelAPI(travelId, updates) {
  try {
    return await apiRequest(`/travels/${travelId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  } catch (error) {
    showMessage('更新旅行失败: ' + error.message);
    throw error;
  }
}

async function deleteTravelAPI(travelId) {
  try {
    await apiRequest(`/travels/${travelId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    showMessage('删除旅行失败: ' + error.message);
    throw error;
  }
}

// ==================== 成员操作 ====================
async function addMemberAPI(travelId, member) {
  try {
    return await apiRequest(`/travels/${travelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ member })
    });
  } catch (error) {
    showMessage('添加成员失败: ' + error.message);
    throw error;
  }
}

async function removeMemberAPI(travelId, member) {
  try {
    return await apiRequest(`/travels/${travelId}/members/${encodeURIComponent(member)}`, {
      method: 'DELETE'
    });
  } catch (error) {
    showMessage('删除成员失败: ' + error.message);
    throw error;
  }
}

// ==================== 账单操作 ====================
async function addExpenseAPI(travelId, expenseData) {
  try {
    return await apiRequest(`/travels/${travelId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  } catch (error) {
    showMessage('添加账单失败: ' + error.message);
    throw error;
  }
}

async function updateExpenseAPI(expenseId, updates) {
  try {
    return await apiRequest(`/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  } catch (error) {
    showMessage('更新账单失败: ' + error.message);
    throw error;
  }
}

async function deleteExpenseAPI(expenseId) {
  try {
    return await apiRequest(`/expenses/${expenseId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    showMessage('删除账单失败: ' + error.message);
    throw error;
  }
}

// ==================== 汇率操作 ====================
async function setExchangeRateAPI(travelId, currency, rate) {
  try {
    return await apiRequest(`/travels/${travelId}/rates`, {
      method: 'POST',
      body: JSON.stringify({ currency, rate })
    });
  } catch (error) {
    console.error('设置汇率失败:', error);
    throw error;
  }
}

// ==================== 辅助函数 ====================
function updateTravelInList(travel) {
  const index = travels.findIndex(t => t.id === travel.id);
  if (index !== -1) {
    travels[index] = travel;
    if (typeof renderTravelList === 'function') {
      renderTravelList();
    }
  }
}

function removeTravelFromList(travelId) {
  travels = travels.filter(t => t.id !== travelId);
  if (typeof renderTravelList === 'function') {
    renderTravelList();
  }
}

function refreshTravels() {
  getAllTravelsAPI().then(data => {
    travels = data;
    if (typeof renderTravelList === 'function') {
      renderTravelList();
    }
  });
}

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 初始化 Socket.IO
  initSocket();

  // 如果有当前旅行ID，加入房间
  if (currentTravelId && socket) {
    socket.emit('join-travel', currentTravelId);
  }
});

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initSocket,
    createTravelAPI,
    getAllTravelsAPI,
    getTravelAPI,
    updateTravelAPI,
    deleteTravelAPI,
    addMemberAPI,
    removeMemberAPI,
    addExpenseAPI,
    updateExpenseAPI,
    deleteExpenseAPI,
    setExchangeRateAPI
  };
}
