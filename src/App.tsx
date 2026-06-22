import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopBar } from './components/layout/TopBar';
import { EditorPage } from './pages/EditorPage';
import { ProcessPage } from './pages/ProcessPage';
import { AlgorithmPageRoute } from './pages/AlgorithmPageRoute';
import { MapDesignPage } from './pages/MapDesignPage';
import { ConsiderationsPage } from './pages/ConsiderationsPage';
import { SimulationPage } from './pages/SimulationPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { useIsMobile } from './hooks/useIsMobile';
import { MobileLayout } from './components/mobile/MobileLayout';
import { EditorMobile } from './components/mobile/EditorMobile';
import { SimulationMobile } from './components/mobile/SimulationMobile';
import { AlgorithmMobile } from './components/mobile/AlgorithmMobile';

export default function App() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BrowserRouter>
        <MobileLayout>
          <Routes>
            <Route path="/"               element={<Navigate to="/editor" replace />} />
            <Route path="/editor"         element={<EditorMobile />} />
            <Route path="/simulation"     element={<SimulationMobile />} />
            <Route path="/algorithm"      element={<AlgorithmMobile />} />
            {/* Text-heavy pages: reuse PC components — mobile CSS adjusts font/padding/tables. */}
            <Route path="/map-design"     element={<div className="mobile-doc"><MapDesignPage /></div>} />
            <Route path="/considerations" element={<div className="mobile-doc"><ConsiderationsPage /></div>} />
            <Route path="/architecture"   element={<div className="mobile-doc"><ArchitecturePage /></div>} />
            <Route path="/process"        element={<div className="mobile-doc"><ProcessPage /></div>} />
          </Routes>
        </MobileLayout>
      </BrowserRouter>
    );
  }

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
          <Route path="/algorithm"       element={<AlgorithmPageRoute />} />
          <Route path="/map-design"      element={<MapDesignPage />} />
          <Route path="/considerations"  element={<ConsiderationsPage />} />
          <Route path="/simulation"      element={<SimulationPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
