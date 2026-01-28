// ==================== 数据存储 ====================
let travels = [];
let currentTravelId = null;
let currentTravel = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    // 先从localStorage读取currentTravelId
    loadFromStorage();

    // 从云端加载数据
    await loadFromCloud();

    // 检查travelId是否在travels中
    if (currentTravelId) {
        const travelExists = travels.find(t => t.id === currentTravelId);
        if (!travelExists) {
            console.log('当前travelId不在云端数据中，重置');
            currentTravelId = null;
        }
    }

    checkTravelExist();
    loadCurrentTravel();
    renderExpenseList();
    renderCategoryStats();

    // 加入旅行房间
    if (currentTravelId && socket) {
        socket.emit('join-travel', currentTravelId);
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

// 检查是否有选中的旅行
function checkTravelExist() {
    if (!currentTravelId) {
        showMessage('请先创建或选择一个旅行');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return false;
    }
    return true;
}

// 加载当前旅行数据
function loadCurrentTravel() {
    currentTravel = travels.find(t => t.id === currentTravelId);
    if (!currentTravel) {
        showMessage('旅行不存在，请重新选择');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return;
    }
    
    // 更新页面标题
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.innerHTML = `<i class="fas fa-receipt"></i> ${currentTravel.name} - 记账`;
    }
    
    // 更新成员选择列表
    updateMemberSelectList();
}

// 更新成员选择列表（在模态框中）
function updateMemberSelectList() {
    const container = document.getElementById('memberSelectList');
    if (!container) return;

    container.innerHTML = currentTravel.members.map(member => `
        <label class="checkbox-label">
            <input type="checkbox" value="${member}" class="member-checkbox">
            <span>${member}</span>
        </label>
    `).join('');

    // 更新支付人下拉列表
    const payerSelect = document.getElementById('expensePayer');
    if (payerSelect) {
        payerSelect.innerHTML = `<option value="">选择支付人</option>` +
            currentTravel.members.map(member =>
                `<option value="${member}">${member}</option>`
            ).join('');
    }
}

// ==================== 页面跳转 ====================
function goBack() {
    window.location.href = 'index.html';
}

// ==================== 模态框控制 ====================
function openModal() {
    const modal = document.getElementById('addExpenseModal');
    if (modal) {
        modal.classList.add('active');
        
        // 重置表单
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseCategory').value = '餐饮';
        document.getElementById('customRate').value = '';
        document.getElementById('customRateContainer').style.display = 'none';
        
        // 默认选中所有成员
        const checkboxes = document.querySelectorAll('.member-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
        
        // 默认选中第一个货币
        document.querySelector('.currency-option[value="CNY"]').checked = true;
        
        // 默认选中均摊模式
        document.querySelector('.split-option[value="equal"]').checked = true;
        document.getElementById('customSplitSection').style.display = 'none';
    }
}

function closeModal() {
    const modal = document.getElementById('addExpenseModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 点击模态框背景关闭
document.addEventListener('click', function(e) {
    const modal = document.getElementById('addExpenseModal');
    if (modal && modal.classList.contains('active') && e.target === modal) {
        closeModal();
    }
});

// ==================== 货币选择 ====================
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('currency-option')) {
        const value = e.target.value;
        if (value === 'custom') {
            document.getElementById('customRateContainer').style.display = 'block';
            document.getElementById('customRate').focus();
        } else {
            document.getElementById('customRateContainer').style.display = 'none';
        }
    }
});

// ==================== 分账模式选择 ====================
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('split-option')) {
        const value = e.target.value;
        if (value === 'custom') {
            document.getElementById('customSplitSection').style.display = 'block';
        } else {
            document.getElementById('customSplitSection').style.display = 'none';
        }
    }
});

// ==================== 添加账单 ====================
async function addExpense() {
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value.trim();
    const category = document.getElementById('expenseCategory').value;
    const payer = document.getElementById('expensePayer').value;
    const currency = document.querySelector('.currency-option:checked')?.value || 'CNY';
    const splitMode = document.querySelector('.split-option:checked')?.value || 'equal';

    // 获取选中的成员
    const selectedMembers = [];
    document.querySelectorAll('.member-checkbox:checked').forEach(cb => {
        selectedMembers.push(cb.value);
    });

    // 验证
    if (!amount || amount <= 0) {
        showMessage('请输入有效的金额');
        return;
    }

    if (!description) {
        showMessage('请输入账单描述');
        return;
    }

    if (selectedMembers.length === 0) {
        showMessage('请至少选择一个参与成员');
        return;
    }

    if (splitMode === 'specific' && selectedMembers.length !== 1) {
        showMessage('指定人模式下只能选择一个人');
        return;
    }

    // 计算汇率
    let rate;
    if (currency === 'custom') {
        rate = parseFloat(document.getElementById('customRate').value);
        if (!rate || rate <= 0) {
            showMessage('请输入有效的汇率');
            return;
        }
    } else {
        rate = currentTravel.exchangeRates[currency];
    }

    // 计算CNY金额
    const amountCNY = amount * rate;

    // 计算分账
    let splits = {};
    if (splitMode === 'equal') {
        const perPerson = amountCNY / selectedMembers.length;
        selectedMembers.forEach(member => {
            splits[member] = perPerson;
        });
    } else if (splitMode === 'specific') {
        splits[selectedMembers[0]] = amountCNY;
    } else if (splitMode === 'ratio') {
        const totalRatio = 100;
        const perPerson = amountCNY / selectedMembers.length;
        selectedMembers.forEach(member => {
            splits[member] = perPerson;
        });
    }

    // 创建账单对象
    const expense = {
        id: Date.now().toString(36),
        amount: amount,
        currency: currency,
        amountCNY: amountCNY,
        rate: rate,
        description: description,
        category: category,
        payer: payer,
        participants: selectedMembers,
        splitMode: splitMode,
        splits: splits,
        date: new Date().toISOString()
    };

    try {
        // 调用云端API保存账单
        const updatedTravel = await addExpenseAPI(currentTravelId, expense);
        currentTravel = updatedTravel;

        // 更新本地存储
        const index = travels.findIndex(t => t.id === currentTravelId);
        if (index !== -1) {
            travels[index] = currentTravel;
            saveToStorage();
        }

        // 更新UI
        renderExpenseList();
        renderCategoryStats();
        closeModal();

        showMessage('账单添加成功');
    } catch (error) {
        console.error('添加账单失败:', error);
        // 即使云端失败，也保存到本地
        currentTravel.expenses.push(expense);
        const index = travels.findIndex(t => t.id === currentTravelId);
        if (index !== -1) {
            travels[index] = currentTravel;
            saveToStorage();
        }
        renderExpenseList();
        renderCategoryStats();
        closeModal();
        showMessage('账单添加成功');
    }
}

// ==================== 删除账单 ====================
async function deleteExpense(expenseId) {
    if (!confirm('确定要删除这笔账单吗？')) {
        return;
    }

    try {
        // 调用云端API删除账单
        const updatedTravel = await deleteExpenseAPI(expenseId);
        if (updatedTravel) {
            currentTravel = updatedTravel;
        } else {
            currentTravel.expenses = currentTravel.expenses.filter(e => e.id !== expenseId);
        }

        // 更新本地存储
        const index = travels.findIndex(t => t.id === currentTravelId);
        if (index !== -1) {
            travels[index] = currentTravel;
            saveToStorage();
        }

        renderExpenseList();
        renderCategoryStats();

        showMessage('账单已删除');
    } catch (error) {
        console.error('删除账单失败:', error);
        // 即使云端失败，也从本地删除
        currentTravel.expenses = currentTravel.expenses.filter(e => e.id !== expenseId);
        const index = travels.findIndex(t => t.id === currentTravelId);
        if (index !== -1) {
            travels[index] = currentTravel;
            saveToStorage();
        }
        renderExpenseList();
        renderCategoryStats();
        showMessage('账单已删除');
    }
}

// ==================== 渲染分类统计 ====================
function renderCategoryStats() {
    if (!currentTravel) return;

    const expenses = currentTravel.expenses;
    
    // 定义分类映射（将门票、娱乐等归为其他）
    const categoryMap = {
        '交通': '交通',
        '住宿': '住宿',
        '餐饮': '餐饮',
        '购物': '购物',
        '门票': '其他',
        '娱乐': '其他',
        '其他': '其他'
    };
    
    const categoryTotals = {};

    // 计算各分类总额
    expenses.forEach(expense => {
        const mappedCategory = categoryMap[expense.category] || '其他';
        if (!categoryTotals[mappedCategory]) {
            categoryTotals[mappedCategory] = 0;
        }
        categoryTotals[mappedCategory] += expense.amountCNY;
    });

    // 更新消费统计
    const totalAmount = expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    const members = currentTravel.members || [];
    const perPersonAmount = members.length > 0 ? totalAmount / members.length : 0;

    document.getElementById('totalAmount').textContent = `¥${totalAmount.toFixed(2)}`;
    document.getElementById('expenseCount').textContent = expenses.length;
    document.getElementById('perPersonAmount').textContent = `¥${perPersonAmount.toFixed(2)}`;

    // 更新分类统计（添加其他）
    document.getElementById('statTransport').textContent = `¥${(categoryTotals['交通'] || 0).toFixed(2)}`;
    document.getElementById('statAccommodation').textContent = `¥${(categoryTotals['住宿'] || 0).toFixed(2)}`;
    document.getElementById('statFood').textContent = `¥${(categoryTotals['餐饮'] || 0).toFixed(2)}`;
    document.getElementById('statShopping').textContent = `¥${(categoryTotals['购物'] || 0).toFixed(2)}`;
    document.getElementById('statOther').textContent = `¥${(categoryTotals['其他'] || 0).toFixed(2)}`;
}

// 获取分类图标
function getCategoryIcon(category) {
    const icons = {
        '交通': 'fas fa-car',
        '住宿': 'fas fa-hotel',
        '餐饮': 'fas fa-utensils',
        '购物': 'fas fa-shopping-bag',
        '门票': 'fas fa-ticket-alt',
        '娱乐': 'fas fa-gamepad',
        '其他': 'fas fa-ellipsis-h'
    };
    return icons[category] || 'fas fa-tag';
}

// ==================== 渲染账单列表 ====================
function renderExpenseList() {
    if (!currentTravel) return;

    const container = document.getElementById('expenseList');
    const expenses = currentTravel.expenses;

    if (expenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>暂无账单</h3>
                <p>点击右上角"添加账单"开始记账</p>
            </div>
        `;
        return;
    }

    container.innerHTML = expenses.map(expense => {
        const categoryIcon = getCategoryIcon(expense.category);
        const mappedCategory = getMappedCategory(expense.category);
        
        // 获取分摊的人员信息
        const splitMembers = expense.splits ? Object.entries(expense.splits).map(([member, amount]) => ({
            member,
            amount
        })) : [];
        
        // 生成分摊人信息HTML
        const splitHTML = splitMembers.length > 0 ? `
            <div class="expense-splits">
                <div class="splits-header">分摊给：</div>
                <div class="splits-list">
                    ${splitMembers.map(split => `
                        <span class="split-member">
                            <i class="fas fa-user-check"></i> ${split.member}
                            <span class="split-amount">(¥${split.amount.toFixed(2)})</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : '';
        
        return `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="expense-icon" style="background-color: ${getCategoryColor(expense.category)};">
                        <i class="${categoryIcon}"></i>
                    </div>
                    <div class="expense-info">
                        <div class="expense-header">
                            <div class="expense-description">${expense.description}</div>
                            <div class="expense-amount">¥${expense.amountCNY.toFixed(2)}</div>
                        </div>
                        <div class="expense-meta">
                            <span class="expense-category">
                                <i class="fas fa-tag"></i> ${mappedCategory}
                            </span>
                            <span class="expense-payer">
                                <i class="fas fa-credit-card"></i> ${expense.payer} 付款
                            </span>
                            ${expense.currency && expense.currency !== 'CNY' ? `
                                <span class="expense-currency">
                                    <i class="fas fa-exchange-alt"></i> ${expense.currency}
                                </span>
                            ` : ''}
                        </div>
                        ${splitHTML}
                    </div>
                </div>
                <div class="expense-right">
                    <button class="btn btn-sm btn-danger" onclick="deleteExpense('${expense.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getMappedCategory(category) {
    const categoryMap = {
        '门票': '其他',
        '娱乐': '其他'
    };
    return categoryMap[category] || category;
}

// 获取分类颜色
function getCategoryColor(category) {
    const mappedCategory = getMappedCategory(category);
    const colors = {
        '交通': '#e3f2fd',
        '住宿': '#fff3e0',
        '餐饮': '#e8f5e9',
        '购物': '#fce4ec',
        '其他': '#f3e5f5'
    };
    return colors[mappedCategory] || '#f5f5f5';
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
