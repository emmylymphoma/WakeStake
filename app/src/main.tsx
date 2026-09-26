import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createServices } from './services/createServices';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createServices()
  .then((services) =>
    createRoot(root).render(
      <StrictMode>
        <App services={services} />
      </StrictMode>,
    ),
  )
  .catch((e: unknown) => {
    root.textContent = `WakeStake couldn’t start: ${e instanceof Error ? e.message : String(e)}`;
  });
