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
        public Color floorColor = new Color(0.12f, 0.13f, 0.16f);
        [Tooltip("바닥 그리드 라인 강조 emission (0이면 비활성)")]
        public float floorEmission = 0.05f;

        [Header("벽")]
        public float wallHeight = 8f;
        public float wallThickness = 0.5f;
        public Color wallColor = new Color(0.18f, 0.20f, 0.24f);

        [Header("천장")]
        public bool createCeiling = false;
        public Color ceilingColor = new Color(0.08f, 0.09f, 0.11f);

        [Header("조명 (산업 분위기)")]
        public bool createPointLights = true;
        [Tooltip("바닥 면적 1유닛²당 라이트 1개 비율 (낮을수록 조명 많아짐)")]
        public float lightDensityArea = 400f;
        public float lightHeight = 7f;
        public float lightRange = 18f;
        public float lightIntensity = 1.8f;
        public Color lightColor = new Color(1f, 0.92f, 0.78f);  // 따뜻한 산업 형광등

        [Header("외곽 기둥")]
        public bool createCornerPillars = true;
        public Color pillarColor = new Color(0.22f, 0.24f, 0.28f);

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

            Debug.Log($"[FactoryEnvironmentBuilder] 공장 환경 생성 — 바닥 {b.size.x + floorPadding * 2:F0}×{b.size.z + floorPadding * 2:F0}, 벽 높이 {wallHeight}");
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
            floor.transform.position = new Vector3(b.center.x, -0.5f, b.center.z);
            floor.transform.localScale = new Vector3(w, 1f, d);
            ApplyMaterial(floor, floorColor, floorEmission);
        }

        void BuildWalls(Bounds b)
        {
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;
            float h = wallHeight;
            float t = wallThickness;

            // North / South
            BuildWallSegment("Wall_N", new Vector3(b.center.x, h * 0.5f, b.center.z + d * 0.5f), new Vector3(w, h, t));
            BuildWallSegment("Wall_S", new Vector3(b.center.x, h * 0.5f, b.center.z - d * 0.5f), new Vector3(w, h, t));
            // East / West
            BuildWallSegment("Wall_E", new Vector3(b.center.x + w * 0.5f, h * 0.5f, b.center.z), new Vector3(t, h, d));
            BuildWallSegment("Wall_W", new Vector3(b.center.x - w * 0.5f, h * 0.5f, b.center.z), new Vector3(t, h, d));
        }

        void BuildWallSegment(string name, Vector3 center, Vector3 scale)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = name;
            wall.transform.SetParent(_envRoot, false);
            wall.transform.position = center;
            wall.transform.localScale = scale;
            ApplyMaterial(wall, wallColor, 0f);
        }

        void BuildCeiling(Bounds b)
        {
            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(_envRoot, false);
            float w = b.size.x + floorPadding * 2;
            float d = b.size.z + floorPadding * 2;
            ceiling.transform.position = new Vector3(b.center.x, wallHeight, b.center.z);
            ceiling.transform.localScale = new Vector3(w, 0.5f, d);
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
            if (emission > 0f)
            {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", color * emission);
            }
            rend.material = mat;
        }
    }
}
