/**
 * 料件管理系統 - 主控應用邏輯 (無限制層級分類樹與 Excel 規格表格控制)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化資料庫
  PartStore.init();

  // 2. 狀態
  const state = {
    selectedCategoryId: null, // null 表示全部
    stockFilter: 'ALL',       // 'ALL' 或 'LOW_ONLY'
    searchQuery: '',
    currentTab: 'inventory'   // 'inventory' 或 'transactions'
  };

  // DOM 元素快取
  const el = {
    // 狀態列指標
    statLowStock: document.getElementById('stat-low-stock'),
    statTodayTx: document.getElementById('stat-today-tx'),
    statCatNodes: document.getElementById('stat-cat-nodes'),
    quickStockRadios: document.querySelectorAll('input[name="quick_filter_stock"]'),

    // 樹狀目錄
    treeContainer: document.getElementById('tree-container'),
    treeNodeAll: document.getElementById('tree-node-all'),
    badgeAllPartsCount: document.getElementById('badge-all-parts-count'),
    btnToggleTree: document.getElementById('btn-toggle-tree'),
    treeToggleIcon: document.getElementById('tree-toggle-icon'),
    treeToggleText: document.getElementById('tree-toggle-text'),
    btnBatchAddShortcut: document.getElementById('btn-batch-add-shortcut'),

    // 頁籤與搜尋
    tabInventory: document.getElementById('tab-inventory'),
    tabTransactions: document.getElementById('tab-transactions'),
    viewInventory: document.getElementById('view-inventory'),
    viewTransactions: document.getElementById('view-transactions'),
    currentCategoryLabel: document.getElementById('current-category-label'),
    currentCategoryCount: document.getElementById('current-category-count'),
    inputSearch: document.getElementById('input-search'),

    // 操作按鈕 (已集中於品項總表附近)
    btnAddRootCat: document.getElementById('btn-add-root-cat'),
    btnOpenNewPart: document.getElementById('btn-open-new-part'),
    btnOpenTxModal: document.getElementById('btn-open-tx-modal'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnRefreshMock: document.getElementById('btn-refresh-mock'),

    // 表格
    inventoryTableBody: document.getElementById('inventory-table-body'),
    tableSummaryInfo: document.getElementById('table-summary-info'),
    transactionTableBody: document.getElementById('transaction-table-body'),
    txSummaryInfo: document.getElementById('tx-summary-info'),

    // 彈窗 1：新增分類 (可同時新增主要項目及子項目)
    modalBatchCat: document.getElementById('modal-batch-category'),
    formBatchCat: document.getElementById('form-batch-category'),
    batchParentSelect: document.getElementById('batch-parent-select'),
    inputPrimaryCatName: document.getElementById('input-primary-cat-name'),
    batchCategoryNames: document.getElementById('batch-category-names'),

    // 彈窗 2：編輯分類
    modalEditCat: document.getElementById('modal-edit-category'),
    formEditCat: document.getElementById('form-edit-category'),
    editCatId: document.getElementById('edit-cat-id'),
    editCatName: document.getElementById('edit-cat-name'),

    // 彈窗 3：新增料件 (整合直接新增新分類面板)
    modalNewPart: document.getElementById('modal-new-part'),
    formNewPart: document.getElementById('form-new-part'),
    partCategorySelect: document.getElementById('part-category-select'),
    btnToggleInlineCat: document.getElementById('btn-toggle-inline-cat'),
    inlineCatBtnIcon: document.getElementById('inline-cat-btn-icon'),
    inlineCatBtnText: document.getElementById('inline-cat-btn-text'),
    inlineNewCatPanel: document.getElementById('inline-new-cat-panel'),
    btnCloseInlineCat: document.getElementById('btn-close-inline-cat'),
    inlineCatParent: document.getElementById('inline-cat-parent'),
    inlineCatName: document.getElementById('inline-cat-name'),
    inlineCatSubs: document.getElementById('inline-cat-subs'),
    btnApplyInlineCat: document.getElementById('btn-apply-inline-cat'),

    // 彈窗 4：出入庫過帳
    modalTx: document.getElementById('modal-transaction'),
    formTx: document.getElementById('form-transaction'),
    txPartSelect: document.getElementById('tx-part-select'),
    txTargetField: document.getElementById('tx-target-field'),
    txTypeSelect: document.getElementById('tx-type-select'),
    txQty: document.getElementById('tx-qty'),
    txReasonSelect: document.getElementById('tx-reason-select'),
    txCalcAfter: document.getElementById('tx-calc-after'),
    txPreviewMpn: document.getElementById('tx-preview-mpn'),
    txPreviewDesc: document.getElementById('tx-preview-desc'),
    txPreviewStocks: document.getElementById('tx-preview-stocks'),

    toastContainer: document.getElementById('toast-container')
  };

  // Toast 提示
  function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = `px-3.5 py-2.5 rounded-lg text-white text-xs font-semibold shadow-lg transition-all transform flex items-center gap-2 ${
      isError ? 'bg-red-600 border border-red-500' : 'bg-slate-900 border border-slate-700'
    }`;
    toast.innerHTML = `<span>${isError ? '⚠️' : '✅'}</span><span>${msg}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // 更新頂部狀態列
  function updateTopMetrics() {
    const metrics = PartStore.getMetrics();
    el.statLowStock.textContent = `${metrics.lowStockCount} 項`;
    el.statTodayTx.textContent = `${metrics.todayTxCount} 筆`;
    el.statCatNodes.textContent = `${metrics.categoryCount} 個`;
    el.badgeAllPartsCount.textContent = metrics.totalPartsCount;

    syncToggleTreeButtonText();
  }

  function syncToggleTreeButtonText() {
    const isAllOpen = PartStore.isAllCategoryOpen();
    if (isAllOpen) {
      el.treeToggleIcon.textContent = '▼';
      el.treeToggleText.textContent = '全部收合';
    } else {
      el.treeToggleIcon.textContent = '▶';
      el.treeToggleText.textContent = '全部展開';
    }
  }

  // =========================================================
  // 樹狀目錄渲染 (遞迴無限制層級)
  // =========================================================
  function getPartCountForCategory(catId) {
    const parts = PartStore.getParts();
    const descendantIds = PartStore.getAllDescendantIds(catId);
    return parts.filter(p => descendantIds.includes(p.categoryId)).length;
  }

  function renderCategoryTree() {
    const tree = PartStore.getCategories();
    el.treeContainer.innerHTML = '';

    function buildNodeHtml(node, level = 0) {
      const hasChildren = node.children && node.children.length > 0;
      const count = getPartCountForCategory(node.id);
      const isSelected = state.selectedCategoryId === node.id;
      const indentPx = level * 16 + 6;

      const nodeRow = document.createElement('div');
      nodeRow.className = `tree-node-row ${isSelected ? 'active-node' : ''}`;
      nodeRow.style.paddingLeft = `${indentPx}px`;

      nodeRow.innerHTML = `
        <div class="flex items-center gap-1.5 flex-1 min-w-0 py-0.5">
          ${hasChildren ? `
            <span class="tree-toggle-arrow ${node.isOpen ? 'open' : ''}" data-cat-id="${node.id}" title="展開/收合">
              ▶
            </span>
          ` : `
            <span class="w-4 inline-block text-center text-slate-300 text-[10px]">•</span>
          `}
          <span class="truncate font-medium text-slate-700 hover:text-blue-700 flex-1 select-none" data-cat-select="${node.id}">
            ${node.name}
          </span>
          <span class="text-[10px] text-slate-400 font-mono px-1 rounded bg-slate-100">${count}</span>
        </div>
        <div class="tree-node-actions">
          <button class="tree-action-btn btn-tree-add-child" data-parent-id="${node.id}" title="在此分類下新增項目/子項目">➕</button>
          <button class="tree-action-btn btn-tree-rename" data-cat-id="${node.id}" data-cat-name="${node.name}" title="修改名稱">✏️</button>
          <button class="tree-action-btn btn-tree-delete" data-cat-id="${node.id}" title="刪除分類">🗑️</button>
        </div>
      `;

      nodeRow.querySelector(`[data-cat-select="${node.id}"]`).addEventListener('click', () => {
        selectCategory(node.id);
      });

      if (hasChildren) {
        nodeRow.querySelector('.tree-toggle-arrow').addEventListener('click', (e) => {
          e.stopPropagation();
          PartStore.toggleCategory(node.id);
          renderCategoryTree();
          syncToggleTreeButtonText();
        });
      }

      nodeRow.querySelector('.btn-tree-add-child').addEventListener('click', (e) => {
        e.stopPropagation();
        openCategoryModal(node.id);
      });
      nodeRow.querySelector('.btn-tree-rename').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditCategoryModal(node.id, node.name);
      });
      nodeRow.querySelector('.btn-tree-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`確定要刪除分類「${node.name}」及其所有子項目嗎？`)) {
          PartStore.deleteCategory(node.id);
          if (state.selectedCategoryId === node.id) state.selectedCategoryId = null;
          renderAll();
          showToast(`分類「${node.name}」已刪除`);
        }
      });

      el.treeContainer.appendChild(nodeRow);

      if (hasChildren && node.isOpen) {
        node.children.forEach(child => buildNodeHtml(child, level + 1));
      }
    }

    tree.forEach(rootNode => buildNodeHtml(rootNode, 0));

    if (!state.selectedCategoryId) {
      el.treeNodeAll.className = 'tree-node-row active-node w-full';
    } else {
      el.treeNodeAll.className = 'tree-node-row w-full';
    }
  }

  function selectCategory(catId) {
    state.selectedCategoryId = catId;
    renderCategoryTree();
    renderInventoryTable();
  }

  el.treeNodeAll.addEventListener('click', () => {
    state.selectedCategoryId = null;
    renderCategoryTree();
    renderInventoryTable();
  });

  // 單一展開/收合切換按鈕
  el.btnToggleTree.addEventListener('click', () => {
    const isAllOpen = PartStore.isAllCategoryOpen();
    PartStore.setAllCategoryOpen(!isAllOpen);
    renderCategoryTree();
    syncToggleTreeButtonText();
  });

  // =========================================================
  // 下拉選單階層產生輔助
  // =========================================================
  function populateCategoryOptions(selectElement, selectedId = null, includeRootOption = false) {
    const tree = PartStore.getCategories();
    selectElement.innerHTML = '';

    if (includeRootOption) {
      const rootOpt = document.createElement('option');
      rootOpt.value = '';
      rootOpt.textContent = '📁 [頂級大項目 (無父層級)]';
      selectElement.appendChild(rootOpt);
    } else {
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '未指定分類';
      selectElement.appendChild(defaultOpt);
    }

    function recurseOptions(nodes, level = 0) {
      nodes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.id;
        const prefix = level > 0 ? '　'.repeat(level) + '└ ' : '';
        opt.textContent = `${prefix}${n.name}`;
        if (n.id === selectedId) opt.selected = true;
        selectElement.appendChild(opt);
        if (n.children && n.children.length > 0) {
          recurseOptions(n.children, level + 1);
        }
      });
    }

    recurseOptions(tree, 0);
  }

  // =========================================================
  // 表格過濾與渲染 (對齊 Excel 圖片所有欄位)
  // =========================================================
  function getFilteredParts() {
    let list = PartStore.getParts();

    if (state.selectedCategoryId) {
      const allowedIds = PartStore.getAllDescendantIds(state.selectedCategoryId);
      list = list.filter(p => allowedIds.includes(p.categoryId));
    }

    if (state.stockFilter === 'LOW_ONLY') {
      list = list.filter(p => {
        const total = parseStockFormula(p.stock) + parseStockFormula(p.sample);
        return p.safetyStock > 0 && total <= p.safetyStock;
      });
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        (p.group && p.group.toLowerCase().includes(q)) ||
        (p.item && p.item.toLowerCase().includes(q)) ||
        (p.class && p.class.toLowerCase().includes(q)) ||
        (p.valueName && p.valueName.toLowerCase().includes(q)) ||
        (p.toleranceType && p.toleranceType.toLowerCase().includes(q)) ||
        (p.footprint && p.footprint.toLowerCase().includes(q)) ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes(q)) ||
        (p.mpn && p.mpn.toLowerCase().includes(q)) ||
        (p.vendor && p.vendor.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
      );
    }

    return list;
  }

  function renderInventoryTable() {
    const parts = getFilteredParts();
    el.inventoryTableBody.innerHTML = '';

    if (state.selectedCategoryId) {
      const path = PartStore.getCategoryPath(state.selectedCategoryId);
      el.currentCategoryLabel.textContent = path || '自訂分類';
    } else {
      el.currentCategoryLabel.textContent = '全部品項總表';
    }
    el.currentCategoryCount.textContent = `${parts.length} 筆`;
    el.tableSummaryInfo.textContent = `共符合 ${parts.length} 筆料件項目`;

    if (parts.length === 0) {
      el.inventoryTableBody.innerHTML = `
        <tr>
          <td colspan="19" class="text-center py-12 text-slate-400">
            <div class="text-2xl mb-1">🔍</div>
            <p class="font-medium text-xs text-slate-600">查無符合條件的料件規格</p>
            <p class="text-[11px] text-slate-400 mt-0.5">可點選上方「新增料件」隨時建立</p>
          </td>
        </tr>
      `;
      return;
    }

    parts.forEach(part => {
      const tr = document.createElement('tr');
      const totalAvailable = parseStockFormula(part.stock) + parseStockFormula(part.sample);
      const isLowStock = part.safetyStock > 0 && totalAvailable <= part.safetyStock;

      if (isLowStock) tr.classList.add('row-low-stock');

      let classBadge = `<span class="badge badge-crystals">${part.class || 'Parts'}</span>`;
      if (part.class && part.class.toLowerCase().includes('resistor')) {
        classBadge = `<span class="badge badge-resistors">Resistors</span>`;
      } else if (part.class && part.class.toLowerCase().includes('inductor')) {
        classBadge = `<span class="badge badge-inductors">Inductors</span>`;
      } else if (part.class && part.class.toLowerCase().includes('product')) {
        classBadge = `<span class="badge badge-product">${part.class}</span>`;
      }

      tr.innerHTML = `
        <td class="sticky-col-1 text-center font-mono font-bold text-slate-700 bg-slate-50">${part.group || '-'}</td>
        <td class="sticky-col-2 text-center font-mono text-slate-600 bg-slate-50">${part.type || '-'}</td>
        <td class="text-center font-mono font-bold text-blue-700">${part.item || '-'}</td>
        <td>${classBadge}</td>
        <td class="font-semibold text-slate-900">${part.valueName || '-'}</td>
        <td class="text-slate-600 font-mono text-[11px]">${part.toleranceType || '-'}</td>
        <td class="font-mono text-slate-700">${part.footprint || '-'}</td>
        <td class="font-medium text-slate-800">${part.manufacturer || '-'}</td>
        <td class="font-mono font-bold text-slate-900 select-all">${part.mpn || '-'}</td>
        <td class="text-slate-600">${part.vendor || '-'}</td>
        <td class="text-right font-mono font-bold text-blue-700 bg-blue-50/20">${part.sample || '0'}</td>
        <td class="text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">${part.stock || '0'}</td>
        <td class="text-right font-mono text-slate-600">${part.moq || '-'}</td>
        <td class="text-right font-mono font-semibold text-slate-800">${part.unitPriceTwd ? `NT$ ${part.unitPriceTwd}` : '-'}</td>
        <td class="text-right font-mono font-semibold text-slate-800">${part.unitPriceUsd ? `$ ${part.unitPriceUsd}` : '-'}</td>
        <td class="text-slate-500">${part.substitute || '-'}</td>
        <td class="font-mono text-slate-400 text-[11px]">${part.date || '-'}</td>
        <td>
          <span class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
            📍 ${part.location || '未設'}
          </span>
        </td>
        <td class="text-center sticky right-0 bg-white shadow-l">
          <div class="flex items-center justify-center gap-1">
            <button class="btn-row-tx px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-medium" data-id="${part.id}" title="出入庫過帳">
              ⚡ 過帳
            </button>
            <button class="btn-row-del px-1.5 py-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 text-[11px]" data-id="${part.id}" title="刪除料件">
              ✕
            </button>
          </div>
        </td>
      `;

      el.inventoryTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-row-tx').forEach(btn => {
      btn.addEventListener('click', () => openTransactionModal(btn.dataset.id));
    });
    document.querySelectorAll('.btn-row-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('確定要刪除此筆料件嗎？')) {
          PartStore.deletePart(btn.dataset.id);
          renderAll();
          showToast('料件已刪除');
        }
      });
    });
  }

  // =========================================================
  // 渲染交易紀錄流水帳
  // =========================================================
  function renderTransactionsTable() {
    const txs = PartStore.getTransactions();
    el.transactionTableBody.innerHTML = '';

    if (txs.length === 0) {
      el.transactionTableBody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-10 text-slate-400">目前尚無異動紀錄</td>
        </tr>
      `;
      return;
    }

    txs.forEach(tx => {
      const tr = document.createElement('tr');
      const isIn = tx.type === '入庫';
      const targetLabel = tx.targetField === 'sample' ? '樣品 (Sample)' : '量產 (Stock)';
      const dateStr = new Date(tx.timestamp).toLocaleString('zh-TW', { hour12: false });

      tr.innerHTML = `
        <td class="font-mono text-slate-500 text-[11px]">${dateStr}</td>
        <td class="font-mono font-semibold text-slate-700">${tx.docNo}</td>
        <td class="text-center font-medium ${tx.targetField === 'sample' ? 'text-blue-700' : 'text-emerald-700'}">${targetLabel}</td>
        <td class="text-center">
          <span class="badge ${isIn ? 'badge-crystals' : 'badge-warn'}">${tx.type}</span>
        </td>
        <td class="font-mono font-bold text-slate-900">${tx.partNo}</td>
        <td>
          <div class="font-medium text-slate-800">${tx.partName}</div>
          <div class="text-[11px] text-slate-400">${tx.reason || '-'}</div>
        </td>
        <td class="text-right font-mono font-bold ${isIn ? 'text-emerald-600' : 'text-red-600'}">
          ${isIn ? '+' : '-'}${tx.quantity.toLocaleString()}
        </td>
        <td class="text-right font-mono font-bold text-slate-800">${tx.balanceAfter}</td>
        <td class="text-slate-700">${tx.operator}</td>
        <td class="text-slate-400 truncate max-w-xs" title="${tx.notes}">${tx.notes || '-'}</td>
      `;
      el.transactionTableBody.appendChild(tr);
    });

    el.txSummaryInfo.textContent = `共記錄最近 ${txs.length} 筆過帳日誌`;
  }

  // =========================================================
  // 彈窗控制 (通用)
  // =========================================================
  function closeModal(modal) {
    modal.classList.remove('active');
  }

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(el.modalBatchCat);
      closeModal(el.modalEditCat);
      closeModal(el.modalNewPart);
      closeModal(el.modalTx);
    });
  });

  [el.modalBatchCat, el.modalEditCat, el.modalNewPart, el.modalTx].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      [el.modalBatchCat, el.modalEditCat, el.modalNewPart, el.modalTx].forEach(closeModal);
    }
  });

  // =========================================================
  // 彈窗 1：新增分類 (可同時新增欲新增之項目及子項目)
  // =========================================================
  function openCategoryModal(targetParentId = null) {
    populateCategoryOptions(el.batchParentSelect, targetParentId, true);
    el.inputPrimaryCatName.value = '';
    el.batchCategoryNames.value = '';
    el.modalBatchCat.classList.add('active');
    setTimeout(() => el.inputPrimaryCatName.focus(), 100);
  }

  el.btnAddRootCat.addEventListener('click', () => openCategoryModal(null));
  el.btnBatchAddShortcut.addEventListener('click', () => openCategoryModal(state.selectedCategoryId));

  el.formBatchCat.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const parentId = el.batchParentSelect.value || null;
      const primaryName = el.inputPrimaryCatName.value;
      const subNamesRaw = el.batchCategoryNames.value;

      const result = PartStore.addCategoryWithChildren(parentId, primaryName, subNamesRaw);
      closeModal(el.modalBatchCat);
      renderAll();

      const msg = result.primary
        ? `成功建立項目「${result.primary.name}」${result.subs.length > 0 ? ` 及其 ${result.subs.length} 個子項目` : ''}！`
        : `成功批量新增 ${result.subs.length} 個子項目！`;
      showToast(msg);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // =========================================================
  // 彈窗 2：修改分類名稱
  // =========================================================
  function openEditCategoryModal(catId, currentName) {
    el.editCatId.value = catId;
    el.editCatName.value = currentName;
    el.modalEditCat.classList.add('active');
    setTimeout(() => el.editCatName.focus(), 100);
  }

  el.formEditCat.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const id = el.editCatId.value;
      const newName = el.editCatName.value;
      PartStore.updateCategory(id, newName);
      closeModal(el.modalEditCat);
      renderAll();
      showToast(`分類名稱已變更為「${newName}」`);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // =========================================================
  // 彈窗 3：新增料件主檔 (整合直接在表單內建立新分類，免換頁！)
  // =========================================================
  function resetInlineCatPanel() {
    if (el.inlineNewCatPanel) el.inlineNewCatPanel.classList.add('hidden');
    if (el.inlineCatBtnText) el.inlineCatBtnText.textContent = '若為新分類，點此直接新增 (免換頁)';
    if (el.inlineCatBtnIcon) el.inlineCatBtnIcon.textContent = '➕';
    if (el.inlineCatName) el.inlineCatName.value = '';
    if (el.inlineCatSubs) el.inlineCatSubs.value = '';
  }

  el.btnOpenNewPart.addEventListener('click', () => {
    el.formNewPart.reset();
    populateCategoryOptions(el.partCategorySelect, state.selectedCategoryId, false);
    populateCategoryOptions(el.inlineCatParent, state.selectedCategoryId, true);
    resetInlineCatPanel();
    document.getElementById('part-date').value = new Date().toISOString().slice(0, 10);
    el.modalNewPart.classList.add('active');
  });

  // 切換內嵌新增分類面板
  if (el.btnToggleInlineCat) {
    el.btnToggleInlineCat.addEventListener('click', () => {
      const isHidden = el.inlineNewCatPanel.classList.contains('hidden');
      if (isHidden) {
        el.inlineNewCatPanel.classList.remove('hidden');
        el.inlineCatBtnText.textContent = '收合新分類面板';
        el.inlineCatBtnIcon.textContent = '✕';
        populateCategoryOptions(el.inlineCatParent, el.partCategorySelect.value || state.selectedCategoryId, true);
        setTimeout(() => el.inlineCatName.focus(), 100);
      } else {
        resetInlineCatPanel();
      }
    });
  }

  if (el.btnCloseInlineCat) {
    el.btnCloseInlineCat.addEventListener('click', resetInlineCatPanel);
  }

  // 點選「建立並套用此分類」按鈕
  if (el.btnApplyInlineCat) {
    el.btnApplyInlineCat.addEventListener('click', () => {
      const parentId = el.inlineCatParent.value || null;
      const primaryName = el.inlineCatName.value.trim();
      const subNames = el.inlineCatSubs.value.trim();

      if (!primaryName && !subNames) {
        showToast('請輸入新項目名稱或子項目名稱！', true);
        return;
      }

      try {
        const res = PartStore.addCategoryWithChildren(parentId, primaryName, subNames);
        const newCatId = res.primary ? res.primary.id : (res.subs[0] ? res.subs[0].id : '');

        // 更新表單下拉選單並自動選中該分類
        populateCategoryOptions(el.partCategorySelect, newCatId, false);
        populateCategoryOptions(el.inlineCatParent, newCatId, true);
        renderCategoryTree();
        updateTopMetrics();

        resetInlineCatPanel();
        showToast(`新分類「${res.primary ? res.primary.name : res.subs[0].name}」已建立並成功選定！`);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  el.formNewPart.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      let targetCategoryId = el.partCategorySelect.value;

      // 若使用者在內嵌面板輸入了新分類名稱，但未點擊「建立並套用」，送出時自動先建立該分類並指派
      const inlinePrimary = el.inlineCatName ? el.inlineCatName.value.trim() : '';
      const inlineSubs = el.inlineCatSubs ? el.inlineCatSubs.value.trim() : '';
      if (inlinePrimary || inlineSubs) {
        const inlineParent = el.inlineCatParent ? el.inlineCatParent.value || null : null;
        const autoCat = PartStore.addCategoryWithChildren(inlineParent, inlinePrimary, inlineSubs);
        if (autoCat.primary) {
          targetCategoryId = autoCat.primary.id;
        } else if (autoCat.subs && autoCat.subs.length > 0) {
          targetCategoryId = autoCat.subs[0].id;
        }
        renderCategoryTree();
        updateTopMetrics();
      }

      // 無必填限制，直接儲存料件
      const newPart = PartStore.addPart({
        categoryId: targetCategoryId,
        group: document.getElementById('part-group').value,
        type: document.getElementById('part-type').value,
        item: document.getElementById('part-item').value,
        class: document.getElementById('part-class').value,
        valueName: document.getElementById('part-valuename').value,
        toleranceType: document.getElementById('part-tolerancetype').value,
        footprint: document.getElementById('part-footprint').value,
        manufacturer: document.getElementById('part-mfg').value,
        mpn: document.getElementById('part-mpn').value,
        vendor: document.getElementById('part-vendor').value,
        sample: document.getElementById('part-sample').value,
        stock: document.getElementById('part-stock').value,
        moq: document.getElementById('part-moq').value,
        unitPriceTwd: document.getElementById('part-pricetwd').value,
        unitPriceUsd: document.getElementById('part-priceusd').value,
        substitute: document.getElementById('part-substitute').value,
        date: document.getElementById('part-date').value,
        location: document.getElementById('part-location').value,
        safetyStock: document.getElementById('part-safetystock').value
      });

      closeModal(el.modalNewPart);
      renderAll();
      showToast(`料件 [${newPart.mpn || newPart.item || newPart.valueName}] 建立成功！`);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // =========================================================
  // 彈窗 4：快捷出入庫登錄 (支援 Sample 樣品與 Stock 量產庫存)
  // =========================================================
  const TX_REASONS = {
    入庫: ['採購入庫', '工程退料', '產線結案退料', '原廠大批進貨', '供應商樣品進貨'],
    出庫: ['工單領料', '研發借調實測', '生產組裝領用', '外發加工', '不良報廢']
  };

  function updateTxReasons(type) {
    el.txReasonSelect.innerHTML = (TX_REASONS[type] || []).map(r => `<option value="${r}">${r}</option>`).join('');
  }

  function getSelectedTxPart() {
    return PartStore.getPartById(el.txPartSelect.value);
  }

  function syncTxPreview() {
    const part = getSelectedTxPart();
    if (!part) return;

    el.txPreviewMpn.textContent = part.mpn ? `${part.mpn} (Item ${part.item || '-'})` : `Item ${part.item || '-'}`;
    el.txPreviewDesc.textContent = `${part.valueName || '-'} ｜ 規格: ${part.toleranceType || '-'} ｜ 原廠: ${part.manufacturer || '-'}`;
    el.txPreviewStocks.textContent = `樣品 (Sample): ${part.sample || '0'} ｜ 在庫 (Stock): ${part.stock || '0'}`;

    const targetField = el.txTargetField.value;
    const type = el.txTypeSelect.value;
    const qty = Number(el.txQty.value) || 0;
    const currentNum = parseStockFormula(part[targetField]);

    const nextNum = type === '入庫' ? currentNum + qty : currentNum - qty;
    const fieldName = targetField === 'sample' ? 'Sample' : 'Stock';

    if (nextNum < 0) {
      el.txCalcAfter.textContent = `${nextNum.toLocaleString()} (超領警報！不可為負數)`;
      document.getElementById('tx-balance-box').className = 'p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 flex justify-between text-xs font-semibold';
    } else {
      el.txCalcAfter.textContent = `${fieldName} 結存：${nextNum.toLocaleString()}`;
      document.getElementById('tx-balance-box').className = 'p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex justify-between text-xs font-medium';
    }
  }

  function openTransactionModal(preselectPartId = null) {
    const parts = PartStore.getParts();
    if (!parts.length) return showToast('目前尚無料件主檔', true);

    el.txPartSelect.innerHTML = parts.map(p => `
      <option value="${p.id}" ${p.id === preselectPartId ? 'selected' : ''}>
        ${p.group ? `[${p.group}]` : ''} ${p.mpn || p.item || p.valueName} - ${p.valueName} (Stock: ${p.stock || 0})
      </option>
    `).join('');

    el.txQty.value = '';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    document.getElementById('tx-docno').value = `IN-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;

    updateTxReasons(el.txTypeSelect.value);
    syncTxPreview();
    el.modalTx.classList.add('active');
    setTimeout(() => el.txQty.focus(), 100);
  }

  el.btnOpenTxModal.addEventListener('click', () => openTransactionModal());
  el.txPartSelect.addEventListener('change', syncTxPreview);
  el.txTargetField.addEventListener('change', syncTxPreview);
  el.txTypeSelect.addEventListener('change', (e) => {
    updateTxReasons(e.target.value);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    document.getElementById('tx-docno').value = `${e.target.value === '入庫' ? 'IN' : 'OUT'}-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    syncTxPreview();
  });
  el.txQty.addEventListener('input', syncTxPreview);

  el.formTx.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const partId = el.txPartSelect.value;
      const targetField = el.txTargetField.value;
      const type = el.txTypeSelect.value;
      const qty = el.txQty.value;
      const reason = el.txReasonSelect.value;
      const operator = document.getElementById('tx-user').value;
      const docNo = document.getElementById('tx-docno').value;
      const notes = document.getElementById('tx-note').value;

      const result = PartStore.executeTransaction({
        partId,
        targetField,
        type,
        reason,
        quantity: qty,
        operator,
        docNo,
        notes
      });

      closeModal(el.modalTx);
      renderAll();
      showToast(`單據 [${result.txRecord.docNo}] 過帳成功！`);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // =========================================================
  // 匯出 Excel (CSV)
  // =========================================================
  el.btnExportCsv.addEventListener('click', () => {
    const parts = PartStore.getParts();
    if (!parts.length) return showToast('目前無料件資料可匯出', true);

    const headers = [
      'Group', 'type', 'Item', 'Class', 'Value/Name', 'Tolerance/Type',
      'PCB footprint', 'Manufacturer', 'M P/N', 'Vendor', 'Sample',
      'Stock', 'MOQ', 'Unit price (TWD)', 'Unit price (USD)', '替代',
      'Date', 'Location', 'Category Path'
    ];

    const rows = parts.map(p => [
      `"${p.group || ''}"`,
      `"${p.type || ''}"`,
      `"${p.item || ''}"`,
      `"${p.class || ''}"`,
      `"${(p.valueName || '').replace(/"/g, '""')}"`,
      `"${(p.toleranceType || '').replace(/"/g, '""')}"`,
      `"${(p.footprint || '').replace(/"/g, '""')}"`,
      `"${(p.manufacturer || '').replace(/"/g, '""')}"`,
      `"${(p.mpn || '').replace(/"/g, '""')}"`,
      `"${(p.vendor || '').replace(/"/g, '""')}"`,
      `"${p.sample || ''}"`,
      `"${p.stock || ''}"`,
      `"${p.moq || ''}"`,
      `"${p.unitPriceTwd || ''}"`,
      `"${p.unitPriceUsd || ''}"`,
      `"${(p.substitute || '').replace(/"/g, '""')}"`,
      `"${p.date || ''}"`,
      `"${(p.location || '').replace(/"/g, '""')}"`,
      `"${(p.categoryPath || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvText = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `料件管理規格表_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Excel CSV 已成功匯出！');
  });

  // =========================================================
  // 隨機重整數據
  // =========================================================
  if (el.btnRefreshMock) {
    el.btnRefreshMock.addEventListener('click', () => {
      if (confirm('確定要隨機重整庫存數量並恢復標準演示數據嗎？')) {
        PartStore.resetToMockData();
        renderAll();
        showToast('展示數據已重新載入！');
      }
    });
  }

  // 搜尋與篩選事件
  el.inputSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderInventoryTable();
  });

  el.quickStockRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.stockFilter = e.target.value;
      renderInventoryTable();
    });
  });

  // 頁籤切換
  el.tabInventory.addEventListener('click', () => {
    state.currentTab = 'inventory';
    el.tabInventory.className = 'px-3.5 py-1 text-xs font-semibold rounded-md bg-white text-slate-900 shadow-xs transition';
    el.tabTransactions.className = 'px-3.5 py-1 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 transition';
    el.viewInventory.classList.remove('hidden');
    el.viewTransactions.classList.add('hidden');
  });

  el.tabTransactions.addEventListener('click', () => {
    state.currentTab = 'transactions';
    el.tabTransactions.className = 'px-3.5 py-1 text-xs font-semibold rounded-md bg-white text-slate-900 shadow-xs transition';
    el.tabInventory.className = 'px-3.5 py-1 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 transition';
    el.viewTransactions.classList.remove('hidden');
    el.viewInventory.classList.add('hidden');
    renderTransactionsTable();
  });

  // 統合刷新渲染
  function renderAll() {
    updateTopMetrics();
    renderCategoryTree();
    renderInventoryTable();
    renderTransactionsTable();
  }

  // 啟動渲染
  renderAll();
});
