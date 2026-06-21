import { useEffect, useState } from 'react';
import { MapEditor } from '../components/editor/MapEditor';

export function EditorPage() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 48 });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight - 48 });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <MapEditor width={size.w - 180} height={size.h} />;
}
