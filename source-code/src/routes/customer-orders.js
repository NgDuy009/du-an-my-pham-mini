const express = require('express');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { notFound, badRequest } = require('../utils/errors');
const { transaction } = require('../config/database');
const { flash } = require('../middleware/auth');
const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT o.id,o.order_code,o.status,o.total_amount,o.payment_method,o.created_at,
      COUNT(oi.id)::int AS item_count
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE o.customer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`, [req.session.user.customerId]);
  res.render('customer/orders', { title: 'Đơn hàng của tôi', orders: result.rows });
}));



// Khách đặt mua trực tiếp từ thẻ sản phẩm. Giá và tồn kho luôn lấy từ DB, không tin dữ liệu gửi từ trình duyệt.
router.post('/buy-now', asyncHandler(async (req, res) => {
  const productId = Number(req.body.product_id);
  const quantity = Number(req.body.quantity || 1);
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw badRequest('Sản phẩm hoặc số lượng không hợp lệ.');
  }

  const order = await transaction(async (client) => {
    const productResult = await client.query(
      'SELECT id,sku,name,sale_price FROM products WHERE id=$1 AND is_active=TRUE FOR UPDATE', [productId]
    );
    if (!productResult.rowCount) throw badRequest('Sản phẩm không còn được kinh doanh.');
    const product = productResult.rows[0];
    const batchesResult = await client.query(
      `SELECT * FROM product_batches WHERE product_id=$1 AND quantity_remaining>0
       AND (expires_on IS NULL OR expires_on>=CURRENT_DATE)
       ORDER BY expires_on NULLS LAST, received_on, id FOR UPDATE`, [productId]
    );
    let remaining = quantity;
    const allocations = [];
    for (const batch of batchesResult.rows) {
      if (remaining <= 0) break;
      const allocated = Math.min(remaining, Number(batch.quantity_remaining));
      allocations.push({ batchId: batch.id, quantity: allocated, unitCost: Number(batch.unit_cost) });
      remaining -= allocated;
    }
    if (remaining > 0) throw badRequest(`Sản phẩm “${product.name}” không đủ tồn kho.`);

    const total = Number(product.sale_price) * quantity;
    const orderCode = `WEB-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Date.now().toString().slice(-6)}`;
    const orderResult = await client.query(
      `INSERT INTO orders(order_code,customer_id,created_by,status,subtotal,discount_amount,total_amount,payment_method,note)
       VALUES($1,$2,$3,'DRAFT',$4,0,$4,'CASH',$5) RETURNING *`,
      [orderCode, req.session.user.customerId, req.session.user.id, total, 'Đặt hàng trực tuyến - chờ cửa hàng xác nhận']
    );
    const created = orderResult.rows[0];
    for (const allocation of allocations) {
      await client.query('UPDATE product_batches SET quantity_remaining=quantity_remaining-$1 WHERE id=$2', [allocation.quantity, allocation.batchId]);
      await client.query(
        `INSERT INTO order_items(order_id,product_id,batch_id,product_sku,product_name,quantity,unit_price,unit_cost)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [created.id, product.id, allocation.batchId, product.sku, product.name, allocation.quantity, product.sale_price, allocation.unitCost]
      );
      await client.query(
        `INSERT INTO stock_movements(product_id,batch_id,movement_type,quantity_change,reference_type,reference_id,created_by)
         VALUES($1,$2,'SALE',$3,'ORDER',$4,$5)`,
        [product.id, allocation.batchId, -allocation.quantity, created.id, req.session.user.id]
      );
    }
    return created;
  });
  flash(req, 'success', `Đã đặt hàng ${order.order_code}. Cửa hàng sẽ xác nhận đơn của bạn.`);
  res.redirect(`/my-orders/${order.id}`);
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT o.*, c.full_name AS customer_name FROM orders o
    JOIN customers c ON c.id=o.customer_id WHERE o.id=$1 AND o.customer_id=$2`, [req.params.id, req.session.user.customerId]);
  if (!result.rowCount) throw notFound('Không tìm thấy đơn hàng của bạn.');
  const items = await db.query('SELECT product_sku,product_name,quantity,unit_price,line_total FROM order_items WHERE order_id=$1 ORDER BY id', [result.rows[0].id]);
  res.render('customer/order-detail', { title: `Đơn hàng ${result.rows[0].order_code}`, order: result.rows[0], items: items.rows });
}));

module.exports = router;
