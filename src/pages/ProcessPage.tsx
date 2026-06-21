import { ProcessViewer } from '../components/process/ProcessViewer';

export function ProcessPage() {
  return (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 48px)', background: '#0d1117' }}>
      <ProcessViewer />
    </div>
  );
}
