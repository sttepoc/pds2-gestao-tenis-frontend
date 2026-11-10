import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// A base vem antes das telas, para que os estilos de cada tela possam ajustá-la.
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
