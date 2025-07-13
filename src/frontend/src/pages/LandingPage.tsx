import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/landing-page-warm.css';

interface BetaRequest {
  fullName: string;
  email: string;
  company: string;
  role: string;
  portfolioSize: string;
  additionalInfo: string;
}

interface LoginFormData {
  email: string;
  password: string;
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<BetaRequest>({
    fullName: '',
    email: '',
    company: '',
    role: '',
    portfolioSize: '',
    additionalInfo: ''
  });
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLoginInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
    if (loginError) setLoginError(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiUrl}/api/beta-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: 'landing_page'
        })
      });

      if (response.ok) {
        setShowSuccess(true);
        setFormData({
          fullName: '',
          email: '',
          company: '',
          role: '',
          portfolioSize: '',
          additionalInfo: ''
        });
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('There was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      await login(loginData);
      navigate('/today');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Header Navigation */}
      <header className="main-header">
        <div className="container">
          <div className="nav-brand">
            <h1 className="logo">NPLVision</h1>
          </div>
          <nav className="main-nav">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#solutions" onClick={(e) => { e.preventDefault(); scrollToSection('solutions'); }}>Solutions</a>
            <a href="#beta-access" onClick={(e) => { e.preventDefault(); scrollToSection('beta-access'); }}>Beta Access</a>
          </nav>
          <div className="auth-actions">
            <div className="inline-login-fields">
              <input
                type="email"
                name="email"
                placeholder="Email"
                className="login-input-field"
                value={loginData.email}
                onChange={handleLoginInputChange}
                disabled={loginLoading}
              />
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  className="login-input-field password-field"
                  value={loginData.password}
                  onChange={handleLoginInputChange}
                  disabled={loginLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                className="btn-secondary login-btn" 
                onClick={handleLoginSubmit}
                disabled={loginLoading || !loginData.email || !loginData.password}
              >
                {loginLoading ? 'Signing In...' : 'Login'}
              </button>
            </div>
            <button className="btn-primary" onClick={() => scrollToSection('beta-access')}>Get Started</button>
            {loginError && (
              <div className="login-error-inline">
                {loginError}
              </div>
            )}
          </div>
          <button 
            className="mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            ☰
          </button>
          {/* Mobile Navigation */}
          <nav className={`mobile-nav ${isMobileMenuOpen ? '' : 'hidden'}`}>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); setIsMobileMenuOpen(false); }}>Features</a>
            <a href="#solutions" onClick={(e) => { e.preventDefault(); scrollToSection('solutions'); setIsMobileMenuOpen(false); }}>Solutions</a>
            <a href="#beta-access" onClick={(e) => { e.preventDefault(); scrollToSection('beta-access'); setIsMobileMenuOpen(false); }}>Beta Access</a>
            <div className="mobile-login-fields">
              <input
                type="email"
                name="email"
                placeholder="Email"
                className="login-input-field mobile"
                value={loginData.email}
                onChange={handleLoginInputChange}
                disabled={loginLoading}
              />
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  className="login-input-field password-field mobile"
                  value={loginData.password}
                  onChange={handleLoginInputChange}
                  disabled={loginLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                className="btn-secondary login-btn" 
                onClick={() => { handleLoginSubmit(); setIsMobileMenuOpen(false); }}
                disabled={loginLoading || !loginData.email || !loginData.password}
              >
                {loginLoading ? 'Signing In...' : 'Login'}
              </button>
            </div>
            <button className="btn-primary" onClick={() => { scrollToSection('beta-access'); setIsMobileMenuOpen(false); }}>Get Started</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">From mortgage data to investment alpha</h1>
            <p className="hero-subtitle">
              Sophisticated analytics platform that helps mortgage investors and fund managers maximize portfolio returns, minimize risk exposure, and make data-driven investment decisions.
            </p>
            <div className="hero-actions">
              <button 
                className="btn-primary-lg" 
                onClick={() => window.open('https://nplvision.com/demo', '_blank')}
              >
                View Live Demo
              </button>
              <button 
                className="btn-secondary-lg" 
                onClick={() => scrollToSection('features')}
              >
                Learn More
              </button>
            </div>
            
          </div>
          <div className="hero-visual">
            <div className="dashboard-preview">
              <div className="preview-card">
                <div className="preview-header">Portfolio Dashboard</div>
                <div className="preview-metrics">
                  <div className="metric">
                    <span className="metric-value">$4.7B</span>
                    <span className="metric-label">Assets Under Management</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">18.3%</span>
                    <span className="metric-label">Portfolio IRR</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">2,847</span>
                    <span className="metric-label">Active Loans</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">$287M</span>
                    <span className="metric-label">YTD Recovery Value</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">15.2%</span>
                    <span className="metric-label">Alpha vs Benchmark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title">Sophisticated tools for mortgage portfolio management</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Portfolio Dashboard</h3>
              <p>Real-time investment performance metrics with comprehensive analytics to track returns, risk exposure, and market trends.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>Advanced Collateral Analysis</h3>
              <p>Automated loan file review powered by AWS - reduce due diligence time by 80% with intelligent risk assessment and valuation analysis.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Investment Explorer</h3>
              <p>Advanced filtering and search capabilities to identify opportunities, assess risk, and optimize portfolio allocation across your mortgage investments.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Natural Language Queries</h3>
              <p>Ask questions in plain English, get instant investment insights. "Show me all loans with declining values in high-risk markets" - we've got answers.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <h3>Asset Recovery Optimization</h3>
              <p>Identify bottlenecks before they impact returns with intelligent timeline management and recovery strategy optimization.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="solutions-section">
        <div className="container">
          <h2 className="section-title">Built for investment professionals</h2>
          <div className="solutions-grid">
            <div className="solution-card">
              <h3>Mortgage Investors</h3>
              <p>Portfolio performance optimization and comprehensive risk management for individual and institutional mortgage investments.</p>
              <ul>
                <li>Real-time portfolio performance tracking</li>
                <li>Risk exposure analysis and alerts</li>
                <li>Predictive analytics for market trends</li>
              </ul>
            </div>
            <div className="solution-card">
              <h3>Hedge Funds</h3>
              <p>Alpha generation and sophisticated risk analytics for quantitative mortgage investment strategies.</p>
              <ul>
                <li>Advanced quantitative modeling</li>
                <li>Market opportunity identification</li>
                <li>Portfolio optimization algorithms</li>
              </ul>
            </div>
            <div className="solution-card">
              <h3>Family Offices</h3>
              <p>Diversified real estate debt strategies and wealth preservation through sophisticated mortgage investments.</p>
              <ul>
                <li>Diversification analysis and recommendations</li>
                <li>Long-term wealth preservation strategies</li>
                <li>Custom reporting for stakeholders</li>
              </ul>
            </div>
            <div className="solution-card">
              <h3>Banks</h3>
              <p>Commercial mortgage portfolio management and regulatory compliance with institutional-grade analytics.</p>
              <ul>
                <li>Regulatory compliance monitoring</li>
                <li>Credit risk assessment</li>
                <li>Portfolio stress testing</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Access Section */}
      <section id="beta-access" className="beta-access-section">
        <div className="container">
          <h2 className="section-title">Request Beta Access</h2>
          <p className="section-subtitle">
            Join select mortgage investors and fund managers testing NPLVision's advanced portfolio analytics platform.
          </p>
          
          {!showSuccess ? (
            <form className="beta-access-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="full-name">Full Name</label>
                  <input 
                    type="text" 
                    id="full-name" 
                    name="fullName" 
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    value={formData.email}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="company">Company/Fund</label>
                  <input 
                    type="text" 
                    id="company" 
                    name="company" 
                    value={formData.company}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="role">Role/Title</label>
                  <input 
                    type="text" 
                    id="role" 
                    name="role" 
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="e.g., Portfolio Manager, Investment Director" 
                    required 
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="portfolio-size">Mortgage Portfolio Size (AUM)</label>
                <select 
                  id="portfolio-size" 
                  name="portfolioSize" 
                  value={formData.portfolioSize}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select portfolio size...</option>
                  <option value="under-25m">Under $25 million</option>
                  <option value="25m-100m">$25 - $100 million</option>
                  <option value="100m-500m">$100 - $500 million</option>
                  <option value="500m-1b">$500 million - $1 billion</option>
                  <option value="1b-5b">$1 - $5 billion</option>
                  <option value="over-5b">Over $5 billion</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="additional-info">Investment Focus (Optional)</label>
                <textarea 
                  id="additional-info" 
                  name="additionalInfo" 
                  value={formData.additionalInfo}
                  onChange={handleInputChange}
                  rows={4} 
                  placeholder="Tell us about your investment strategy, target markets, or specific analytics needs..."
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn-primary-lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Request Beta Access'}
                </button>
                <p className="form-note">
                  Limited beta spots available for qualified investors. We'll be in touch within 24 hours.
                </p>
              </div>
            </form>
          ) : (
            <div className="success-message">
              <h3>Thank you for your interest!</h3>
              <p>
                We've received your beta access request and will be in touch within 24 hours 
                to discuss your investment analytics needs.
              </p>
              <button 
                className="btn-secondary" 
                onClick={() => setShowSuccess(false)}
              >
                Submit Another Request
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="main-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>NPLVision</h3>
              <p>Sophisticated analytics for mortgage investors</p>
            </div>
            <div className="footer-links">
              <div className="link-group">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#solutions">Solutions</a>
                <a href="#beta-access">Beta Access</a>
              </div>
              <div className="link-group">
                <h4>Company</h4>
                <a href="#about">About</a>
                <a href="#contact">Contact</a>
                <a href="/login">Login</a>
              </div>
              <div className="link-group">
                <h4>Legal</h4>
                <a href="#privacy">Privacy Policy</a>
                <a href="#terms">Terms of Service</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 NPLVision. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;