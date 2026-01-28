const Database = require('better-sqlite3');
const path = require('path');

class ExpenseDatabase {
  constructor() {
    const dbPath = path.join(__dirname, 'expenses.db');
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    // 创建旅行表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS travels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建成员表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        travel_id TEXT NOT NULL,
        member TEXT NOT NULL,
        FOREIGN KEY (travel_id) REFERENCES travels(id) ON DELETE CASCADE
      )
    `);

    // 创建账单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        travel_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        amount_cny REAL NOT NULL,
        rate REAL NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        payer TEXT NOT NULL,
        participants TEXT NOT NULL,
        split_mode TEXT NOT NULL,
        splits TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (travel_id) REFERENCES travels(id) ON DELETE CASCADE
      )
    `);

    // 创建汇率表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        travel_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        rate REAL NOT NULL,
        FOREIGN KEY (travel_id) REFERENCES travels(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_expenses_travel_id ON expenses(travel_id);
      CREATE INDEX IF NOT EXISTS idx_members_travel_id ON members(travel_id);
      CREATE INDEX IF NOT EXISTS idx_exchange_rates_travel_id ON exchange_rates(travel_id);
    `);

    console.log('数据库初始化完成');
  }

  // 旅行操作
  async createTravel(travel) {
    const stmt = this.db.prepare(`
      INSERT INTO travels (id, name, start_date, end_date)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(travel.id, travel.name, travel.startDate, travel.endDate);
    return this.getTravel(travel.id);
  }

  async getTravel(travelId) {
    const stmt = this.db.prepare('SELECT * FROM travels WHERE id = ?');
    const travel = stmt.get(travelId);
    if (!travel) return null;

    // 获取成员
    const membersStmt = this.db.prepare('SELECT member FROM members WHERE travel_id = ?');
    const members = membersStmt.all(travelId).map(m => m.member);

    // 获取账单
    const expensesStmt = this.db.prepare('SELECT * FROM expenses WHERE travel_id = ? ORDER BY date DESC');
    const expenses = expensesStmt.all(travelId).map(e => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency,
      amountCNY: e.amount_cny,
      rate: e.rate,
      description: e.description,
      category: e.category,
      payer: e.payer,
      participants: JSON.parse(e.participants),
      splitMode: e.split_mode,
      splits: JSON.parse(e.splits),
      date: e.date
    }));

    // 获取汇率
    const ratesStmt = this.db.prepare('SELECT currency, rate FROM exchange_rates WHERE travel_id = ?');
    const ratesList = ratesStmt.all(travelId);
    const exchangeRates = { CNY: 1 };
    ratesList.forEach(r => {
      exchangeRates[r.currency] = r.rate;
    });

    return {
      id: travel.id,
      name: travel.name,
      startDate: travel.start_date,
      endDate: travel.end_date,
      createdAt: travel.created_at,
      updatedAt: travel.updated_at,
      members,
      expenses,
      exchangeRates
    };
  }

  async getAllTravels() {
    const stmt = this.db.prepare('SELECT id FROM travels ORDER BY created_at DESC');
    const travelIds = stmt.all();
    const travels = [];
    for (const row of travelIds) {
      const travel = await this.getTravel(row.id);
      if (travel) travels.push(travel);
    }
    return travels;
  }

  async updateTravel(travelId, updates) {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.startDate !== undefined) {
      fields.push('start_date = ?');
      values.push(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      fields.push('end_date = ?');
      values.push(updates.endDate);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(travelId);

    const stmt = this.db.prepare(`
      UPDATE travels SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
    return this.getTravel(travelId);
  }

  async deleteTravel(travelId) {
    this.db.prepare('DELETE FROM travels WHERE id = ?').run(travelId);
    return { success: true };
  }

  // 成员操作
  async addMember(travelId, member) {
    const stmt = this.db.prepare('INSERT INTO members (travel_id, member) VALUES (?, ?)');
    stmt.run(travelId, member);
    return this.getTravel(travelId);
  }

  async removeMember(travelId, member) {
    const stmt = this.db.prepare('DELETE FROM members WHERE travel_id = ? AND member = ?');
    stmt.run(travelId, member);
    return this.getTravel(travelId);
  }

  // 账单操作
  async addExpense(travelId, expense) {
    const stmt = this.db.prepare(`
      INSERT INTO expenses (
        id, travel_id, amount, currency, amount_cny, rate,
        description, category, payer, participants, split_mode, splits
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      expense.id,
      travelId,
      expense.amount,
      expense.currency,
      expense.amountCNY,
      expense.rate,
      expense.description,
      expense.category,
      expense.payer,
      JSON.stringify(expense.participants),
      expense.splitMode,
      JSON.stringify(expense.splits)
    );
    return this.getTravel(travelId);
  }

  async updateExpense(expenseId, updates) {
    const fields = [];
    const values = [];

    if (updates.amount !== undefined) {
      fields.push('amount = ?');
      values.push(updates.amount);
    }
    if (updates.currency !== undefined) {
      fields.push('currency = ?');
      values.push(updates.currency);
    }
    if (updates.amountCNY !== undefined) {
      fields.push('amount_cny = ?');
      values.push(updates.amountCNY);
    }
    if (updates.rate !== undefined) {
      fields.push('rate = ?');
      values.push(updates.rate);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.payer !== undefined) {
      fields.push('payer = ?');
      values.push(updates.payer);
    }
    if (updates.participants !== undefined) {
      fields.push('participants = ?');
      values.push(JSON.stringify(updates.participants));
    }
    if (updates.splitMode !== undefined) {
      fields.push('split_mode = ?');
      values.push(updates.splitMode);
    }
    if (updates.splits !== undefined) {
      fields.push('splits = ?');
      values.push(JSON.stringify(updates.splits));
    }

    values.push(expenseId);

    const stmt = this.db.prepare(`
      UPDATE expenses SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    // 获取账单所属的旅行ID
    const travelStmt = this.db.prepare('SELECT travel_id FROM expenses WHERE id = ?');
    const result = travelStmt.get(expenseId);
    if (result) {
      return this.getTravel(result.travel_id);
    }
    return null;
  }

  async deleteExpense(expenseId) {
    const stmt = this.db.prepare('SELECT travel_id FROM expenses WHERE id = ?');
    const result = stmt.get(expenseId);
    const travelId = result ? result.travel_id : null;

    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);

    if (travelId) {
      return this.getTravel(travelId);
    }
    return null;
  }

  // 汇率操作
  async setExchangeRate(travelId, currency, rate) {
    const checkStmt = this.db.prepare('SELECT id FROM exchange_rates WHERE travel_id = ? AND currency = ?');
    const exists = checkStmt.get(travelId, currency);

    if (exists) {
      const stmt = this.db.prepare('UPDATE exchange_rates SET rate = ? WHERE travel_id = ? AND currency = ?');
      stmt.run(rate, travelId, currency);
    } else {
      const stmt = this.db.prepare('INSERT INTO exchange_rates (travel_id, currency, rate) VALUES (?, ?, ?)');
      stmt.run(travelId, currency, rate);
    }

    return this.getTravel(travelId);
  }

  close() {
    this.db.close();
  }
}

module.exports = ExpenseDatabase;
