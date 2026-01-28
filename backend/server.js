const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('./database');
const apiRoutes = require('./routes/api')(new Database());

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// 初始化数据库
const db = new Database();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 将 io 实例附加到 app
app.set('io', io);

// 路由
app.use('/api', apiRoutes);

// Socket.IO 连接管理
io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);

  // 加入旅行房间
  socket.on('join-travel', (travelId) => {
    socket.join(`travel-${travelId}`);
    console.log(`客户端 ${socket.id} 加入旅行 ${travelId}`);
  });

  // 离开旅行房间
  socket.on('leave-travel', (travelId) => {
    socket.leave(`travel-${travelId}`);
    console.log(`客户端 ${socket.id} 离开旅行 ${travelId}`);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('客户端断开连接:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
});

module.exports = { app, io };
