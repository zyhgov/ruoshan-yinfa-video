import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // 检查是否已登录：如果已登录，直接跳转到 dashboard
  useEffect(() => {
    // 使用固定的 Token 检查登录状态
    if (localStorage.getItem('authToken') === 'logged_in_admin_token') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // 硬编码的账号密码：admin / admin
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'admin';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // 登录成功：设置 Token 并跳转
      localStorage.setItem('authToken', 'logged_in_admin_token');
      navigate('/admin/dashboard', { replace: true });
    } else {
      alert(`账号或密码错误：请使用 ${ADMIN_USER} / ${ADMIN_PASS}`);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.loginCard}>
        <h2 style={styles.title}>视频管理后台登录</h2>
        <p style={styles.subtitle}>请输入管理员账号密码</p>
        
        <form onSubmit={handleSubmit}>
          
          <div style={styles.inputGroup}>
            <label htmlFor="username" style={styles.label}>管理员账号</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="username"
              required
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="password"
              required
            />
          </div>
          
          <button type="submit" style={styles.button}>
            登 录
          </button>

          <p style={styles.note}>上线环境无法编辑</p>
        </form>
      </div>
    </div>
  );
}

// 样式定义
const styles = {
  pageContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  loginCard: {
    width: '100%',
    maxWidth: '400px',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '8px',
    fontSize: '24px',
    borderBottom: '2px solid #007bff',
    paddingBottom: '10px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6c757d',
    marginBottom: '25px',
    fontSize: '14px',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#555',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box',
    transition: 'border-color 0.3s',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
  },
  note: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#dc3545',
  }
};

export default Login;