import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyAppTheme, getStoredAppTheme, isLoginRoute } from './utils/appTheme';
import './index.css';
import './styles/logged-in-theme.css';
import './styles/logged-in-light-theme.css';
import './styles/logged-in-compact.css';

if (!isLoginRoute()) {
  applyAppTheme(getStoredAppTheme());
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
