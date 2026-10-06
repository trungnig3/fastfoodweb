import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { User } from './src/models/types.js';
import { checkAndCancelExpiredVnPayOrders } from './src/services/vnpayService.js';

// MVC Route Modules
import shopRoutes from './src/routes/shopRoutes.js';
import accountRoutes from './src/routes/accountRoutes.js';
import posRoutes from './src/routes/posRoutes.js';
import cashierRoutes from './src/routes/cashierRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';

declare module 'express-session' {
  interface SessionData {
    user?: User & { RoleName?: string };
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middlewares
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser() as any);
app.use(
  session({
    secret: 'fastfoodweb-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours shift
  }) as any
);

// View engine setup (MVC Views)
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Static files from wwwroot
app.use(express.static(path.join(process.cwd(), 'wwwroot')));

// Fallback for FastFoodWeb.styles.css
app.get('/FastFoodWeb.styles.css', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'wwwroot/css/site.css'));
});

// Periodic background job: Auto cancel expired VNPay orders (every 30s)
setInterval(checkAndCancelExpiredVnPayOrders, 30000);

// ==================== MVC ROUTE REGISTRATION ====================
app.use('/', shopRoutes);
app.use('/Account', accountRoutes);
app.use('/Pos', posRoutes);
app.use('/Cashier', cashierRoutes);
app.use('/Admin', adminRoutes);

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`  ➜  FastFood MVC Server: http://localhost:${PORT}/`);
  console.log(`  ➜  Network Address:     http://0.0.0.0:${PORT}/`);
  console.log(`  ➜  MVC Architecture ready in Visual Studio.`);
});

export default app;
