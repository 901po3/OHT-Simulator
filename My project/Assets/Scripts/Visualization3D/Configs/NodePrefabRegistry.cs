using System;
using System.Collections.Generic;
using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 노드 타입별 프리팹 매핑 — ScriptableObject로 인스펙터에서 편집.
    /// 새 노드 타입을 추가하려면 (1) Core.NodeType에 enum 추가 (2) 여기 entry 추가만 하면 된다.
    /// 코드 수정 없이 확장 가능.
    /// </summary>
    [CreateAssetMenu(fileName = "NodePrefabRegistry", menuName = "OHT/Node Prefab Registry")]
    public class NodePrefabRegistry : ScriptableObject
    {
        [Serializable]
        public class Entry
        {
            public NodeType   nodeType;
            public GameObject prefab;
            [Tooltip("이 타입 노드 위쪽 라벨 표시 여부")]
            public bool       showLabel = true;
            [Tooltip("프리팹 추가 회전 (도)")]
            public Vector3    rotationOffset;
        }

        [Header("노드 타입별 프리팹")]
        public List<Entry> entries = new();

        [Header("폴백 프리팹 (매핑 없을 때)")]
        public GameObject fallbackPrefab;

        [Header("레일 (일반 통로) 세그먼트")]
        [Tooltip("두 노드 사이를 연결하는 긴 통로 프리팹. 로봇이 이 위를 보행한다.")]
        public GameObject railSegmentPrefab;

        [Tooltip("레일 폭 (Unity 단위)")]
        public float railWidth = 0.6f;

        [Tooltip("레일 두께 (시각적 높이)")]
        public float railHeight = 0.08f;

        // ── 조회 ───────────────────────────────────────────────────────
        Dictionary<NodeType, Entry> _cache;

        public Entry Get(NodeType type)
        {
            BuildCacheIfNeeded();
            return _cache.TryGetValue(type, out var e) ? e : null;
        }

        public GameObject GetPrefab(NodeType type)
        {
            var entry = Get(type);
            if (entry != null && entry.prefab != null) return entry.prefab;
            return fallbackPrefab;
        }

        void BuildCacheIfNeeded()
        {
            if (_cache != null && _cache.Count == entries.Count) return;
            _cache = new Dictionary<NodeType, Entry>();
            foreach (var e in entries)
            {
                if (e != null) _cache[e.nodeType] = e;
            }
        }

        void OnValidate() => _cache = null;
    }
}
