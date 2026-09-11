/**
 * 料件管理系統 - 資料存取層 (無限制層級分類樹與專業電子料件架構)
 */

const STORAGE_KEYS_V2 = {
  CATEGORIES: 'AGY_CATEGORIES_TREE_V2',
  PARTS: 'AGY_PARTS_V2',
  TRANSACTIONS: 'AGY_TRANSACTIONS_V2'
};

const PartStore = {
  // 初始化系統
  init() {
    const storedCat = localStorage.getItem(STORAGE_KEYS_V2.CATEGORIES);
    const storedParts = localStorage.getItem(STORAGE_KEYS_V2.PARTS);

    if (!storedCat) {
      this.saveCategories(INITIAL_CATEGORY_TREE);
    }
    if (!storedParts) {
      this.saveParts(INITIAL_PARTS_SEED);
    }
    if (!localStorage.getItem(STORAGE_KEYS_V2.TRANSACTIONS)) {
      this.initDefaultTransactions();
    }
  },

  // 預設交易歷史紀錄
  initDefaultTransactions() {
    const defaultTx = [
      {
        id: 'tx-init-1',
        partId: 'p-crys-4',
        partNo: 'FC-135 32.768K-60AA70KDB',
        partName: '32.768 kHz 12.5pF/20 (Epson)',
        categoryPath: '零件 / 14(震盪器)',
        targetField: 'stock',
        type: '入庫',
        reason: '採購入庫',
        quantity: 612,
        balanceAfter: '612',
        operator: '王倉管',
        docNo: 'IN-20260401-001',
        notes: '採購訂單 PO-2026-0331 到貨入庫',
        timestamp: '2026-04-01T09:30:00.000Z'
      },
      {
        id: 'tx-init-2',
        partId: 'p-crys-8',
        partNo: 'CSTCR6M00G53Z-R0',
        partName: '6MHz (Murata)',
        categoryPath: '零件 / 14(震盪器)',
        targetField: 'stock',
        type: '入庫',
        reason: '原廠大批進貨',
        quantity: 3000,
        balanceAfter: '3,000',
        operator: '李組長',
        docNo: 'IN-20260405-002',
        notes: 'Avnet 原裝封裝箱入庫',
        timestamp: '2026-04-05T14:20:00.000Z'
      },
      {
        id: 'tx-init-3',
        partId: 'p-rtk-2',
        partNo: 'PRD-RTK-ROVER-M1',
        partName: '手持三防 RTK 移動測量終端',
        categoryPath: '產品 / RTK / 手持移動站',
        targetField: 'stock',
        type: '出庫',
        reason: '客戶展示借調',
        quantity: 2,
        balanceAfter: '3',
        operator: '陳工程師',
        docNo: 'OUT-20260410-003',
        notes: '測繪專案外場實測領料',
        timestamp: '2026-04-10T11:00:00.000Z'
      }
    ];
    this.saveTransactions(defaultTx);
  },

  // ==========================================
  // 分類樹操作 (Category Tree Operations)
  // ==========================================
  getCategories() {
    const raw = localStorage.getItem(STORAGE_KEYS_V2.CATEGORIES);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(INITIAL_CATEGORY_TREE));
  },

  saveCategories(tree) {
    localStorage.setItem(STORAGE_KEYS_V2.CATEGORIES, JSON.stringify(tree));
  },

  findNode(tree, id) {
    for (const node of tree) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = this.findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  },

  findParent(tree, id) {
    for (const node of tree) {
      if (node.children && node.children.some(c => c.id === id)) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = this.findParent(node.children, id);
        if (found) return found;
      }
    }
    return null;
  },

  toggleCategory(id) {
    const tree = this.getCategories();
    const node = this.findNode(tree, id);
    if (node) {
      node.isOpen = !node.isOpen;
      this.saveCategories(tree);
    }
    return node;
  },

  setAllCategoryOpen(isOpen) {
    const tree = this.getCategories();
    const recurse = (nodes) => {
      nodes.forEach(n => {
        n.isOpen = isOpen;
        if (n.children) recurse(n.children);
      });
    };
    recurse(tree);
    this.saveCategories(tree);
  },

  // 檢查是否所有節點目前皆處於展開狀態
  isAllCategoryOpen() {
    const tree = this.getCategories();
    let allOpen = true;
    const recurse = (nodes) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          if (!n.isOpen) {
            allOpen = false;
            return;
          }
          recurse(n.children);
        }
      }
    };
    recurse(tree);
    return allOpen;
  },

  // 新增單一分類
  addCategory(parentId, name, code = '') {
    const tree = this.getCategories();
    const cleanName = name.trim();
    if (!cleanName) throw new Error('分類名稱不可為空！');

    const newNode = {
      id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      code: code ? code.trim() : cleanName.slice(0, 4).toUpperCase(),
      parentId: parentId || null,
      isOpen: true,
      children: []
    };

    if (!parentId) {
      tree.push(newNode);
    } else {
      const parent = this.findNode(tree, parentId);
      if (!parent) throw new Error('指定的父分類不存在！');
      if (!parent.children) parent.children = [];
      parent.children.push(newNode);
      parent.isOpen = true;
    }

    this.saveCategories(tree);
    return newNode;
  },

  // 同時新增項目及其子項目 (支援一次新增父項目 + 多個子項目)
  addCategoryWithChildren(targetParentId, categoryName, subCategoriesRawText) {
    const tree = this.getCategories();
    const cleanCatName = categoryName ? categoryName.trim() : '';

    // 解析子項目文字 (換行或逗號)
    const subNames = subCategoriesRawText
      ? subCategoriesRawText.split(/[\r\n,，]+/).map(s => s.trim()).filter(s => s.length > 0)
      : [];

    if (!cleanCatName && subNames.length === 0) {
      throw new Error('請至少輸入項目名稱或子項目名稱！');
    }

    let createdPrimaryNode = null;
    let targetList;

    if (cleanCatName) {
      // 1. 建立當前主要項目
      createdPrimaryNode = {
        id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanCatName,
        code: cleanCatName.slice(0, 4).toUpperCase(),
        parentId: targetParentId || null,
        isOpen: true,
        children: []
      };

      if (!targetParentId) {
        tree.push(createdPrimaryNode);
      } else {
        const parent = this.findNode(tree, targetParentId);
        if (!parent) throw new Error('指定的父分類不存在！');
        if (!parent.children) parent.children = [];
        parent.children.push(createdPrimaryNode);
        parent.isOpen = true;
      }

      // 接下來的子項目要掛在剛建立的 primaryNode 下
      targetList = createdPrimaryNode.children;
    } else {
      // 若未填主項目名稱，則子項目直接掛在 targetParentId 下 (相容純批量新增子項)
      if (!targetParentId) {
        targetList = tree;
      } else {
        const parent = this.findNode(tree, targetParentId);
        if (!parent) throw new Error('指定的父分類不存在！');
        if (!parent.children) parent.children = [];
        targetList = parent.children;
        parent.isOpen = true;
      }
    }

    // 2. 批量建立子項目
    const createdSubs = [];
    subNames.forEach((name, idx) => {
      const subNode = {
        id: `cat-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        name: name,
        code: name.slice(0, 4).toUpperCase(),
        parentId: createdPrimaryNode ? createdPrimaryNode.id : (targetParentId || null),
        isOpen: true,
        children: []
      };
      targetList.push(subNode);
      createdSubs.push(subNode);
    });

    this.saveCategories(tree);
    return {
      primary: createdPrimaryNode,
      subs: createdSubs,
      totalCreated: (createdPrimaryNode ? 1 : 0) + createdSubs.length
    };
  },

  updateCategory(id, newName) {
    const tree = this.getCategories();
    const node = this.findNode(tree, id);
    if (!node) throw new Error('找不到該分類項目！');
    node.name = newName.trim();
    this.saveCategories(tree);
    this.syncAllPartCategoryPaths();
    return node;
  },

  deleteCategory(id) {
    const tree = this.getCategories();
    const parent = this.findParent(tree, id);

    if (parent) {
      parent.children = parent.children.filter(c => c.id !== id);
    } else {
      const index = tree.findIndex(n => n.id === id);
      if (index !== -1) tree.splice(index, 1);
    }

    this.saveCategories(tree);
  },

  getCategoryPath(id) {
    const tree = this.getCategories();
    const path = [];
    let currentId = id;

    while (currentId) {
      const node = this.findNode(tree, currentId);
      if (!node) break;
      path.unshift(node.name);
      currentId = node.parentId;
    }

    return path.join(' / ');
  },

  getAllDescendantIds(id) {
    const tree = this.getCategories();
    const rootNode = this.findNode(tree, id);
    if (!rootNode) return [id];

    const ids = [];
    const traverse = (node) => {
      ids.push(node.id);
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse);
      }
    };
    traverse(rootNode);
    return ids;
  },

  syncAllPartCategoryPaths() {
    const parts = this.getParts();
    parts.forEach(p => {
      if (p.categoryId) {
        p.categoryPath = this.getCategoryPath(p.categoryId) || p.categoryPath;
      }
    });
    this.saveParts(parts);
  },

  // ==========================================
  // 料件資料操作 (所有項目皆非必填)
  // ==========================================
  getParts() {
    const raw = localStorage.getItem(STORAGE_KEYS_V2.PARTS);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(INITIAL_PARTS_SEED));
  },

  saveParts(parts) {
    localStorage.setItem(STORAGE_KEYS_V2.PARTS, JSON.stringify(parts));
  },

  getPartById(id) {
    const parts = this.getParts();
    return parts.find(p => p.id === id) || null;
  },

  // 新增料件主檔 (無任何必填欄位，留空自動給予預設值或留空)
  addPart(data) {
    const parts = this.getParts();
    const catPath = data.categoryId ? this.getCategoryPath(data.categoryId) : '未指定分類';

    const newPart = {
      id: `part-${Date.now()}`,
      categoryId: data.categoryId || '',
      categoryPath: catPath,
      group: data.group ? data.group.trim() : '',
      type: data.type ? data.type.trim() : '',
      item: data.item ? data.item.trim() : '',
      class: data.class ? data.class.trim() : '',
      valueName: data.valueName ? data.valueName.trim() : (data.mpn || data.item || '未命名料件'),
      toleranceType: data.toleranceType ? data.toleranceType.trim() : '',
      footprint: data.footprint ? data.footprint.trim() : '',
      manufacturer: data.manufacturer ? data.manufacturer.trim() : '',
      mpn: data.mpn ? data.mpn.trim() : '',
      vendor: data.vendor ? data.vendor.trim() : '',
      sample: data.sample !== undefined && data.sample !== '' ? String(data.sample).trim() : '0',
      stock: data.stock !== undefined && data.stock !== '' ? String(data.stock).trim() : '0',
      moq: data.moq ? String(data.moq).trim() : '',
      unitPriceTwd: data.unitPriceTwd ? String(data.unitPriceTwd).trim() : '',
      unitPriceUsd: data.unitPriceUsd ? String(data.unitPriceUsd).trim() : '',
      substitute: data.substitute ? data.substitute.trim() : '',
      date: data.date || new Date().toISOString().slice(0, 10),
      location: data.location ? data.location.trim() : '',
      safetyStock: Number(data.safetyStock) || 0,
      updatedAt: new Date().toISOString()
    };

    parts.unshift(newPart);
    this.saveParts(parts);
    return newPart;
  },

  updatePart(id, updatedFields) {
    const parts = this.getParts();
    const index = parts.findIndex(p => p.id === id);
    if (index === -1) throw new Error('找不到該料件項目！');

    if (updatedFields.categoryId) {
      updatedFields.categoryPath = this.getCategoryPath(updatedFields.categoryId);
    }

    parts[index] = {
      ...parts[index],
      ...updatedFields,
      updatedAt: new Date().toISOString()
    };

    this.saveParts(parts);
    return parts[index];
  },

  deletePart(id) {
    const parts = this.getParts().filter(p => p.id !== id);
    this.saveParts(parts);
  },

  // ==========================================
  // 出入庫交易
  // ==========================================
  getTransactions() {
    const raw = localStorage.getItem(STORAGE_KEYS_V2.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  },

  saveTransactions(txs) {
    localStorage.setItem(STORAGE_KEYS_V2.TRANSACTIONS, JSON.stringify(txs));
  },

  executeTransaction({ partId, targetField = 'stock', type, reason, quantity, operator, docNo, notes }) {
    const parts = this.getParts();
    const part = parts.find(p => p.id === partId);
    if (!part) throw new Error('指定料件不存在！');

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('交易數量必須為大於 0 的正數！');
    }

    const currentValStr = part[targetField] || '0';
    const currentNum = parseStockFormula(currentValStr);

    let nextNum;
    if (type === '出庫') {
      if (qty > currentNum) {
        const fieldName = targetField === 'sample' ? '樣品庫存 (Sample)' : '量產庫存 (Stock)';
        throw new Error(`庫存不足！當前 ${fieldName} 僅剩 ${currentNum}，無法出庫 ${qty}。`);
      }
      nextNum = currentNum - qty;
    } else if (type === '入庫') {
      nextNum = currentNum + qty;
    } else {
      throw new Error('未知的作業類型：' + type);
    }

    part[targetField] = nextNum.toLocaleString();
    part.updatedAt = new Date().toISOString();
    this.saveParts(parts);

    const todayPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const actualDocNo = docNo && docNo.trim()
      ? docNo.trim()
      : `${type === '入庫' ? 'IN' : 'OUT'}-${todayPrefix}-${Math.floor(100 + Math.random() * 900)}`;

    const txRecord = {
      id: `tx-${Date.now()}`,
      partId: part.id,
      partNo: part.mpn || `Item-${part.item || '0'}`,
      partName: `${part.valueName || '料件'} (${part.manufacturer || part.class || '-'})`,
      categoryPath: part.categoryPath,
      targetField: targetField,
      type: type,
      reason: reason || (type === '入庫' ? '一般入庫' : '工程領料'),
      quantity: qty,
      balanceAfter: part[targetField],
      operator: operator || '現場人員',
      docNo: actualDocNo,
      notes: notes ? notes.trim() : '',
      timestamp: new Date().toISOString()
    };

    const txList = this.getTransactions();
    txList.unshift(txRecord);
    if (txList.length > 500) txList.pop();
    this.saveTransactions(txList);

    return { part, txRecord };
  },

  resetToMockData() {
    this.saveCategories(JSON.parse(JSON.stringify(INITIAL_CATEGORY_TREE)));
    const randomizedParts = generateRandomizedParts(INITIAL_PARTS_SEED);
    this.saveParts(randomizedParts);
    this.initDefaultTransactions();
    return { categories: this.getCategories(), parts: randomizedParts };
  },

  getMetrics() {
    const parts = this.getParts();
    const txs = this.getTransactions();
    const tree = this.getCategories();

    let lowStockCount = 0;
    parts.forEach(p => {
      const stockNum = parseStockFormula(p.stock);
      const sampleNum = parseStockFormula(p.sample);
      const totalAvailable = stockNum + sampleNum;
      if (p.safetyStock > 0 && totalAvailable <= p.safetyStock) {
        lowStockCount++;
      }
    });

    let categoryCount = 0;
    const countNodes = (nodes) => {
      categoryCount += nodes.length;
      nodes.forEach(n => {
        if (n.children) countNodes(n.children);
      });
    };
    countNodes(tree);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxCount = txs.filter(t => t.timestamp && t.timestamp.startsWith(todayStr)).length;

    return {
      lowStockCount,
      todayTxCount,
      categoryCount,
      totalPartsCount: parts.length
    };
  }
};
