import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ClientLayout from './components/ClientLayout';
import MouseGlow from './components/MouseGlow';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Computers from './pages/Computers';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Revenue from './pages/Revenue';
import Home from './pages/client/Home';
import Booking from './pages/client/Booking';
import Auth from './pages/client/Auth';
import SupportChat from './pages/client/SupportChat';
import Bookings from './pages/admin/Bookings';
import SupportChatAdmin from './pages/admin/SupportChatAdmin';

export default function App() {
  return (
    <AuthProvider>
      <MouseGlow />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<ClientLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<Booking />} />
            <Route path="/support" element={<SupportChat />} />
            <Route path="/client-login" element={<Auth />} />
          </Route>

          {/* Admin Login */}
          <Route path="/login" element={<Login />} />

          {/* Protected admin routes */}
          <Route path="/admin" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="computers" element={<Computers />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="support" element={<SupportChatAdmin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
