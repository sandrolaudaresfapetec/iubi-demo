import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { MapExplorerPage } from './pages/MapExplorerPage';
import { ContextsPage } from './pages/ContextsPage';
import { CopilotPage } from './pages/CopilotPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="mapa" element={<MapExplorerPage />} />
        <Route path="contextos" element={<ContextsPage />} />
        <Route path="copilot" element={<CopilotPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
