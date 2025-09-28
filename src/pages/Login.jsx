import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // 检查是否已登录：如果已登录，直接跳转到 dashboard
  useEffect(() => {
    if (localStorage.getItem('authToken') === 'logged_in_admin_token') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // 检查账号密码：admin, admin
    if (username === 'admin' && password === 'admin') {
      // 登录成功：设置 Token 并跳转
      localStorage.setItem('authToken', 'logged_in_admin_token');
      navigate('/admin/dashboard', { replace: true });
    } else {
      alert('账号或密码错误：请使用 admin / admin');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <h2>RSVideo 管理员登录</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="username">账号 (admin):</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password">密码 (admin):</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          登录
        </button>
      </form>
    </div>
  );
}
export default Login;