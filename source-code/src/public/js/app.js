(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setupSidebar() {
    const toggle = $('[data-sidebar-toggle]');
    const sidebar = $('#sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => sidebar.classList.toggle('sidebar-open'));
    document.addEventListener('click', (event) => {
      if (window.innerWidth > 1020 || !sidebar.classList.contains('sidebar-open')) return;
      if (!sidebar.contains(event.target) && !toggle.contains(event.target)) sidebar.classList.remove('sidebar-open');
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1020) sidebar.classList.remove('sidebar-open');
    });
  }

  function setupDismissibleAlerts() {
    $$('[data-dismiss]').forEach((button) => button.addEventListener('click', () => {
      const alert = button.closest('[data-dismissible]');
      if (alert) alert.remove();
    }));
  }

  function setupConfirmations() {
    $$('form[data-confirm]').forEach((form) => form.addEventListener('submit', (event) => {
      const message = form.getAttribute('data-confirm') || 'Bạn có chắc muốn thực hiện thao tác này?';
      if (!window.confirm(message)) event.preventDefault();
    }));
  }

  function setupPasswordToggles() {
    $$('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      const icon = $('i', button);
      if (icon) icon.className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    }));
  }

  function setupFileUpload() {
    const input = $('#file');
    const zone = $('[data-dropzone]');
    const output = $('[data-file-name]');
    if (!input || !zone) return;
    const showFile = (file) => {
      if (!file) { if (output) output.textContent = 'Chưa chọn tệp'; return; }
      if (output) output.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    };
    input.addEventListener('change', () => showFile(input.files[0]));
    ['dragenter', 'dragover'].forEach((eventName) => zone.addEventListener(eventName, (event) => {
      event.preventDefault(); zone.classList.add('drag-over');
    }));
    ['dragleave', 'drop'].forEach((eventName) => zone.addEventListener(eventName, (event) => {
      event.preventDefault(); zone.classList.remove('drag-over');
    }));
    zone.addEventListener('drop', (event) => {
      const files = event.dataTransfer?.files;
      if (!files || !files.length) return;
      try { input.files = files; showFile(files[0]); } catch { showFile(files[0]); }
    });
  }

  function setupOrderForm() {
    const form = $('[data-order-form]');
    if (!form) return;
    const picker = $('#product-picker', form);
    const addButton = $('[data-add-product]', form);
    const itemsBody = $('[data-order-items]', form);
    const subtotalOutput = $('[data-subtotal]', form);
    const totalOutput = $('[data-total]', form);
    const countOutput = $('[data-item-count]', form);
    const submitButton = $('[data-submit-order]', form);
    const rows = new Map();
    const formatMoney = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

    function render() {
      const existingEmpty = $('[data-empty-row]', itemsBody);
      if (existingEmpty) existingEmpty.remove();
      $$('[data-order-row]', itemsBody).forEach((row) => row.remove());
      let total = 0;
      let count = 0;
      rows.forEach((item) => {
        const lineTotal = item.price * item.quantity;
        total += lineTotal; count += item.quantity;
        const row = document.createElement('tr');
        row.setAttribute('data-order-row', '');
        const nameCell = document.createElement('td');
        const name = document.createElement('strong'); name.textContent = item.name;
        const sku = document.createElement('small'); sku.className = 'table-subline'; sku.textContent = item.sku;
        nameCell.append(name, sku);
        const priceCell = document.createElement('td'); priceCell.textContent = formatMoney(item.price);
        const quantityCell = document.createElement('td');
        const quantityInput = document.createElement('input'); quantityInput.type = 'number'; quantityInput.min = '1'; quantityInput.max = String(Math.max(1, item.stock)); quantityInput.value = String(item.quantity); quantityInput.setAttribute('aria-label', `Số lượng ${item.name}`);
        quantityInput.addEventListener('change', () => {
          item.quantity = Math.max(1, Math.min(item.stock, Number.parseInt(quantityInput.value, 10) || 1)); render();
        });
        quantityCell.append(quantityInput);
        const lineCell = document.createElement('td'); lineCell.className = 'money-cell'; lineCell.textContent = formatMoney(lineTotal);
        const actionCell = document.createElement('td');
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'row-action danger-action'; remove.innerHTML = '<i class="bi bi-x-lg"></i>'; remove.setAttribute('aria-label', `Xóa ${item.name}`);
        remove.addEventListener('click', () => { rows.delete(item.id); render(); });
        actionCell.append(remove);
        row.append(nameCell, priceCell, quantityCell, lineCell, actionCell);
        const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.name = 'items[][product_id]'; hiddenId.value = String(item.id);
        const hiddenQuantity = document.createElement('input'); hiddenQuantity.type = 'hidden'; hiddenQuantity.name = 'items[][quantity]'; hiddenQuantity.value = String(item.quantity);
        actionCell.append(hiddenId, hiddenQuantity);
        itemsBody.append(row);
      });
      if (!rows.size) {
        const row = document.createElement('tr'); row.setAttribute('data-empty-row', '');
        const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'muted'; cell.textContent = 'Chưa có sản phẩm trong đơn hàng.';
        row.append(cell); itemsBody.append(row);
      }
      subtotalOutput.textContent = formatMoney(total); totalOutput.textContent = formatMoney(total); countOutput.textContent = String(count);
      submitButton.disabled = rows.size === 0;
    }

    addButton.addEventListener('click', () => {
      const option = picker.selectedOptions[0];
      if (!option || !option.value) { picker.focus(); return; }
      const id = Number(option.value);
      const stock = Number(option.dataset.stock || 0);
      if (stock <= 0) { window.alert('Sản phẩm hiện không còn hàng.'); return; }
      if (rows.has(id)) {
        const item = rows.get(id);
        if (item.quantity >= item.stock) { window.alert('Số lượng đã đạt mức tồn kho.'); return; }
        item.quantity += 1;
      } else {
        rows.set(id, { id, name: option.textContent.split(' · ')[0], sku: option.dataset.sku || '', price: Number(option.dataset.price || 0), stock, quantity: 1 });
      }
      picker.value = ''; render();
    });
    form.addEventListener('submit', (event) => {
      if (!rows.size) { event.preventDefault(); window.alert('Vui lòng thêm ít nhất một sản phẩm.'); return; }
      // Build the array with stable indexed field names for Express body parsing.
      $$('[name^="items["]', form).forEach((input) => input.remove());
      Array.from(rows.values()).forEach((item, index) => {
        [['product_id', item.id], ['quantity', item.quantity]].forEach(([field, value]) => {
          const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = `items[${index}][${field}]`; hidden.value = String(value); form.append(hidden);
        });
      });
    });
    render();
  }

  function setupDateValidation() {
    const from = $('#from'); const to = $('#to');
    if (!from || !to) return;
    from.addEventListener('change', () => { to.min = from.value; if (to.value && to.value < from.value) to.value = from.value; });
    to.addEventListener('change', () => { from.max = to.value; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupDismissibleAlerts();
    setupConfirmations();
    setupPasswordToggles();
    setupFileUpload();
    setupOrderForm();
    setupDateValidation();
  });
})();


// Preview the selected product image before submitting the product form.
document.addEventListener('change', (event) => {
  if (event.target?.id !== 'product_image') return;
  const file = event.target.files?.[0];
  const preview = document.querySelector('[data-product-image-preview]');
  const image = preview?.querySelector('img');
  if (!preview || !image) return;
  if (!file) { preview.hidden = true; image.removeAttribute('src'); return; }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    event.target.value = ''; preview.hidden = true; window.alert('Vui lòng chọn ảnh JPG, PNG hoặc WEBP.'); return;
  }
  image.src = URL.createObjectURL(file); preview.hidden = false;
});
