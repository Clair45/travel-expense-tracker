# 云端同步功能说明

## 功能概述

本旅行记账应用现已支持云端实时同步功能，多个用户访问网站时可以实时看到彼此的修改。

## 技术架构

- **前端**: 原生 HTML/CSS/JavaScript
- **后端**: Node.js + Express
- **数据库**: SQLite (持久化存储)
- **实时通信**: Socket.IO
- **容器化**: Docker

## 部署信息

- **服务器IP**: 43.142.23.157
- **访问地址**: http://43.142.23.157
- **API地址**: http://43.142.23.157/api
- **WebSocket地址**: http://43.142.23.157/socket.io

## 数据持久化

数据库文件存储在容器的 `/app/backend/data/expenses.db`，通过Docker卷映射到服务器的 `/root/travel-expense-data` 目录，确保数据不会因容器重启而丢失。

## 使用场景

### 1. 多人协作记账
- A用户创建旅行并添加成员
- B用户访问网站可以看到A创建的旅行
- A或B添加账单后，双方都能实时看到更新

### 2. 实时同步
- 所有操作（创建旅行、添加成员、添加账单、删除等）都会实时同步
- 使用Socket.IO实现WebSocket长连接
- 数据变化后自动推送到所有在线客户端

### 3. 数据备份
- 数据存储在服务器的SQLite数据库中
- 即使浏览器清除缓存，数据也不会丢失
- 多个设备可以同时访问同一旅行数据

## API接口

### 旅行管理
- `GET /api/travels` - 获取所有旅行
- `GET /api/travels/:id` - 获取单个旅行详情
- `POST /api/travels` - 创建旅行
- `PUT /api/travels/:id` - 更新旅行
- `DELETE /api/travels/:id` - 删除旅行

### 成员管理
- `POST /api/travels/:id/members` - 添加成员
- `DELETE /api/travels/:id/members/:member` - 删除成员

### 账单管理
- `POST /api/travels/:id/expenses` - 添加账单
- `PUT /api/expenses/:id` - 更新账单
- `DELETE /api/expenses/:id` - 删除账单

### 汇率管理
- `POST /api/travels/:id/rates` - 设置汇率

## WebSocket事件

### 客户端发送
- `join-travel` - 加入旅行房间
- `leave-travel` - 离开旅行房间

### 服务端推送
- `travel-created` - 旅行创建事件
- `travel-updated` - 旅行更新事件
- `travel-deleted` - 旅行删除事件

## 本地存储策略

应用采用"云端优先"策略：
1. 首次加载时从云端获取数据
2. 操作时同步到云端
3. 云端同步成功后更新本地存储
4. 如果云端不可用，降级使用本地存储
5. 定期将本地数据同步到云端

## 安全说明

- 当前版本未实现用户认证
- 所有用户共享同一数据库
- 生产环境建议添加用户认证和权限控制
- 建议设置API密钥或OAuth认证

## 未来优化方向

1. **用户认证**: 添加登录/注册功能
2. **权限控制**: 实现旅行成员权限管理
3. **数据加密**: 敏感数据加密存储
4. **操作日志**: 记录所有操作历史
5. **冲突解决**: 处理多用户同时编辑的冲突
6. **离线支持**: PWA功能，支持离线使用
7. **推送通知**: 重要操作推送通知
