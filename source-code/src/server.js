require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const methodOverride = require('method-override');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const db = require('./config/database');
const { ensureBucket } = require('./config/storage');
const { ensureDemoUsers, ensureCustomerAccountSchema } = require('./services/auth-service');
const { attachUser, requireAuth, requireCustomer } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');
const asyncHandler = require('./utils/async-handler');
const { createResourceRouter } = require('./routes/resources');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.money = require('./utils/format').money;
app.locals.date = require('./utils/format').date;
app.locals.dateTime = require('./utils/format').dateTime;
app.locals.initials = require('./utils/format').initials;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use(session({
  name: 'cosmetic.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(attachUser);

app.get('/health', asyncHandler(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok', service: 'cosmetic-mini', timestamp: new Date().toISOString() });
}));
app.use('/', require('./routes/auth'));
app.get('/', requireAuth, asyncHandler(async (req, res) => {
  if (req.session.user.role === 'CUSTOMER') return res.redirect('/shop');
  const [productCount, customerCount, orderCount, revenue, lowStock, recentOrders, chart] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM products WHERE is_active=true'),
    db.query('SELECT COUNT(*)::int AS count FROM customers'),
    db.query("SELECT COUNT(*)::int AS count FROM orders WHERE status='COMPLETED' AND created_at::date=CURRENT_DATE"),
    db.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status='COMPLETED' AND created_at::date=CURRENT_DATE"),
    db.query(`SELECT p.id,p.sku,p.name,p.reorder_level,COALESCE(SUM(b.quantity_remaining),0)::int AS stock FROM products p LEFT JOIN product_batches b ON b.product_id=p.id WHERE p.is_active=true GROUP BY p.id HAVING COALESCE(SUM(b.quantity_remaining),0)<=p.reorder_level ORDER BY stock LIMIT 6`),
    db.query(`SELECT o.id,o.order_code,o.total_amount,o.created_at,c.full_name AS customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 6`),
    db.query(`SELECT to_char(day,'DD/MM') AS label,COALESCE(SUM(o.total_amount),0) AS revenue FROM generate_series(CURRENT_DATE-6,CURRENT_DATE,INTERVAL '1 day') day LEFT JOIN orders o ON o.created_at::date=day::date AND o.status='COMPLETED' GROUP BY day ORDER BY day`)
  ]);
  res.render('dashboard', { title: 'Tổng quan', stats: { products: productCount.rows[0].count, customers: customerCount.rows[0].count, ordersToday: orderCount.rows[0].count, revenueToday: revenue.rows[0].total }, lowStock: lowStock.rows, recentOrders: recentOrders.rows, chart: chart.rows });
}));
app.use('/shop', requireAuth, requireCustomer, require('./routes/customer-shop'));
app.use('/my-orders', requireAuth, requireCustomer, require('./routes/customer-orders'));
// Customers must never reach staff/admin routes or their APIs by typing URLs directly.
app.use((req, res, next) => {
  if (req.session?.user?.role !== 'CUSTOMER') return next();
  if (req.path === '/products' || req.path.startsWith('/products/')) return res.redirect('/shop');
  if (req.path === '/orders' || req.path.startsWith('/orders/')) return res.redirect('/my-orders');
  return res.redirect('/shop');
});
app.use('/products', createResourceRouter('products'));
app.use('/categories', createResourceRouter('categories'));
app.use('/brands', createResourceRouter('brands'));
app.use('/suppliers', createResourceRouter('suppliers'));
app.use('/customers', createResourceRouter('customers'));
app.use('/orders', require('./routes/orders'));
app.use('/batches', require('./routes/batches'));
app.use('/files', require('./routes/files'));
app.use('/users', require('./routes/users'));
app.use('/reports', require('./routes/reports'));
app.use('/', require('./routes/activity')); 
app.use('/api', require('./routes/api'));
try {
  const openApi = YAML.load(path.join(__dirname, '..', 'postman', 'openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApi, { explorer: true }));
} catch (error) { console.warn('[swagger] OpenAPI document not loaded:', error.message); }
app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await db.waitForDatabase();
  await ensureCustomerAccountSchema();
  await ensureDemoUsers();
  await ensureBucket();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => console.log(`[app] Cosmetic Mini listening on ${port}`));
}
if (require.main === module) {
  start().catch((error) => { console.error('[startup] failed:', error); process.exit(1); });
}
module.exports = { app, start };
