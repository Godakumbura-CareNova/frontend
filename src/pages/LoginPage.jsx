import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateLoginForm } from '../utils/validation';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import pharmacyLogo from '../assets/PHARMACY LOGO .jpeg';

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const getDashboardRouteByRole = (role) => {
    if (role === 'Patient' || role === 'User') return '/patient-dashboard';
    if (role === 'Doctor') return '/doctor-dashboard';
    if (role === 'PharmacyStaff' || role === 'Pharmacy Staff') return '/pharmacy-dashboard';
    if (role === 'Admin') return '/admin-dashboard';
    return '/forbidden';
  };

  const mapAuthErrorMessage = (err) => {
    if (!err?.response) {
      return 'Unable to reach the server. Please check your connection and try again.';
    }

    const status = err.response.status;
    const backendCode = String(err.response.data?.code || '').toLowerCase();
    const backendMessage = String(err.response.data?.message || '').toLowerCase();
    const inactiveSignal = backendCode.includes('inactive') || backendMessage.includes('inactive');

    if (status === 401) {
      return 'Invalid email or password.';
    }

    if (status === 403 || status === 423 || inactiveSignal) {
      return 'Your account is inactive or you do not have access.';
    }

    if (status >= 500) {
      return 'Sign in is temporarily unavailable. Please try again later.';
    }

    return 'Failed to sign in. Please check your credentials.';
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const validation = validateLoginForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    try {
      const user = await login(formData.email.trim(), formData.password);
      navigate(getDashboardRouteByRole(user.role), { replace: true });
    } catch (err) {
      setServerError(mapAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glass-card auth-card login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img className="login-logo-image" src={pharmacyLogo} alt="CareNova logo" />
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Welcome</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sign in to access your CareNova portal</p>
        </div>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="login-email"
                type="email"
                name="email"
                className="form-input"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            {errors.email && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-input"
                style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="password-toggle-button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.password}</span>}
            <div style={{ textAlign: 'right', marginTop: '0.4rem' }}>
              <Link to="/forgot-password" className="forgot-password-link" style={{ fontSize: '0.8rem' }}>Forgot password?</Link>
            </div>
          </div>

          <div className="remember-row">
            <label className="remember-label" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary login-submit-button" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account? <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
