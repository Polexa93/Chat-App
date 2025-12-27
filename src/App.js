import { useState, useEffect } from 'react';
import './App.css';
import { signUp, signIn, getCurrentUser, signOut, verifyAuth } from './services/authService';
import Chat from './components/Chat';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already logged in and verify token
  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = getCurrentUser();
      if (currentUser) {
        // Verify token is still valid
        const verifiedUser = await verifyAuth();
        if (verifiedUser) {
          setUser(verifiedUser);
        }
      }
    };
    checkAuth();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // Sign in
        const loggedInUser = await signIn(email, password);
        setUser(loggedInUser);
        setSuccess('Successfully signed in!');
        // Clear form
        setEmail('');
        setPassword('');
      } else {
        // Sign up
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const newUser = await signUp(name, email, password);
        setUser(newUser);
        setSuccess('Account created successfully!');
        // Clear form
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setUser(null);
    setError('');
    setSuccess('');
  };

  // If user is logged in, show chat interface
  if (user) {
    return <Chat user={user} onSignOut={handleSignOut} />;
  }

  return (
    <div className="App">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Chat App</h1>
            <p className="login-subtitle">
              {isLogin ? 'Welcome back!' : 'Create your account'}
            </p>
          </div>

          {error && (
            <div className="message error-message">
              {error}
            </div>
          )}
          {success && (
            <div className="message success-message">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                />
              </div>
            )}

            {isLogin && (
              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="forgot-password">Forgot password?</a>
              </div>
            )}

            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                className="toggle-button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                  setName('');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
