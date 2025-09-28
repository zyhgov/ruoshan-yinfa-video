import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('authToken') === 'logged_in_admin_token') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'admin';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      localStorage.setItem('authToken', 'logged_in_admin_token');
      navigate('/admin/dashboard', { replace: true });
    } else {
      alert('账号或密码错误');
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.loginCard}>
        <div style={styles.logoContainer}>
          <img 
            src="/cloudflare.svg" 
            alt="Logo" 
            style={styles.logo}
          />
        </div>
        <div style={styles.header}>
          <h1 style={styles.title}>视频管理后台</h1>
          <p style={styles.subtitle}>请输入管理员凭证登录</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="username" style={styles.label}>👤 账号</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="username"
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>🔑 密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" style={styles.button}>
            登录系统
          </button>

          <p style={styles.note}>⚠️ 上线环境即便是管理员访问也无法编辑内容 ⚠️</p>
        </form>
      </div>
    </div>
  );
}

// 美化后的样式
const styles = {
  pageContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f0f2f5', // 柔和浅灰背景
    padding: '20px',
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
    // 👇 新增：Logo 容器
  logoContainer: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // 👇 新增：Logo 图片样式
  logo: {
    width: '100%',
    height: 'auto',
    maxWidth: '40px',
    maxHeight: '40px',
    objectFit: 'contain', // 保持比例，避免变形
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    margin: '0 0 12px',
    fontSize: '28px',
    fontWeight: '700',
    color: '#2d3748',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '15px',
    color: '#718096',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#4a5568',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
  },
  // 聚焦状态
  inputFocus: {
    // 通过 :focus 伪类无法在内联样式中实现，但我们可以用 JS 模拟（这里不推荐）
    // 所以建议：保持简单，或使用 CSS-in-JS 库（如 styled-components）
    // 当前方案：依赖浏览器默认聚焦 + 边框颜色变化（通过 border-color）
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '17px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#3182ce', // 蓝色主色
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background-color 0.3s, transform 0.2s',
    marginTop: '8px',
  },
  buttonHover: {
    // 内联样式无法直接写 :hover，但可通过 onMouseEnter/Leave 实现（不推荐复杂化）
    // 所以这里依赖 CSS 的默认行为，或接受简单 hover 效果
  },
  note: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#e53e3e',
    lineHeight: 1.5,
  },
};

// 为 input 和 button 添加动态聚焦/悬停效果（可选增强）
// 但 React 内联样式不支持 :focus/:hover，所以这里我们通过全局 CSS 补充（推荐）

export default Login;