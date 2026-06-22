import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopBar } from './components/layout/TopBar';
import { EditorPage } from './pages/EditorPage';
import { ProcessPage } from './pages/ProcessPage';
import { AlgorithmPageRoute } from './pages/AlgorithmPageRoute';
import { MapDesignPage } from './pages/MapDesignPage';
import { SimulationPage } from './pages/SimulationPage';
import { ArchitecturePage } from './pages/ArchitecturePage';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0d1117',
        color: '#e6edf3',
        fontFamily: "'Segoe UI', sans-serif",
        overflow: 'hidden',
      }}>
        <TopBar />
        <Routes>
          <Route path="/"            element={<Navigate to="/editor" replace />} />
          <Route path="/editor"      element={<EditorPage />} />
          <Route path="/process"     element={<ProcessPage />} />
          <Route path="/algorithm"   element={<AlgorithmPageRoute />} />
          <Route path="/map-design"  element={<MapDesignPage />} />
          <Route path="/simulation"  element={<SimulationPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
