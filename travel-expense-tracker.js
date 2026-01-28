// ==================== 数据存储 ====================
let travelData = {
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

let selectedCurrency = 'CNY';
let expenseIdCounter = 0;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeCurrencySelect();
    initializeSplitModeToggle();
    loadFromStorage();
});

// ==================== 标签页切换 ====================
function initializeTabs() {
    const tabs = document.getElementById('mainTabs');
    if (tabs) {
        tabs.addEventListener('change', function(value) {
            if (value === 'settlement') {
                calculateSettlement();
            }
        });
    }
}

// ==================== 货币选择 ====================
function initializeCurrencySelect() {
    const currencyGroup = document.getElementById('currencyGroup');
    if (currencyGroup) {
        currencyGroup.addEventListener('change', function(value) {
            selectedCurrency = value;
            const exchangeRateInput = document.getElementById('exchangeRate');
            if (exchangeRateInput) {
                const rate = travelData.exchangeRates[selectedCurrency];
                exchangeRateInput.value = rate;
            }
        });
    }
}

// ==================== 分账模式切换 ====================
function initializeSplitModeToggle() {
    const splitModeGroup = document.getElementById('splitModeGroup');
    if (splitModeGroup) {
        splitModeGroup.addEventListener('change', function(value) {
            const proportionalDiv = document.getElementById('proportionalInputs');
            if (proportionalDiv) {
                if (value === 'proportional') {
                    proportionalDiv.style.display = 'block';
                    updateProportionalInputs();
                } else {
                    proportionalDiv.style.display = 'none';
                }
            }
        });
    }
}

// ==================== 成员管理 ====================
function addMember() {
    const input = document.getElementById('memberInput');
    const member = input.value.trim();
    
    if (!member) {
        showMessage('请输入手机号或邮箱', 'error');
        return;
    }
    
    if (travelData.members.includes(member)) {
        showMessage('该成员已存在', 'warning');
        return;
    }
    
    travelData.members.push(member);
    updateMembersList();
    updateExpensePayerSelect();
    updateExpenseMembersCheckboxes();
    input.value = '';
    
    saveToStorage();
    showMessage('成员添加成功', 'success');
}

// 更新成员列表显示
function updateMembersList() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    if (travelData.members.length === 0) {
        container.innerHTML = '<t-empty description="暂无成员" />';
        return;
    }
    
    container.innerHTML = travelData.members.map((member, index) => `
        <div class="member-tag">
            <i class="fas fa-user"></i>
            ${member}
            <button class="remove-btn" onclick="removeMember(${index})">&times;</button>
        </div>
    `).join('');
}

// 删除成员
function removeMember(index) {
    travelData.members.splice(index, 1);
    updateMembersList();
    updateExpensePayerSelect();
    updateExpenseMembersCheckboxes();
    saveToStorage();
    showMessage('成员已删除', 'success');
}

// ==================== 支付人和参与成员 ====================
function updateExpensePayerSelect() {
    const select = document.getElementById('expensePayer');
    if (!select) return;
    
    select.innerHTML = travelData.members.map(member => 
        `<t-option value="${member}">${member}</t-option>`
    ).join('');
}

function updateExpenseMembersCheckboxes() {
    const container = document.getElementById('expenseMembers');
    if (!container) return;
    
    if (travelData.members.length === 0) {
        container.innerHTML = '<t-empty description="请先添加成员" />';
        return;
    }
    
    container.innerHTML = travelData.members.map(member => `
        <t-checkbox value="${member}" checked>${member}</t-checkbox>
    `).join('');
    
    updateProportionalInputs();
}

// ==================== 比例输入 ====================
function updateProportionalInputs() {
    const container = document.getElementById('proportionalList');
    if (!container) return;
    
    // 获取选中的成员
    const checkedItems = document.querySelectorAll('#expenseMembers .t-checkbox.t-is-checked');
    const checkedMembers = Array.from(checkedItems).map(cb => cb.value);
    
    container.innerHTML = checkedMembers.map(member => `
        <div class="proportional-item">
            <label>${member}</label>
            <input type="number" 
                   class="proportional-input" 
                   data-member="${member}" 
                   value="0" 
                   min="0" 
                   max="100" 
                   step="1"
                   style="width: 80px; padding: 8px; border: 2px solid var(--border-color); border-radius: 8px; text-align: center;">
            <span>%</span>
        </div>
    `).join('');
}

// ==================== 创建旅行 ====================
function createTravel() {
    const name = document.getElementById('travelName').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!name || !startDate || !endDate) {
        showMessage('请填写完整的旅行信息', 'error');
        return;
    }
    
    if (travelData.members.length === 0) {
        showMessage('请至少添加一个成员', 'error');
        return;
    }
    
    travelData.name = name;
    travelData.startDate = startDate;
    travelData.endDate = endDate;
    
    document.getElementById('currentTravelCard').style.display = 'block';
    updateCurrentTravelInfo();
    saveToStorage();
    
    showMessage('旅行创建成功！', 'success');
}

// 更新当前旅行信息
function updateCurrentTravelInfo() {
    const container = document.getElementById('currentTravelInfo');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div><strong>旅行名称：</strong>${travelData.name}</div>
            <div><strong>成员数：</strong>${travelData.members.length}</div>
            <div><strong>开始日期：</strong>${travelData.startDate}</div>
            <div><strong>结束日期：</strong>${travelData.endDate}</div>
            <div><strong>账单数：</strong>${travelData.expenses.length}</div>
        </div>
    `;
}

// ==================== 添加账单 ====================
function addExpense() {
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const payer = document.getElementById('expensePayer').value;
    const category = document.getElementById('expenseCategory').value;
    const exchangeRate = parseFloat(document.getElementById('exchangeRate').value);
    const splitMode = document.getElementById('splitModeGroup').value;
    
    if (!desc || !amount || !payer) {
        showMessage('请填写完整的账单信息', 'error');
        return;
    }
    
    // 获取选中的成员
    const checkedItems = document.querySelectorAll('#expenseMembers .t-checkbox.t-is-checked');
    const checkedMembers = Array.from(checkedItems).map(cb => cb.value);
    
    if (checkedMembers.length === 0) {
        showMessage('请至少选择一个参与成员', 'error');
        return;
    }
    
    // 计算分账
    let splits = {};
    if (splitMode === 'equal') {
        const perPerson = amount / checkedMembers.length;
        checkedMembers.forEach(member => {
            splits[member] = perPerson;
        });
    } else if (splitMode === 'proportional') {
        let totalPercent = 0;
        const inputs = document.querySelectorAll('.proportional-input');
        inputs.forEach(input => {
            const member = input.dataset.member;
            const percent = parseFloat(input.value) || 0;
            totalPercent += percent;
            splits[member] = (amount * percent) / 100;
        });
        
        if (Math.abs(totalPercent - 100) > 0.1) {
            showMessage(`比例总和应为100%，当前为${totalPercent}%`, 'error');
            return;
        }
    } else if (splitMode === 'custom') {
        checkedMembers.forEach(member => {
            splits[member] = amount;
        });
    }
    
    // 计算人民币金额
    const amountCNY = selectedCurrency === 'CNY' ? amount : amount * exchangeRate;
    
    const expense = {
        id: ++expenseIdCounter,
        desc,
        amount,
        amountCNY,
        currency: selectedCurrency,
        payer,
        category,
        members: checkedMembers,
        splits,
        splitMode,
        exchangeRate,
        date: new Date().toISOString()
    };
    
    travelData.expenses.push(expense);
    updateExpenseList();
    updateCurrentTravelInfo();
    clearExpenseForm();
    saveToStorage();
    
    showMessage('账单添加成功！', 'success');
}

// 清空表单
function clearExpenseForm() {
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expensePayer').value = '';
    
    // 重置货币选择
    const currencyGroup = document.getElementById('currencyGroup');
    if (currencyGroup) {
        currencyGroup.value = 'CNY';
        selectedCurrency = 'CNY';
    }
    
    document.getElementById('exchangeRate').value = 1;
    
    // 重置分账模式
    const splitModeGroup = document.getElementById('splitModeGroup');
    if (splitModeGroup) {
        splitModeGroup.value = 'equal';
    }
    document.getElementById('proportionalInputs').style.display = 'none';
    
    // 重置成员选择
    const checkboxes = document.querySelectorAll('#expenseMembers .t-checkbox');
    checkboxes.forEach(cb => cb.setAttribute('checked', ''));
}

// ==================== 账单列表 ====================
function updateExpenseList() {
    const container = document.getElementById('expenseList');
    if (!container) return;
    
    if (travelData.expenses.length === 0) {
        container.innerHTML = `
            <t-empty description="暂无账单">
                <template #image><i class="fas fa-inbox"></i></template>
            </t-empty>
        `;
        return;
    }
    
    container.innerHTML = travelData.expenses.slice().reverse().map(expense => `
        <div class="expense-item animate-fade-in">
            <div class="expense-header">
                <div>
                    <span class="expense-title">${expense.desc}</span>
                    <t-tag theme="primary" style="margin-left: 8px;">${expense.category}</t-tag>
                    <t-tag theme="success" style="margin-left: 8px;">${getSplitModeText(expense.splitMode)}</t-tag>
                </div>
                <div class="expense-amount">${expense.currency} ${expense.amount.toFixed(2)}</div>
            </div>
            <div class="expense-details">
                <div class="expense-detail"><strong>支付人：</strong>${expense.payer}</div>
                <div class="expense-detail"><strong>日期：</strong>${new Date(expense.date).toLocaleDateString()}</div>
                <div class="expense-detail"><strong>人数：</strong>${expense.members.length}人</div>
                <div class="expense-detail"><strong>人民币：</strong>¥${expense.amountCNY.toFixed(2)}</div>
            </div>
            <div class="expense-actions">
                <t-button theme="danger" size="small" onclick="deleteExpense(${expense.id})">
                    <template #icon><i class="fas fa-trash"></i></template>
                    删除
                </t-button>
            </div>
        </div>
    `).join('');
}

// 获取分账模式文本
function getSplitModeText(mode) {
    const texts = {
        equal: '均摊',
        proportional: '按比例',
        custom: '指定人'
    };
    return texts[mode] || mode;
}

// 删除账单
function deleteExpense(id) {
    travelData.expenses = travelData.expenses.filter(e => e.id !== id);
    updateExpenseList();
    updateCurrentTravelInfo();
    saveToStorage();
    showMessage('账单已删除', 'success');
}

// ==================== 结算计算 ====================
function calculateSettlement() {
    if (travelData.expenses.length === 0) {
        return;
    }
    
    // 计算总额
    const totalAmount = travelData.expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    const perPersonAmount = totalAmount / travelData.members.length;
    
    // 计算每人应付和实付
    const shouldPay = {};
    const actuallyPaid = {};
    
    travelData.members.forEach(member => {
        shouldPay[member] = 0;
        actuallyPaid[member] = 0;
    });
    
    travelData.expenses.forEach(expense => {
        // 支付人实际支付
        actuallyPaid[expense.payer] += expense.amountCNY;
        
        // 参与者应该支付
        Object.entries(expense.splits).forEach(([member, amount]) => {
            const amountCNY = expense.currency === 'CNY' ? amount : amount * expense.exchangeRate;
            shouldPay[member] += amountCNY;
        });
    });
    
    // 更新统计信息
    updateStatistics(totalAmount, perPersonAmount);
    
    // 计算债务
    const balances = {};
    travelData.members.forEach(member => {
        balances[member] = actuallyPaid[member] - shouldPay[member];
    });
    
    const debts = calculateDebtNetwork(balances);
    updateDebtNetwork(debts);
}

// 更新统计信息
function updateStatistics(totalAmount, perPersonAmount) {
    // 总览
    const totalAmountEl = document.getElementById('totalAmount');
    const totalExpensesEl = document.getElementById('totalExpenses');
    const perPersonAmountEl = document.getElementById('perPersonAmount');
    
    if (totalAmountEl) totalAmountEl.textContent = totalAmount.toFixed(2);
    if (totalExpensesEl) totalExpensesEl.textContent = travelData.expenses.length;
    if (perPersonAmountEl) perPersonAmountEl.textContent = perPersonAmount.toFixed(2);
    
    // 分类统计
    const categoryStats = {
        '交通': 0,
        '住宿': 0,
        '餐饮': 0,
        '购物': 0,
        '门票': 0,
        '娱乐': 0,
        '其他': 0
    };
    
    travelData.expenses.forEach(expense => {
        categoryStats[expense.category] += expense.amountCNY;
    });
    
    document.getElementById('statTransport').textContent = `¥${categoryStats['交通'].toFixed(2)}`;
    document.getElementById('statAccommodation').textContent = `¥${categoryStats['住宿'].toFixed(2)}`;
    document.getElementById('statFood').textContent = `¥${categoryStats['餐饮'].toFixed(2)}`;
    document.getElementById('statShopping').textContent = `¥${categoryStats['购物'].toFixed(2)}`;
}

// 计算债务网络
function calculateDebtNetwork(balances) {
    const debts = [];
    const debtors = [];
    const creditors = [];
    
    Object.entries(balances).forEach(([member, balance]) => {
        if (balance < -0.01) {
            debtors.push({ member, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ member, amount: balance });
        }
    });
    
    // 按金额排序
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    
    // 计算债务关系
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = Math.min(debtor.amount, creditor.amount);
        
        if (amount > 0.01) {
            debts.push({
                from: debtor.member,
                to: creditor.member,
                amount: amount
            });
        }
        
        debtor.amount -= amount;
        creditor.amount -= amount;
        
        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }
    
    return debts;
}

// 更新债务网络显示
function updateDebtNetwork(debts) {
    const container = document.getElementById('debtNetwork');
    if (!container) return;
    
    if (debts.length === 0) {
        container.innerHTML = `
            <t-empty description="所有成员都已结清">
                <template #image><i class="fas fa-check-circle"></i></template>
            </t-empty>
        `;
        return;
    }
    
    container.innerHTML = debts.map(debt => `
        <div class="debt-item animate-fade-in">
            <div>
                <span class="debt-from">${debt.from}</span>
                <span class="debt-to"> 需要支付给 </span>
                <span class="debt-to">${debt.to}</span>
            </div>
            <div class="debt-amount">¥${debt.amount.toFixed(2)}</div>
        </div>
    `).join('');
}

// ==================== 导出 PDF ====================
/**
 * 修复 PDF 导出中文乱码问题
 * 问题原因：jsPDF 默认不支持中文字符
 * 解决方案：使用 html2canvas 将 DOM 转换为图片，再添加到 PDF
 */
async function exportPDF() {
    if (!travelData.name) {
        showMessage('请先创建旅行', 'error');
        return;
    }
    
    try {
        showMessage('正在生成 PDF，请稍候...', 'info');
        
        // 生成预览内容
        const previewContent = document.getElementById('previewContent');
        previewContent.innerHTML = generatePreviewHTML();
        document.getElementById('exportPreview').style.display = 'block';
        
        // 使用 html2canvas 将 DOM 转换为 canvas
        const canvas = await html2canvas(previewContent, {
            scale: 2, // 提高清晰度
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        // 创建 PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // 计算图片尺寸
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // 计算缩放比例，保持图片比例
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10;
        
        // 添加图片到 PDF
        pdf.addImage(
            imgData,
            'PNG',
            imgX,
            imgY,
            imgWidth * ratio,
            imgHeight * ratio,
            undefined,
            'FAST'
        );
        
        // 保存 PDF
        const fileName = `${travelData.name}_结算报告.pdf`;
        pdf.save(fileName);
        
        showMessage('PDF 导出成功！', 'success');
        
    } catch (error) {
        console.error('PDF 导出失败:', error);
        showMessage('PDF 导出失败，请重试', 'error');
    }
}

// ==================== 导出图片 ====================
async function exportImage() {
    if (!travelData.name) {
        showMessage('请先创建旅行', 'error');
        return;
    }
    
    try {
        showMessage('正在生成图片，请稍候...', 'info');
        
        // 生成预览内容
        const previewContent = document.getElementById('previewContent');
        previewContent.innerHTML = generatePreviewHTML();
        document.getElementById('exportPreview').style.display = 'block';
        
        // 使用 html2canvas 将 DOM 转换为图片
        const canvas = await html2canvas(previewContent, {
            scale: 2, // 提高清晰度
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        // 下载图片
        const link = document.createElement('a');
        link.download = `${travelData.name}_结算报告.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showMessage('图片导出成功！', 'success');
        
    } catch (error) {
        console.error('图片导出失败:', error);
        showMessage('图片导出失败，请重试', 'error');
    }
}

// ==================== 生成预览 HTML ====================
function generatePreviewHTML() {
    const totalAmount = travelData.expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    
    // 计算债务
    const shouldPay = {};
    const actuallyPaid = {};
    travelData.members.forEach(member => {
        shouldPay[member] = 0;
        actuallyPaid[member] = 0;
    });
    
    travelData.expenses.forEach(expense => {
        actuallyPaid[expense.payer] += expense.amountCNY;
        Object.entries(expense.splits).forEach(([member, amount]) => {
            const amountCNY = expense.currency === 'CNY' ? amount : amount * expense.exchangeRate;
            shouldPay[member] += amountCNY;
        });
    });
    
    const balances = {};
    travelData.members.forEach(member => {
        balances[member] = actuallyPaid[member] - shouldPay[member];
    });
    
    const debts = calculateDebtNetwork(balances);
    
    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; padding: 40px; background: #ffffff; min-width: 800px;">
            <!-- 标题 -->
            <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #0d9488;">
                <h1 style="color: #0d9488; font-size: 32px; font-weight: 700; margin: 0 0 10px 0;">
                    <i class="fas fa-plane-departure" style="margin-right: 10px;"></i>
                    ${travelData.name} - 结算报告
                </h1>
                <p style="color: #6b7280; font-size: 16px; margin: 0;">
                    生成时间：${new Date().toLocaleString()}
                </p>
            </div>
            
            <!-- 旅行信息 -->
            <div style="background: #f0fdfa; padding: 20px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #0d9488;">
                <h3 style="color: #0d9488; margin: 0 0 15px 0; font-size: 20px;">旅行信息</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div><strong>旅行名称：</strong>${travelData.name}</div>
                    <div><strong>成员数：</strong>${travelData.members.length}</div>
                    <div><strong>开始日期：</strong>${travelData.startDate}</div>
                    <div><strong>结束日期：</strong>${travelData.endDate}</div>
                    <div><strong>成员：</strong>${travelData.members.join(', ')}</div>
                    <div><strong>账单数：</strong>${travelData.expenses.length}</div>
                </div>
            </div>
            
            <!-- 消费汇总 -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(13, 148, 136, 0.3);">
                    <div style="font-size: 14px; margin-bottom: 10px; opacity: 0.9;">总消费</div>
                    <div style="font-size: 36px; font-weight: 700;">¥${totalAmount.toFixed(2)}</div>
                </div>
                <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(20, 184, 166, 0.3);">
                    <div style="font-size: 14px; margin-bottom: 10px; opacity: 0.9;">人均消费</div>
                    <div style="font-size: 36px; font-weight: 700;">¥${(totalAmount / travelData.members.length).toFixed(2)}</div>
                </div>
            </div>
            
            <!-- 账单明细 -->
            <div style="margin-bottom: 30px;">
                <h3 style="color: #0d9488; margin: 0 0 20px 0; font-size: 20px; padding-bottom: 10px; border-bottom: 2px solid #ccfbf1;">
                    账单明细
                </h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${travelData.expenses.slice().reverse().map((expense, index) => `
                        <div style="padding: 15px; background: #f9fafb; margin-bottom: 12px; border-radius: 8px; border-left: 4px solid #0d9488;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div>
                                    <div style="font-weight: 600; color: #0d9488; font-size: 16px;">
                                        ${expense.desc}
                                    </div>
                                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
                                        ${expense.category} | ${new Date(expense.date).toLocaleDateString()}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 24px; font-weight: 700; color: #0d9488;">
                                        ${expense.currency} ${expense.amount.toFixed(2)}
                                    </div>
                                    <div style="font-size: 14px; color: #6b7280;">
                                        ¥${expense.amountCNY.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; padding-top: 8px; border-top: 1px dashed #e5e7eb;">
                                <div>支付人：<strong>${expense.payer}</strong></div>
                                <div>参与人数：${expense.members.length}人</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- 债务结算 -->
            ${debts.length > 0 ? `
                <div style="background: #fef3c7; padding: 25px; border-radius: 12px; border: 2px solid #f59e0b;">
                    <h3 style="color: #b45309; margin: 0 0 20px 0; font-size: 20px;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                        债务结算
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${debts.map(debt => `
                            <div style="background: white; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                <div>
                                    <strong style="color: #0d9488; font-size: 16px;">${debt.from}</strong>
                                    <span style="color: #6b7280; margin: 0 10px;">需要支付给</span>
                                    <strong style="color: #0d9488; font-size: 16px;">${debt.to}</strong>
                                </div>
                                <div style="color: #f59e0b; font-weight: 700; font-size: 20px;">
                                    ¥${debt.amount.toFixed(2)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div style="background: #d1fae5; padding: 25px; border-radius: 12px; text-align: center; border: 2px solid #10b981;">
                    <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981; margin-bottom: 15px;"></i>
                    <div style="color: #065f46; font-size: 18px; font-weight: 600;">所有成员都已结清，暂无债务！</div>
                </div>
            `}
        </div>
    `;
}

// ==================== 分享功能 ====================
function showShareModal() {
    const shareLink = `https://travel-expense-tracker.app/share/${encodeURIComponent(travelData.name)}`;
    document.getElementById('shareLink').value = shareLink;
    
    // 显示 TDesign 对话框
    const dialog = document.getElementById('shareDialog');
    if (dialog) {
        dialog.setAttribute('visible', 'true');
    }
}

function closeShareModal() {
    const dialog = document.getElementById('shareDialog');
    if (dialog) {
        dialog.setAttribute('visible', 'false');
    }
}

function shareWeChat() {
    showMessage('请使用微信扫描二维码或复制链接分享', 'info');
    copyLink();
}

function shareEmail() {
    const subject = encodeURIComponent(`邀请加入旅行：${travelData.name}`);
    const body = encodeURIComponent(`点击以下链接加入我们的旅行账单：\n${document.getElementById('shareLink').value}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
}

function copyLink() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    document.execCommand('copy');
    showMessage('链接已复制到剪贴板', 'success');
}

// ==================== 消息提示 ====================
function showMessage(content, type = 'info') {
    // 使用 TDesign 的 Message 组件
    if (window.tdesign) {
        tdesign.MessagePlugin({
            content,
            theme: type,
            duration: 3000
        });
    } else {
        alert(content);
    }
}

// ==================== 本地存储 ====================
function saveToStorage() {
    localStorage.setItem('travelExpenseData', JSON.stringify(travelData));
}

function loadFromStorage() {
    const saved = localStorage.getItem('travelExpenseData');
    if (saved) {
        travelData = JSON.parse(saved);
        
        // 更新表单
        document.getElementById('travelName').value = travelData.name;
        document.getElementById('startDate').value = travelData.startDate;
        document.getElementById('endDate').value = travelData.endDate;
        
        // 更新 UI
        updateMembersList();
        updateExpensePayerSelect();
        updateExpenseMembersCheckboxes();
        updateExpenseList();
        
        if (travelData.name) {
            document.getElementById('currentTravelCard').style.display = 'block';
            updateCurrentTravelInfo();
        }
    }
}

// ==================== 工具函数 ====================
/**
 * 解决 PDF 中文乱码问题的说明
 * 
 * 问题原因：
 * 1. jsPDF 默认使用的是标准的 14 种 PDF 字体，这些字体不支持中文字符
 * 2. 直接使用 jsPDF.text() 方法输出中文时，字符会被替换为乱码或空白
 * 
 * 解决方案：
 * 1. 使用 html2canvas 将 DOM 元素渲染为 canvas 图片
 * 2. 将 canvas 转换为 PNG 图片数据
 * 3. 使用 jsPDF.addImage() 将图片添加到 PDF 中
 * 
 * 优点：
 * - 不需要加载额外的中文字体文件（字体文件通常很大，几 MB）
 * - 保持了原始的样式和布局
 * - 清晰度可以通过 scale 参数控制
 * 
 * 缺点：
 * - 生成的 PDF 文件会比纯文本 PDF 大一些
 * - PDF 中的文字无法复制（因为是图片）
 * 
 * 其他方案对比：
 * 1. 加载中文字体文件 - 文件太大，加载慢
 * 2. 使用纯 CSS 打印 - 无法保存为文件
 * 3. 服务器端生成 PDF - 需要后端支持
 * 
 * 当前方案是最适合前端单页应用的解决方案
 */
