using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 맵이 빌드되면 그 크기에 맞춰 공장 환경(바닥/벽/천장/조명)을 자동 생성한다.
    /// 로우폴리 / 어두운 산업 분위기 — 방대한 반도체 FAB 느낌.
    /// SimEvents.MapBuilt 구독 → WorldBounds 기준으로 스케일.
    /// </summary>
    public class FactoryEnvironmentBuilder : MonoBehaviour
    {
        [Header("바닥")]
        [Tooltip("맵 경계 외부로 추가될 여유 공간 (단위)")]
        public float floorPadding = 12f;
        public Color floorColor = new Color(0.85f, 0.88f, 0.92f);  // 세련되고 깨끗한 하이글로시 화이트/실버 클린룸 바닥
        [Tooltip("바닥 그리드 라인 강조 emission (0이면 비활성)")]
        public float floorEmission = 0.15f; // 약간의 발광 반사 효과로 미래지향적 광택 표현

        [Header("벽")]
        public float wallHeight = 10f; // 장비 및 천장 OHT 배치를 위해 높이를 조금 더 높게 조정
        public float wallThickness = 0.5f;
        public Color wallColor = new Color(0.92f, 0.95f, 0.98f);  // 세련된 반도체 공장 화이트 클린룸 판넬 벽
        
        [Header("천장")]
        public bool createCeiling = true;
        public Color ceilingColor = new Color(0.88f, 0.90f, 0.93f);  // 하얀 천장
        
        [Header("조명 (클린룸 분위기)")]
        public bool createPointLights = true;
        [Tooltip("바닥 면적 1유닛²당 라이트 1개 비율 (낮을수록 조명 많아짐)")]
        public float lightDensityArea = 250f; // 조명 밀도를 높여 더 밝고 광활한 분위기 형성
        public float lightHeight = 9f;
        public float lightRange = 22f;
        public float lightIntensity = 2.8f; // 조명 강도를 높여 순백색 클린룸 광원을 극대화
        public Color lightColor = new Color(1.0f, 1.0f, 1.0f);  // 순수 주광색 클린룸 조명
        
        [Header("외곽 기둥")]
        public bool createCornerPillars = true;
        public Color pillarColor = new Color(0.82f, 0.85f, 0.90f);  // 기둥도 클린룸 톤에 맞는 연회색조
        
        [Header("데코 에셋")]
        private readonly string[] DECOR_PREFAB_NAMES = {
            "Line_01", "Line_02", "Line_03", "Line_04", "Line_05", 
            "Line_06", "Line_07", "Line_08", "Line_09",
            "Controller_1", "Controller_2", "Controller_3"
        };

        Transform _envRoot;

        void OnEnable()  => SimEvents.MapBuilt += HandleMapBuilt;
        void OnDisable() => SimEvents.MapBuilt -= HandleMapBuilt;

        void HandleMapBuilt(int _, int __) => Rebuild();

        public void Rebuild()
        {
            Clear();
            var builder = GameServices.MapBuilder;
            if (builder == null) return;
            Bounds b = builder.WorldBounds;

            _envRoot = new GameObject("FactoryEnvironment").transform;
            _envRoot.SetParent(transform, false);

            BuildFloor(b);
            BuildWalls(b);
            if (createCeiling)        BuildCeiling(b);
            if (createCornerPillars)  BuildPillars(b);
            if (createPointLights)    BuildLights(b);
            
            // 스마트 팩토리 내부 장비 및 컨트롤러 에셋 절차적 배치
            BuildFactoryDecor(b, builder);

            Debug.Log($"[FactoryEnvironmentBuilder] 공장 환경 생성 — 바닥 {b.size.x + floorPadding * 2:F0}×{b.size.z + floorPadding * 2:F0}, 벽 높이 {wallHeight}");
        }

        private void BuildFactoryDecor(Bounds b, Map3DBuilder builder)
        {
#if UNITY_EDITOR
            // 에디터에서 에셋 데이터베이스를 사용하여 직접 프리팹을 동적으로 로드합니다.
            float stepX = 10f;
            float stepZ = 10f;

            float minX = b.min.x + 2f;
            float maxX = b.max.x - 2f;
            float minZ = b.min.z + 2f;
            float maxZ = b.max.z - 2f;

            // 빈/역전 바운드 가드 — 맵 재빌드 직후 빈 NodeViews일 때 무한 루프 방지
            if (!(maxX > minX) || !(maxZ > minZ))
            {
                Debug.LogWarning($"[FactoryEnvironmentBuilder] 데코 스킵 — 비정상 bounds (min=({minX:F1},{minZ:F1}) max=({maxX:F1},{maxZ:F1}))");
                return;
            }
            // 안전 상한 — 거대 맵에서 프레임 멈춤 방지
            const int MAX_DECOR_ITERATIONS = 4000;
            int iter = 0;

            for (float x = minX; x <= maxX; x += stepX)
            {
                for (float z = minZ; z <= maxZ; z += stepZ)
                {
                    if (++iter > MAX_DECOR_ITERATIONS)
                    {
                        Debug.LogWarning($"[FactoryEnvironmentBuilder] 데코 반복 상한 도달 — 일부 스킵");
                        return;
                    }
                    // 노드 및 레일 등 핵심 동선과의 충돌 검사
                    if (CheckTooClose(x, z, builder)) continue;

                    // 데코 리스트에서 무작위 프리팹 로드
                    string prefabName = DECOR_PREFAB_NAMES[Random.Range(0, DECOR_PREFAB_NAMES.Length)];
                    GameObject prefab = LoadFactoryPrefab(prefabName);
                    if (prefab != null)
                    {
                        GameObject go = Instantiate(prefab, _envRoot);
                        go.name = $"Decor_{prefabName}_{x:F0}_{z:F0}";
                        go.transform.position = new Vector3(x, 0f, z);
                        
                        // 자연스러움을 위한 무작위 90도 회전 배정
                        float angle = Random.Range(0, 4) * 90f;
                        go.transform.rotation = Quaternion.Euler(0f, angle, 0f);
                    }
                }
            }
#endif
        }

#if UNITY_EDITOR
        private GameObject LoadFactoryPrefab(string name)
        {
            string path = $"Assets/UnityFactorySceneHDRP/Scene_Factory/Background/Prefabs/{name}.prefab";
            return UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(path);
        }
#endif

        private bool CheckTooClose(float x, float z, Map3DBuilder builder)
        {
            Vector2 p = new Vector2(x, z);

            // 1. 노드들과 너무 근접하는지 확인 (임계값: 5.5 유닛)
            foreach (var nodeView in builder.NodeViews.Values)
            {
                float distNode = Vector2.Distance(p, new Vector2(nodeView.WorldPos.x, nodeView.WorldPos.z));
                if (distNode < 5.5f) return true;
            }

            // 2. 천장 레일 선분 경로와 물리적/시각적으로 겹치지 않는지 확인 (임계값: 4.5 유닛)
            foreach (var seg in builder.RailSegments.Values)
            {
                Vector2 s1 = new Vector2(seg.FromPos.x, seg.FromPos.z);
                Vector2 s2 = new Vector2(seg.ToPos.x, seg.ToPos.z);
                
                float distSq = SqrDistanceToSegment(p, s1, s2);
                if (distSq < 20.25f) return true; // 4.5 * 4.5 = 20.25
            }

            return false;
        }

        private float SqrDistanceToSegment(Vector2 p, Vector2 a, Vector2 b)
        {
            Vector2 ab = b - a;
            float l2 = ab.sqrMagnitude;
            if (l2 < 0.0001f) return (p - a).sqrMagnitude;
            float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / l2);
            Vector2 projection = a + t * ab;
            return (p - projection).sqrMagnitude;
        }

        public void Clear()
        {
            if (_envRoot != null)
            {
#if UNITY_EDITOR
                if (!Application.isPlaying) DestroyImmediate(_envRoot.gameObject);
                else                        Destroy(_envRoot.gameObject);
#else
                Destroy(_envRoot.gameObject);
#endif
                _envRoot = null;
            }
        }

        // ── 빌드 메서드 ─────────────────────────────────────────────────
        void BuildFloor(Bounds b)
        {
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.SetParent(_envRoot, false);
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;
            floor.transform.position = new Vector3(b.center.x, -0.55f, b.center.z); // Y=-0.55f로 변경하여 Y=0f의 레일/노드 Z-fighting 차단
            floor.transform.localScale = new Vector3(w, 1f, d);
            ApplyMaterial(floor, floorColor, floorEmission);

            // 클린룸 노란 안전선 스트립 — 메인 축을 따라 길게, 벽 근처에 배치
            Color safetyYellow = new Color(1f, 0.85f, 0f);
            float lineY = 0.02f;
            float lineLen = d * 0.92f;
            float lineWidth = 0.4f;
            float inset = w * 0.32f;
            // 세로 안전선 2개 (메인 통로 양쪽)
            BuildSafetyLine("SafetyLine_L", new Vector3(b.center.x - inset, lineY, b.center.z), new Vector3(lineWidth, 0.04f, lineLen), safetyYellow);
            BuildSafetyLine("SafetyLine_R", new Vector3(b.center.x + inset, lineY, b.center.z), new Vector3(lineWidth, 0.04f, lineLen), safetyYellow);
            // 가로 안전선 2개 (양 끝)
            float crossLen = w * 0.78f;
            float crossInset = d * 0.42f;
            BuildSafetyLine("SafetyLine_N", new Vector3(b.center.x, lineY, b.center.z + crossInset), new Vector3(crossLen, 0.04f, lineWidth), safetyYellow);
            BuildSafetyLine("SafetyLine_S", new Vector3(b.center.x, lineY, b.center.z - crossInset), new Vector3(crossLen, 0.04f, lineWidth), safetyYellow);
        }

        void BuildSafetyLine(string name, Vector3 center, Vector3 scale, Color color)
        {
            var line = GameObject.CreatePrimitive(PrimitiveType.Cube);
            line.name = name;
            line.transform.SetParent(_envRoot, false);
            line.transform.position = center;
            line.transform.localScale = scale;
            var col = line.GetComponent<Collider>();
            if (col != null)
            {
#if UNITY_EDITOR
                if (!Application.isPlaying) DestroyImmediate(col);
                else                        Destroy(col);
#else
                Destroy(col);
#endif
            }
            ApplyMaterial(line, color, 0.6f);
        }

        void BuildWalls(Bounds b)
        {
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;
            float h = wallHeight;

            // North Wall: facing South (0 rotation)
            BuildWallSegmentQuad("Wall_N", new Vector3(b.center.x, h * 0.5f, b.center.z + d * 0.5f), new Vector2(w, h), Quaternion.Euler(0f, 0f, 0f));
            // South Wall: facing North (rotated 180 on Y so local -Z points world +Z)
            BuildWallSegmentQuad("Wall_S", new Vector3(b.center.x, h * 0.5f, b.center.z - d * 0.5f), new Vector2(w, h), Quaternion.Euler(0f, 180f, 0f));
            // East Wall: facing West (rotated 90 on Y so local -Z points world -X)
            BuildWallSegmentQuad("Wall_E", new Vector3(b.center.x + w * 0.5f, h * 0.5f, b.center.z), new Vector2(d, h), Quaternion.Euler(0f, 90f, 0f));
            // West Wall: facing East (rotated -90 on Y so local -Z points world +X)
            BuildWallSegmentQuad("Wall_W", new Vector3(b.center.x - w * 0.5f, h * 0.5f, b.center.z), new Vector2(d, h), Quaternion.Euler(0f, -90f, 0f));
        }

        void BuildWallSegmentQuad(string name, Vector3 center, Vector2 size, Quaternion rotation)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Quad);
            wall.name = name;
            wall.transform.SetParent(_envRoot, false);
            wall.transform.position = center;
            wall.transform.rotation = rotation;
            wall.transform.localScale = new Vector3(size.x, size.y, 1f);

            // 외부 시점 차단 방지 및 성능 최적화를 위한 콜라이더 제거
            var col = wall.GetComponent<Collider>();
            if (col != null)
            {
#if UNITY_EDITOR
                if (!Application.isPlaying) DestroyImmediate(col);
                else                        Destroy(col);
#else
                Destroy(col);
#endif
            }

            ApplyMaterial(wall, wallColor, 0f);
        }

        void BuildCeiling(Bounds b)
        {
            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Quad);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(_envRoot, false);
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;

            // 천장이 아래를 바라보게 회전 (-90f on X): 내부에서는 보이고 외부(탑뷰/공중)에서는 백페이스 컬링으로 투명하게 뚫려 보임
            ceiling.transform.position = new Vector3(b.center.x, wallHeight, b.center.z);
            ceiling.transform.rotation = Quaternion.Euler(-90f, 0f, 0f);
            ceiling.transform.localScale = new Vector3(w, d, 1f);

            var col = ceiling.GetComponent<Collider>();
            if (col != null)
            {
#if UNITY_EDITOR
                if (!Application.isPlaying) DestroyImmediate(col);
                else                        Destroy(col);
#else
                Destroy(col);
#endif
            }

            ApplyMaterial(ceiling, ceilingColor, 0f);
        }

        void BuildPillars(Bounds b)
        {
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;
            float h = wallHeight + 1f;
            var corners = new[]
            {
                new Vector3(b.center.x + w * 0.5f, h * 0.5f, b.center.z + d * 0.5f),
                new Vector3(b.center.x - w * 0.5f, h * 0.5f, b.center.z + d * 0.5f),
                new Vector3(b.center.x + w * 0.5f, h * 0.5f, b.center.z - d * 0.5f),
                new Vector3(b.center.x - w * 0.5f, h * 0.5f, b.center.z - d * 0.5f),
            };
            foreach (var c in corners)
            {
                var pillar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                pillar.name = "Pillar";
                pillar.transform.SetParent(_envRoot, false);
                pillar.transform.position = c;
                pillar.transform.localScale = new Vector3(1.4f, h, 1.4f);
                ApplyMaterial(pillar, pillarColor, 0f);
            }
        }

        void BuildLights(Bounds b)
        {
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;
            float area = w * d;
            int total = Mathf.Max(4, Mathf.CeilToInt(area / lightDensityArea));

            // 격자 형태로 분산
            int cols = Mathf.CeilToInt(Mathf.Sqrt(total * (w / d)));
            int rows = Mathf.CeilToInt((float)total / cols);
            float stepX = w / (cols + 1);
            float stepZ = d / (rows + 1);
            float originX = b.center.x - w * 0.5f;
            float originZ = b.center.z - d * 0.5f;

            for (int r = 0; r < rows; r++)
            {
                for (int c = 0; c < cols; c++)
                {
                    var go = new GameObject($"Light_{r}_{c}");
                    go.transform.SetParent(_envRoot, false);
                    go.transform.position = new Vector3(
                        originX + stepX * (c + 1),
                        lightHeight,
                        originZ + stepZ * (r + 1));
                    var l = go.AddComponent<Light>();
                    l.type      = LightType.Point;
                    l.color     = lightColor;
                    l.range     = lightRange;
                    l.intensity = lightIntensity;
                    l.shadows   = LightShadows.None;  // 성능
                }
            }
        }

        // ── 머티리얼 헬퍼 ────────────────────────────────────────────────
        static Shader _shader;
        void ApplyMaterial(GameObject go, Color color, float emission)
        {
            var rend = go.GetComponent<Renderer>();
            if (rend == null) return;
            if (_shader == null)
                _shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var mat = new Material(_shader);
            mat.color = color;

            // 강제 Cull Back (단면 렌더링) 설정: 앞면(인사이드)만 보이고 뒷면(외부)에서는 완전 투명/관통하도록 설정
            mat.SetFloat("_Cull", (float)UnityEngine.Rendering.CullMode.Back);

            if (emission > 0f)
            {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", color * emission);
            }
            rend.material = mat;
        }
    }
}
