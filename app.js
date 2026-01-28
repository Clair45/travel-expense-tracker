// ==================== 数据存储 ====================
let travels = [];
let currentTravelId = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    // 从云端加载数据
    await loadFromCloud();
    renderTravelList();
});

// 从云端加载所有旅行
async function loadFromCloud() {
    try {
        const cloudTravels = await getAllTravelsAPI();
        travels = cloudTravels;
        // 保存到本地存储作为缓存
        saveToStorage();
    } catch (error) {
        console.error('从云端加载失败，使用本地数据');
        loadFromStorage();
    }
}

// ==================== 渲染旅行列表 ====================
function renderTravelList() {
    const container = document.getElementById('travelList');
    const emptyState = document.getElementById('emptyState');

    if (travels.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = travels.map(travel => {
        const startDate = travel.startDate ? new Date(travel.startDate).toLocaleDateString('zh-CN') : '未设置';
        const endDate = travel.endDate ? new Date(travel.endDate).toLocaleDateString('zh-CN') : '未设置';
        const totalExpense = travel.expenses.reduce((sum, e) => sum + e.amountCNY, 0);
        const memberCount = travel.members.length;

        return `
            <div class="travel-item">
                <div class="travel-main">
                    <div class="travel-icon">
                        <i class="fas fa-map-pin"></i>
                    </div>
                    <div class="travel-info">
                        <div class="travel-name">${travel.name}</div>
                        <div class="travel-date">
                            <i class="fas fa-calendar"></i>
                            ${startDate} 至 ${endDate}
                        </div>
                        <div class="travel-members">
                            <i class="fas fa-users"></i>
                            ${memberCount} 人
                        </div>
                    </div>
                    <div class="travel-stats">
                        <div class="stat-item">
                            <div class="stat-label">总消费</div>
                            <div class="stat-value">¥${totalExpense.toFixed(2)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">账单数</div>
                            <div class="stat-value">${travel.expenses.length}</div>
                        </div>
                    </div>
                </div>
                <div class="travel-actions">
                    <button class="btn btn-primary btn-sm" onclick="selectTravel('${travel.id}', 'expenses.html')">
                        <i class="fas fa-receipt"></i> 记账
                    </button>
                    <button class="btn btn-success btn-sm" onclick="selectTravel('${travel.id}', 'settlement.html')">
                        <i class="fas fa-calculator"></i> 结算
                    </button>
                    <button class="btn btn-info btn-sm" onclick="selectTravel('${travel.id}', 'export.html')">
                        <i class="fas fa-file-export"></i> 导出
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTravel('${travel.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== 旅行操作 ====================
function selectTravel(travelId, targetPage) {
    currentTravelId = travelId;
    const data = {
        travels: travels,
        currentTravelId: currentTravelId
    };
    localStorage.setItem('travelExpenseApp', JSON.stringify(data));
    window.location.href = targetPage;
}

function createNewTravel() {
    currentTravelId = null;
    const data = {
        travels: travels,
        currentTravelId: null
    };
    localStorage.setItem('travelExpenseApp', JSON.stringify(data));
    window.location.href = 'create.html';
}

async function deleteTravel(travelId) {
    if (!confirm('确定要删除这个旅行计划吗？删除后无法恢复。')) {
        return;
    }

    try {
        await deleteTravelAPI(travelId);
        travels = travels.filter(t => t.id !== travelId);
        saveToStorage();
        renderTravelList();
        showMessage('旅行已删除');
    } catch (error) {
        console.error('删除旅行失败:', error);
        travels = travels.filter(t => t.id !== travelId);
        saveToStorage();
        renderTravelList();
    }
}

// ==================== 本地存储 ====================
function saveToStorage() {
    const data = {
        travels: travels,
        currentTravelId: currentTravelId
    };
    localStorage.setItem('travelExpenseApp', JSON.stringify(data));
}

function loadFromStorage() {
    const saved = localStorage.getItem('travelExpenseApp');
    if (saved) {
        const data = JSON.parse(saved);
        travels = data.travels || [];
        currentTravelId = data.currentTravelId || null;
    }
}

// ==================== 消息提示 ====================
function showMessage(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideInRight 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
