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
    calculateSettlement();

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
        pageTitle.innerHTML = `<i class="fas fa-calculator"></i> ${currentTravel.name} - 结算`;
    }
}

// ==================== 页面跳转 ====================
function goBack() {
    window.location.href = 'index.html';
}

function goToPage(page) {
    window.location.href = page;
}

function refreshSettlement() {
    loadFromStorage();
    loadCurrentTravel();
    calculateSettlement();
    showMessage('结算已刷新');
}

// ==================== 结算计算 ====================
function calculateSettlement() {
    if (!currentTravel) return;

    const expenses = currentTravel.expenses;
    const members = currentTravel.members || [];
    
    // 计算总额
    const totalAmount = expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    const expenseCount = expenses.length;
    const perPersonAmount = members.length > 0 ? totalAmount / members.length : 0;

    // 渲染总览
    renderOverview(totalAmount, expenseCount, perPersonAmount);
    
    // 计算成员统计
    const shouldPay = {};
    const hasPaid = {};
    const netAmounts = {};

    members.forEach(member => {
        shouldPay[member] = 0;
        hasPaid[member] = 0;
    });

    expenses.forEach(expense => {
        hasPaid[expense.payer] = (hasPaid[expense.payer] || 0) + expense.amountCNY;
        Object.entries(expense.splits || {}).forEach(([member, amount]) => {
            shouldPay[member] = (shouldPay[member] || 0) + amount;
        });
    });

    members.forEach(member => {
        netAmounts[member] = hasPaid[member] - shouldPay[member];
    });

    // 渲染成员表格
    renderMemberTable(shouldPay, hasPaid, netAmounts);
    
    // 渲染分类统计
    renderCategoryStats();
    
    // 计算和渲染债务
    const debts = calculateDebts(netAmounts);
    renderDebts(debts);
}

function renderOverview(totalAmount, expenseCount, perPersonAmount) {
    document.getElementById('totalAmount').textContent = `¥${totalAmount.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = expenseCount;
    document.getElementById('perPersonAmount').textContent = `¥${perPersonAmount.toFixed(2)}`;
}

function renderMemberTable(shouldPay, hasPaid, netAmounts) {
    const tbody = document.getElementById('memberStatsBody');
    const members = currentTravel.members || [];

    tbody.innerHTML = members.map(member => {
        const paid = hasPaid[member] || 0;
        const should = shouldPay[member] || 0;
        const net = netAmounts[member] || 0;
        
        let netClass = '';
        let netText = '';
        
        if (net > 0.01) {
            netClass = 'color: #10b981; font-weight: 700;';
            netText = `+¥${net.toFixed(2)} (应收)`;
        } else if (net < -0.01) {
            netClass = 'color: #ef4444; font-weight: 700;';
            netText = `-¥${Math.abs(net).toFixed(2)} (应付)`;
        } else {
            netClass = 'color: #6b7280;';
            netText = '¥0.00 (持平)';
        }

        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid var(--border-color);">${member}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border-color);">¥${paid.toFixed(2)}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border-color);">¥${should.toFixed(2)}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border-color); ${netClass}">${netText}</td>
            </tr>
        `;
    }).join('');
}

// ==================== 渲染分类汇总 ====================
function renderCategoryStats() {
    if (!currentTravel) return;

    const expenses = currentTravel.expenses;
    
    // 定义分类映射
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
    const categoryColors = {
        '交通': '#3b82f6',
        '住宿': '#f59e0b',
        '餐饮': '#10b981',
        '购物': '#ec4899',
        '其他': '#8b5cf6'
    };

    expenses.forEach(expense => {
        const mappedCategory = categoryMap[expense.category] || '其他';
        if (!categoryTotals[mappedCategory]) {
            categoryTotals[mappedCategory] = 0;
        }
        categoryTotals[mappedCategory] += expense.amountCNY;
    });

    // 更新各分类的显示
    updateCategoryStat('stat交通', categoryTotals['交通']);
    updateCategoryStat('stat住宿', categoryTotals['住宿']);
    updateCategoryStat('stat餐饮', categoryTotals['餐饮']);
    updateCategoryStat('stat购物', categoryTotals['购物']);
    updateCategoryStat('stat其他', categoryTotals['其他']);
    
    // 渲染分类详情卡片
    renderCategoryDetails(categoryTotals, categoryColors);
}

function updateCategoryStat(elementId, amount) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = amount ? `¥${amount.toFixed(2)}` : '¥0.00';
    }
}

function renderCategoryDetails(categoryTotals, categoryColors) {
    const container = document.getElementById('categoryDetails');
    if (!container) return;
    
    const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
    
    const categoryOrder = ['交通', '住宿', '餐饮', '购物', '其他'];
    const categoryIcons = {
        '交通': 'fas fa-car',
        '住宿': 'fas fa-hotel',
        '餐饮': 'fas fa-utensils',
        '购物': 'fas fa-shopping-bag',
        '其他': 'fas fa-ellipsis-h'
    };
    
    container.innerHTML = categoryOrder.map(category => {
        const amount = categoryTotals[category] || 0;
        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
        const color = categoryColors[category];
        
        return `
            <div class="category-detail-item">
                <div class="category-detail-icon" style="color: ${color};">
                    <i class="${categoryIcons[category]}"></i>
                </div>
                <div class="category-detail-info">
                    <div class="category-detail-name">${category}</div>
                    <div class="category-detail-bar">
                        <div class="category-detail-progress" style="width: ${percentage}%; background-color: ${color};"></div>
                    </div>
                </div>
                <div class="category-detail-amount">
                    <div class="category-detail-value">¥${amount.toFixed(2)}</div>
                    <div class="category-detail-percent">${percentage}%</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDebts(debts) {
    const container = document.getElementById('debtNetwork');
    
    if (debts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>暂无债务</h3>
                <p>所有成员都已结清</p>
            </div>
        `;
        return;
    }

    container.innerHTML = debts.map(debt => `
        <div class="debt-item">
            <div class="debt-from">${debt.from}</div>
            <div class="debt-arrow">
                <i class="fas fa-arrow-right"></i>
                <div class="debt-amount">¥${debt.amount.toFixed(2)}</div>
            </div>
            <div class="debt-to">${debt.to}</div>
        </div>
    `).join('');
}

// 计算债务关系
function calculateDebts(netAmounts) {
    const debts = [];
    const debtors = [];
    const creditors = [];

    Object.entries(netAmounts).forEach(([member, amount]) => {
        if (amount > 0.01) {
            creditors.push({ member, amount });
        } else if (amount < -0.01) {
            debtors.push({ member, amount: Math.abs(amount) });
        }
    });

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const debtorAmount = debtors[i].amount;
        const creditorAmount = creditors[j].amount;
        const settleAmount = Math.min(debtorAmount, creditorAmount);

        debts.push({
            from: debtors[i].member,
            to: creditors[j].member,
            amount: settleAmount
        });

        debtors[i].amount -= settleAmount;
        creditors[j].amount -= settleAmount;

        if (debtors[i].amount < 0.01) i++;
        if (creditors[j].amount < 0.01) j++;
    }

    return debts;
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

// ==================== 导出功能 ====================
async function exportPDF() {
    if (!currentTravel) {
        showMessage('请先选择一个旅行');
        return;
    }
    
    try {
        showMessage('正在生成 PDF...');
        
        // 生成预览内容
        generatePreview();
        const previewContent = document.getElementById('previewContent');
        
        // 使用 html2canvas 将 DOM 转换为 canvas
        const canvas = await html2canvas(previewContent, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        // 创建 PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10;
        
        pdf.addImage(
            imgData,
            'PNG',
            imgX,
            imgY,
            imgWidth * ratio,
            imgHeight * ratio
        );
        
        pdf.save(`${currentTravel.name}_结算报告.pdf`);
        showMessage('PDF 导出成功！');
        
    } catch (error) {
        console.error('PDF 导出失败:', error);
        showMessage('PDF 导出失败，请重试');
    }
}

async function exportImage() {
    if (!currentTravel) {
        showMessage('请先选择一个旅行');
        return;
    }
    
    try {
        showMessage('正在生成图片...');
        
        generatePreview();
        const previewContent = document.getElementById('previewContent');
        
        const canvas = await html2canvas(previewContent, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        const link = document.createElement('a');
        link.download = `${currentTravel.name}_结算报告.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showMessage('图片导出成功！');
        
    } catch (error) {
        console.error('图片导出失败:', error);
        showMessage('图片导出失败，请重试');
    }
}

function generatePreview() {
    if (!currentTravel) return;
    
    const expenses = currentTravel.expenses;
    const members = currentTravel.members;
    
    const shouldPay = {};
    const hasPaid = {};
    
    members.forEach(member => {
        shouldPay[member] = 0;
        hasPaid[member] = 0;
    });
    
    expenses.forEach(expense => {
        hasPaid[expense.payer] = (hasPaid[expense.payer] || 0) + expense.amountCNY;
        Object.entries(expense.splits || {}).forEach(([member, amount]) => {
            shouldPay[member] = (shouldPay[member] || 0) + amount;
        });
    });
    
    const netAmounts = {};
    const balances = [];
    
    members.forEach(member => {
        netAmounts[member] = hasPaid[member] - shouldPay[member];
        if (Math.abs(netAmounts[member]) > 0.01) {
            balances.push({ member, amount: netAmounts[member] });
        }
    });
    
    const debts = calculateDebts(netAmounts);
    const totalAmount = expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0d9488;">
                <h1 style="color: #0d9488; margin: 0 0 10px 0; font-size: 2rem;">${currentTravel.name}</h1>
                <p style="color: #6b7280; margin: 0;">结算报告 • ${new Date().toLocaleDateString('zh-CN')}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
                <div style="background: #f0fdfa; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #6b7280; font-size: 0.9rem;">总消费</div>
                    <div style="color: #0d9488; font-size: 1.8rem; font-weight: 700;">¥${totalAmount.toFixed(2)}</div>
                </div>
                <div style="background: #f0fdfa; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #6b7280; font-size: 0.9rem;">账单数</div>
                    <div style="color: #0d9488; font-size: 1.8rem; font-weight: 700;">${expenses.length}</div>
                </div>
                <div style="background: #f0fdfa; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #6b7280; font-size: 0.9rem;">人均消费</div>
                    <div style="color: #0d9488; font-size: 1.8rem; font-weight: 700;">¥${(totalAmount / members.length).toFixed(2)}</div>
                </div>
            </div>
            
            <h3 style="color: #0d9488; margin: 20px 0 15px 0;">成员结算</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr style="background: #f0fdfa;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ccfbf1;">成员</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ccfbf1;">实际支付</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ccfbf1;">应付金额</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ccfbf1;">余额</th>
                </tr>
                ${members.map(member => {
                    const netAmount = netAmounts[member] || 0;
                    const netColor = netAmount > 0 ? '#10b981' : (netAmount < 0 ? '#ef4444' : '#6b7280');
                    return `
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">¥${(hasPaid[member] || 0).toFixed(2)}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">¥${(shouldPay[member] || 0).toFixed(2)}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: ${netColor}; font-weight: 700;">
                                ${netAmount > 0 ? '+' : ''}¥${netAmount.toFixed(2)}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </table>
            
            ${debts.length > 0 ? `
                <h3 style="color: #0d9488; margin: 20px 0 15px 0;">结算建议</h3>
                <div style="background: #fef3c7; padding: 20px; border-radius: 10px;">
                    ${debts.map(debt => `
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #fcd34d;">
                            <span style="color: #92400e; font-weight: 600;">${debt.from}</span>
                            <span style="color: #0d9488; font-weight: 700;">¥${debt.amount.toFixed(2)}</span>
                            <span style="color: #92400e; font-weight: 600;">${debt.to}</span>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="background: #d1fae5; padding: 20px; border-radius: 10px; text-align: center;">
                    <i class="fas fa-check-circle" style="color: #065f46; font-size: 2rem;"></i>
                    <div style="color: #065f46; font-weight: 600; margin-top: 10px;">所有成员已结清</div>
                </div>
            `}
        </div>
    `;
    
    document.getElementById('previewCard').style.display = 'block';
}

function openShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('shareLink').value = window.location.href;
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function copyLink() {
    const link = document.getElementById('shareLink');
    link.select();
    document.execCommand('copy');
    showMessage('链接已复制');
}

// 点击模态框背景关闭
document.addEventListener('click', function(e) {
    const modal = document.getElementById('shareModal');
    if (modal && modal.classList.contains('active') && e.target === modal) {
        closeShareModal();
    }
});
