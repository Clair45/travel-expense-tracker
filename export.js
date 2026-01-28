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
        pageTitle.innerHTML = `<i class="fas fa-file-export"></i> ${currentTravel.name} - 导出`;
    }
    
    // 填充结算预览
    fillPreview();
}

// ==================== 页面跳转 ====================
function goBack() {
    window.location.href = 'index.html';
}

function goToPage(page) {
    window.location.href = page;
}

// ==================== 填充预览 ====================
function fillPreview() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent || !currentTravel) return;

    const expenses = currentTravel.expenses;
    const members = currentTravel.members;

    // 计算数据
    const { shouldPay, hasPaid, netAmounts, debts } = calculateSettlementData();
    const totalAmount = expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    const perPersonAmount = members.length > 0 ? totalAmount / members.length : 0;
    
    // 计算分类统计
    const categoryStats = calculateCategoryStats();

    // 生成预览HTML
    previewContent.innerHTML = `
        <div id="settlementPreview" style="background: white; padding: 30px; border-radius: 12px; border: 2px solid #ccfbf1;">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0d9488;">
                <h1 style="color: #0d9488; margin: 0 0 10px 0; font-size: 1.8rem;">${currentTravel.name} - 结算报告</h1>
                <p style="color: #6b7280; margin: 0;">${currentTravel.startDate} ~ ${currentTravel.endDate}</p>
                <p style="color: #6b7280; margin: 5px 0 0 0;">参与成员：${members.join(', ')}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
                <div style="background: #f0fdfa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #ccfbf1;">
                    <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 8px;">总消费</div>
                    <div style="color: #0d9488; font-size: 1.8rem; font-weight: 700;">¥${totalAmount.toFixed(2)}</div>
                </div>
                <div style="background: #f0fdfa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #ccfbf1;">
                    <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 8px;">账单数</div>
                    <div style="color: #0d9488; font-size: 1.8rem; font-weight: 700;">${expenses.length}</div>
                </div>
                <div style="background: #f0fdfa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #ccfbf1;">
                    <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 8px;">人均消费</div>
                    <div style="color: #0d9488; font-size: 1.8rem; font-weight: 700;">¥${perPersonAmount.toFixed(2)}</div>
                </div>
            </div>

            <h3 style="color: #0d9488; margin: 0 0 15px 0; font-size: 1.3rem; border-left: 4px solid #0d9488; padding-left: 12px;">分类统计</h3>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 30px;">
                ${renderCategoryStatsHTML(categoryStats)}
            </div>

            <h3 style="color: #0d9488; margin: 0 0 15px 0; font-size: 1.3rem; border-left: 4px solid #0d9488; padding-left: 12px;">成员结算</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: #f0fdfa; border-radius: 10px; overflow: hidden;">
                <thead>
                    <tr style="background: #0d9488; color: white;">
                        <th style="padding: 12px; text-align: left;">成员</th>
                        <th style="padding: 12px; text-align: right;">实际支付</th>
                        <th style="padding: 12px; text-align: right;">应付金额</th>
                        <th style="padding: 12px; text-align: right;">余额</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(member => {
                        const netAmount = netAmounts[member] || 0;
                        const netClass = netAmount > 0 ? 'color: #10b981;' : (netAmount < 0 ? 'color: #ef4444;' : 'color: #6b7280;');
                        const netText = netAmount > 0 ? `+¥${netAmount.toFixed(2)}` : (netAmount < 0 ? `-¥${Math.abs(netAmount).toFixed(2)}` : '¥0.00');
                        const netLabel = netAmount > 0 ? '(应收)' : (netAmount < 0 ? '(应付)' : '(持平)');

                        return `
                            <tr style="border-bottom: 1px solid #ccfbf1;">
                                <td style="padding: 12px;">${member}</td>
                                <td style="padding: 12px; text-align: right;">¥${(hasPaid[member] || 0).toFixed(2)}</td>
                                <td style="padding: 12px; text-align: right;">¥${(shouldPay[member] || 0).toFixed(2)}</td>
                                <td style="padding: 12px; text-align: right; ${netClass} font-weight: 700;">${netText} ${netLabel}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            ${debts.length > 0 ? `
                <h3 style="color: #0d9488; margin: 0 0 15px 0; font-size: 1.3rem; border-left: 4px solid #0d9488; padding-left: 12px;">结算建议</h3>
                <div style="background: #fef3c7; padding: 20px; border-radius: 10px; border: 2px solid #fcd34d;">
                    ${debts.map(debt => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #fcd34d;">
                            <span style="color: #92400e; font-weight: 600;">${debt.from}</span>
                            <span style="display: flex; align-items: center; gap: 10px; color: #6b7280;">
                                <i class="fas fa-arrow-right"></i>
                                <span style="color: #0d9488; font-weight: 700; font-size: 1.1rem;">¥${debt.amount.toFixed(2)}</span>
                            </span>
                            <span style="color: #065f46; font-weight: 600;">${debt.to}</span>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="background: #d1fae5; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #6ee7b7;">
                    <i class="fas fa-check-circle" style="color: #065f46; font-size: 2rem; margin-bottom: 10px;"></i>
                    <div style="color: #065f46; font-weight: 600; font-size: 1.2rem;">所有成员已结清</div>
                </div>
            `}

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px dashed #ccfbf1; color: #999; font-size: 0.85rem;">
                此报告由旅行记账AA自动生成 • ${new Date().toLocaleDateString('zh-CN')}
            </div>
        </div>
    `;

    // 显示预览区域
    document.getElementById('previewCard').style.display = 'block';
}

// 计算分类统计
function calculateCategoryStats() {
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
    
    currentTravel.expenses.forEach(expense => {
        const mappedCategory = categoryMap[expense.category] || '其他';
        if (!categoryTotals[mappedCategory]) {
            categoryTotals[mappedCategory] = 0;
        }
        categoryTotals[mappedCategory] += expense.amountCNY;
    });
    
    return categoryTotals;
}

// 渲染分类统计HTML
function renderCategoryStatsHTML(categoryStats) {
    const categoryColors = {
        '交通': '#3b82f6',
        '住宿': '#f59e0b',
        '餐饮': '#10b981',
        '购物': '#ec4899',
        '其他': '#8b5cf6'
    };
    
    const categoryIcons = {
        '交通': 'fas fa-car',
        '住宿': 'fas fa-hotel',
        '餐饮': 'fas fa-utensils',
        '购物': 'fas fa-shopping-bag',
        '其他': 'fas fa-ellipsis-h'
    };
    
    const categoryOrder = ['交通', '住宿', '餐饮', '购物', '其他'];
    
    return categoryOrder.map(category => {
        const amount = categoryStats[category] || 0;
        const color = categoryColors[category];
        const icon = categoryIcons[category];
        
        return `
            <div style="background: ${color}15; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid ${color}33;">
                <i class="${icon}" style="color: ${color}; font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>
                <div style="color: ${color}; font-weight: 600; margin-bottom: 5px;">${category}</div>
                <div style="color: ${color}; font-size: 1.2rem; font-weight: 700;">¥${amount.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

// 计算结算数据
function calculateSettlementData() {
    if (!currentTravel) return { shouldPay: {}, hasPaid: {}, netAmounts: {}, debts: [] };

    const expenses = currentTravel.expenses;
    const members = currentTravel.members;

    // 初始化每人应付和实付
    const shouldPay = {};
    const hasPaid = {};

    members.forEach(member => {
        shouldPay[member] = 0;
        hasPaid[member] = 0;
    });

    // 计算每人的应付和实付
    expenses.forEach(expense => {
        const payer = expense.payer;
        const amount = expense.amountCNY;

        // 实付金额
        if (hasPaid[payer] !== undefined) {
            hasPaid[payer] += amount;
        }

        // 应付金额
        if (expense.splits) {
            Object.entries(expense.splits).forEach(([member, share]) => {
                if (shouldPay[member] !== undefined) {
                    shouldPay[member] += share;
                }
            });
        }
    });

    // 计算净额
    const netAmounts = {};
    members.forEach(member => {
        netAmounts[member] = hasPaid[member] - shouldPay[member];
    });

    // 计算债务关系
    const debts = calculateDebts(netAmounts);

    return { shouldPay, hasPaid, netAmounts, debts };
}

// 计算债务关系
function calculateDebts(netAmounts) {
    const debts = [];

    // 分离债权人和债务人
    const creditors = [];
    const debtors = [];

    Object.entries(netAmounts).forEach(([member, amount]) => {
        if (amount > 0.01) {
            creditors.push({ member, amount });
        } else if (amount < -0.01) {
            debtors.push({ member, amount: -amount });
        }
    });

    // 按金额排序
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // 计算最优债务关系
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];

        const amount = Math.min(creditor.amount, debtor.amount);

        if (amount > 0.01) {
            debts.push({
                from: debtor.member,
                to: creditor.member,
                amount: amount
            });
        }

        creditor.amount -= amount;
        debtor.amount -= amount;

        if (creditor.amount < 0.01) i++;
        if (debtor.amount < 0.01) j++;
    }

    return debts;
}

// ==================== 导出功能 ====================
function exportPDF() {
    const previewContent = document.getElementById('settlementPreview');
    if (!previewContent) return;
    
    showMessage('正在生成PDF...');
    
    html2canvas(previewContent, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const imgWidth = 190; // A4宽度减去边距
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`${currentTravel.name}_结算报告.pdf`);
        
        showMessage('PDF导出成功！');
    }).catch(error => {
        console.error('PDF导出失败:', error);
        showMessage('PDF导出失败，请重试');
    });
}

function exportImage() {
    const previewContent = document.getElementById('settlementPreview');
    if (!previewContent) return;
    
    showMessage('正在生成图片...');
    
    html2canvas(previewContent, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${currentTravel.name}_结算报告.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showMessage('图片导出成功！');
    }).catch(error => {
        console.error('图片导出失败:', error);
        showMessage('图片导出失败，请重试');
    });
}

// ==================== 分享功能 ====================
function openShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function shareToWeChat() {
    showMessage('请使用浏览器分享功能分享到微信');
}

function shareToEmail() {
    const { shouldPay, hasPaid, netAmounts, debts } = calculateSettlementData();
    
    const totalAmount = currentTravel.expenses.reduce((sum, e) => sum + e.amountCNY, 0);
    
    let emailBody = `【${currentTravel.name} - 结算报告】\n\n`;
    emailBody += `旅行日期：${currentTravel.startDate} ~ ${currentTravel.endDate}\n`;
    emailBody += `参与成员：${currentTravel.members.join(', ')}\n`;
    emailBody += `总消费：¥${totalAmount.toFixed(2)}\n\n`;
    emailBody += `【成员结算】\n`;
    
    currentTravel.members.forEach(member => {
        const netAmount = netAmounts[member] || 0;
        if (netAmount > 0.01) {
            emailBody += `${member}：应收 ¥${netAmount.toFixed(2)}\n`;
        } else if (netAmount < -0.01) {
            emailBody += `${member}：应付 ¥${Math.abs(netAmount).toFixed(2)}\n`;
        }
    });
    
    emailBody += `\n【结算建议】\n`;
    debts.forEach(debt => {
        emailBody += `${debt.from} 给 ${debt.to} ¥${debt.amount.toFixed(2)}\n`;
    });
    
    emailBody += `\n此报告由旅行记账AA生成`;
    
    const mailtoLink = `mailto:?subject=${encodeURIComponent(`${currentTravel.name} - 结算报告`)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoLink);
    
    showMessage('已打开邮件客户端');
}

function copyLink() {
    // 生成当前页面的URL
    const url = window.location.href;
    
    navigator.clipboard.writeText(url).then(() => {
        showMessage('链接已复制到剪贴板');
    }).catch(() => {
        showMessage('复制失败，请手动复制');
    });
}

// 点击模态框背景关闭
document.addEventListener('click', function(e) {
    const modal = document.getElementById('shareModal');
    if (modal && modal.classList.contains('active') && e.target === modal) {
        closeShareModal();
    }
});

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
