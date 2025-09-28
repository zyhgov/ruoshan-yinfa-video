import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
// ⭐ 1. 引入新的播放组件 ⭐
import PlayerPage from './pages/PlayerPage'; 

// ----------------------------------------------------
// 路由守卫组件：检查用户是否已登录 (通过检查 Local Storage 中的 Token)
// ----------------------------------------------------
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('authToken') === 'logged_in_admin_token';

  if (!isAuthenticated) {
    // 如果未登录，重定向到登录页
    return <Navigate to="/admin" replace />;
  }

  // 如果已登录，显示子组件 (AdminDashboard)
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* 访问 /admin 时显示登录页面 */}
        <Route path="/admin" element={<Login />} />

                {/* ⭐ 2. 新增通用视频播放器路由，无需登录验证 ⭐ */}
                <Route path="/player" element={<PlayerPage />} /> 

        {/* 访问 /admin/dashboard 时，需要通过 ProtectedRoute 检查 */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        
        {/* 首页默认重定向到管理员登录页面 */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        
        {/* 404 页面（可选） */}
        <Route path="*" element={<h1>404 Not Found</h1>} />
      </Routes>
    </Router>
  );
}

export default App;