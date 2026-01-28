// ==================== 数据存储 ====================
let travels = [];
let currentTravelId = null;
let isEditMode = false;
let currentTravel = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    // 先从localStorage读取
    loadFromStorage();

    // 从云端加载所有旅行
    await loadFromCloud();

    // 检查是否有当前选中的旅行ID
    if (currentTravelId) {
        currentTravel = travels.find(t => t.id === currentTravelId);
        if (currentTravel) {
            isEditMode = true;
            document.getElementById('pageTitle').textContent = '编辑旅行';

            // 填充表单
            document.getElementById('travelName').value = currentTravel.name;
            document.getElementById('startDate').value = currentTravel.startDate;
            document.getElementById('endDate').value = currentTravel.endDate;

            updateMembersList();

            // 加入旅行房间
            if (socket) {
                socket.emit('join-travel', currentTravelId);
            }
        } else {
            // ID不存在，当作新建
            currentTravelId = null;
            isEditMode = false;
            initNewTravel();
        }
    } else {
        isEditMode = false;
        initNewTravel();
    }
});

async function loadFromCloud() {
    try {
        const cloudTravels = await getAllTravelsAPI();
        travels = cloudTravels;
        saveToStorage();
    } catch (error) {
        console.error('从云端加载失败，使用本地数据');
        loadFromStorage();
    }
}

// 初始化新旅行
function initNewTravel() {
    document.getElementById('pageTitle').textContent = '创建旅行';
    currentTravel = {
        id: generateId(),
        name: '',
        startDate: '',
        endDate: '',
        members: [],
        expenses: [],
        exchangeRates: {
            CNY: 1,
            USD: 7.2,
            EUR: 7.8,
            JPY: 0.05,
            KRW: 0.0055,
            THB: 0.2
        }
    };
    updateMembersList();
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== 页面跳转 ====================
function goBack() {
    goToPage('index.html');
}

function goToPage(page) {
    window.location.href = page;
}

// ==================== 成员管理 ====================
async function addMember() {
    const input = document.getElementById('memberInput');
    const member = input.value.trim();

    if (!member) {
        showMessage('请输入手机号或邮箱');
        return;
    }

    if (currentTravel.members.includes(member)) {
        showMessage('该成员已存在');
        return;
    }

    // 如果是编辑模式，调用云端API
    if (isEditMode && currentTravel.id) {
        try {
            await addMemberAPI(currentTravel.id, member);
            currentTravel.members.push(member);
        } catch (error) {
            console.error('添加成员失败:', error);
            currentTravel.members.push(member);
        }
    } else {
        currentTravel.members.push(member);
    }

    updateMembersList();
    input.value = '';

    showMessage('成员添加成功');
}

async function removeMember(index) {
    if (!confirm('确定要删除这个成员吗？')) {
        return;
    }

    const member = currentTravel.members[index];

    // 如果是编辑模式，调用云端API
    if (isEditMode && currentTravel.id) {
        try {
            await removeMemberAPI(currentTravel.id, member);
            currentTravel.members.splice(index, 1);
        } catch (error) {
            console.error('删除成员失败:', error);
            currentTravel.members.splice(index, 1);
        }
    } else {
        currentTravel.members.splice(index, 1);
    }

    updateMembersList();

    showMessage('成员已删除');
}

// 更新成员列表显示
function updateMembersList() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    if (currentTravel.members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>暂无成员</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = currentTravel.members.map((member, index) => `
        <div class="member-tag">
            <i class="fas fa-user"></i>
            ${member}
            <button class="remove-btn" onclick="removeMember(${index})">&times;</button>
        </div>
    `).join('');
}

// ==================== 保存旅行 ====================
async function saveTravel() {
    const name = document.getElementById('travelName').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!name) {
        showMessage('请输入旅行名称');
        return;
    }

    if (!startDate || !endDate) {
        showMessage('请选择旅行日期');
        return;
    }

    if (currentTravel.members.length === 0) {
        showMessage('请至少添加一个成员');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showMessage('结束日期不能早于开始日期');
        return;
    }

    // 更新旅行信息
    currentTravel.name = name;
    currentTravel.startDate = startDate;
    currentTravel.endDate = endDate;

    try {
        if (isEditMode) {
            // 更新现有旅行
            await updateTravelAPI(currentTravel.id, {
                name: currentTravel.name,
                startDate: currentTravel.startDate,
                endDate: currentTravel.endDate
            });

            const index = travels.findIndex(t => t.id === currentTravel.id);
            if (index !== -1) {
                travels[index] = currentTravel;
            }
            showMessage('旅行信息已更新');
        } else {
            // 添加新旅行到云端
            await createTravelAPI({
                id: currentTravel.id,
                name: currentTravel.name,
                startDate: currentTravel.startDate,
                endDate: currentTravel.endDate,
                members: currentTravel.members
            });

            travels.push(currentTravel);
            currentTravelId = currentTravel.id;
            showMessage('旅行创建成功');
        }

        saveToStorage();

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
            goToPage('index.html');
        }, 1000);
    } catch (error) {
        console.error('保存旅行失败:', error);
        // 即使云端失败，也保存到本地
        if (isEditMode) {
            const index = travels.findIndex(t => t.id === currentTravel.id);
            if (index !== -1) {
                travels[index] = currentTravel;
            }
        } else {
            travels.push(currentTravel);
            currentTravelId = currentTravel.id;
        }
        saveToStorage();
        showMessage(isEditMode ? '旅行信息已更新' : '旅行创建成功');

        setTimeout(() => {
            goToPage('index.html');
        }, 1000);
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
