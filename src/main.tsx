import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
<<<<<<< HEAD
=======
import './features/nutrition/nutrition.css';
import './components/app-shell.css';
>>>>>>> d9d9034 (Senior designer UI upgrade + nutrition page + posture fixes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
