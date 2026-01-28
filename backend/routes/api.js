const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // 获取所有旅行
  router.get('/travels', async (req, res) => {
    try {
      const travels = await db.getAllTravels();
      res.json({ success: true, data: travels });
    } catch (error) {
      console.error('获取旅行列表失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取单个旅行
  router.get('/travels/:id', async (req, res) => {
    try {
      const travel = await db.getTravel(req.params.id);
      if (!travel) {
        return res.status(404).json({ success: false, error: '旅行不存在' });
      }
      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('获取旅行失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 创建旅行
  router.post('/travels', async (req, res) => {
    try {
      const { id, name, startDate, endDate, members } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: '旅行名称不能为空' });
      }

      // 创建旅行
      await db.createTravel({ id, name, startDate, endDate });

      // 添加成员
      if (members && members.length > 0) {
        for (const member of members) {
          await db.addMember(id, member);
        }
      }

      const travel = await db.getTravel(id);

      // 通知所有客户端
      const io = req.app.get('io');
      io.emit('travel-created', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('创建旅行失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 更新旅行
  router.put('/travels/:id', async (req, res) => {
    try {
      const travel = await db.updateTravel(req.params.id, req.body);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      io.to(`travel-${req.params.id}`).emit('travel-updated', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('更新旅行失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 删除旅行
  router.delete('/travels/:id', async (req, res) => {
    try {
      await db.deleteTravel(req.params.id);

      // 通知所有客户端
      const io = req.app.get('io');
      io.emit('travel-deleted', { id: req.params.id });

      res.json({ success: true, message: '旅行已删除' });
    } catch (error) {
      console.error('删除旅行失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 添加成员
  router.post('/travels/:id/members', async (req, res) => {
    try {
      const { member } = req.body;
      if (!member) {
        return res.status(400).json({ success: false, error: '成员不能为空' });
      }

      const travel = await db.addMember(req.params.id, member);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      io.to(`travel-${req.params.id}`).emit('travel-updated', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('添加成员失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 删除成员
  router.delete('/travels/:id/members/:member', async (req, res) => {
    try {
      const travel = await db.removeMember(req.params.id, req.params.member);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      io.to(`travel-${req.params.id}`).emit('travel-updated', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('删除成员失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 添加账单
  router.post('/travels/:id/expenses', async (req, res) => {
    try {
      const travel = await db.addExpense(req.params.id, req.body);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      io.to(`travel-${req.params.id}`).emit('travel-updated', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('添加账单失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 更新账单
  router.put('/expenses/:id', async (req, res) => {
    try {
      const travel = await db.updateExpense(req.params.id, req.body);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      io.to(`travel-${travel.id}`).emit('travel-updated', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('更新账单失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 删除账单
  router.delete('/expenses/:id', async (req, res) => {
    try {
      const travel = await db.deleteExpense(req.params.id);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      if (travel) {
        io.to(`travel-${travel.id}`).emit('travel-updated', travel);
      }

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('删除账单失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 设置汇率
  router.post('/travels/:id/rates', async (req, res) => {
    try {
      const { currency, rate } = req.body;
      if (!currency || rate === undefined) {
        return res.status(400).json({ success: false, error: '货币和汇率不能为空' });
      }

      const travel = await db.setExchangeRate(req.params.id, currency, rate);

      // 通知旅行房间的客户端
      const io = req.app.get('io');
      io.to(`travel-${req.params.id}`).emit('travel-updated', travel);

      res.json({ success: true, data: travel });
    } catch (error) {
      console.error('设置汇率失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};
