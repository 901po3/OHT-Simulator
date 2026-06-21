const DB_NAME = 'oht-maps';
const DB_VERSION = 1;
const STORE_NAME = 'maps';

export interface SavedMap {
  name: string;
  savedAt: number;
  data: { nodes: unknown[]; edges: unknown[] };
}

// 연결 풀: 동일 DB를 여러 번 열지 않도록 Promise를 캐싱한다.
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    req.onsuccess = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      // 다른 탭의 버전 업 시 연결 강제 종료 대비
      db.onversionchange = () => { db.close(); _dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => {
      const err = req.error;
      _dbPromise = null; // reject 전 null 설정 → 재시도 호출이 새 Promise를 만들도록
      reject(err);
    };
  });
  return _dbPromise;
}

export async function saveMap(name: string, data: { nodes: unknown[]; edges: unknown[] }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ name, savedAt: Date.now(), data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listMaps(): Promise<SavedMap[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () =>
      resolve((req.result as SavedMap[]).sort((a, b) => b.savedAt - a.savedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function loadMap(name: string): Promise<SavedMap | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(name);
    req.onsuccess = () => resolve((req.result as SavedMap) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMap(name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
