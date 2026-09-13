import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PlatformLogin from './pages/PlatformLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminServicesPage from './pages/admin/AdminServicesPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import NotFound from './pages/NotFound'
import MarketLayout from './pages/market/MarketLayout'
import MenuPage from './pages/market/MenuPage'
import CartPage from './pages/market/CartPage'
import CheckoutPage from './pages/market/CheckoutPage'
import SuccessPage from './pages/market/SuccessPage'
import MyOrdersPage from './pages/market/MyOrdersPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import OrdersPage from './pages/dashboard/OrdersPage'
import ProductsPage from './pages/dashboard/ProductsPage'
import ProductEditorPage from './pages/dashboard/ProductEditorPage'
import StatsPage from './pages/dashboard/StatsPage'
import SettingsPage from './pages/dashboard/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Platform entry: everyone signs in here */}
        <Route path="/" element={<PlatformLogin />} />

        {/* Developer panel: services + platform users */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminServicesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>

        {/* Customer mini app: fastfood-markets.uz/markets/<service> */}
        <Route path="/markets/:service" element={<MarketLayout />}>
          <Route index element={<MenuPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="success/:orderId" element={<SuccessPage />} />
          <Route path="orders" element={<MyOrdersPage />} />
        </Route>

        {/* Owner dashboard: fastfood-markets.uz/dashboard/<service> */}
        <Route path="/dashboard/:service" element={<DashboardLayout />}>
          <Route index element={<OrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductEditorPage />} />
          <Route path="products/:id/edit" element={<ProductEditorPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="/markets" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
