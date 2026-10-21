import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerMenu from './views/CustomerMenu'
import SalesDashboard from './views/SalesDashboard'
import StaffDashboard from './views/StaffDashboard'
import VisitorPage from './views/VisitorPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Visitor/booking page — default home */}
        <Route path="/" element={<VisitorPage />} />
        <Route path="/book/:slug" element={<VisitorPage />} />

        {/* Staff dashboard */}
        <Route path="/staff" element={<Navigate to="/staff/sakura" replace />} />
        <Route path="/staff/:slug" element={<StaffDashboard />} />

        {/* Customer menu — QR code destination */}
        <Route path="/menu/:slug/:tableNumber" element={<CustomerMenu />} />

        {/* CEO / marketing view: dish performance, seasonal mix, footprint */}
        <Route path="/dashboard" element={<Navigate to="/dashboard/sakura" replace />} />
        <Route path="/dashboard/:slug" element={<SalesDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
