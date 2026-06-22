using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using System.Collections.Generic;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 우상단 미니맵 UI — RawImage에 MinimapCamera의 RenderTexture를 표시한다.
    /// 원형 쉴드 텍스처 마스크, 회전하는 컴퍼스 베젤(N,E,S,W), 레이더 스위퍼 라인, 
    /// 그리고 부드럽게 화면 밖으로 숨겨지는 스무스 폴딩 시스템을 "게이머 센스"로 자동 생성합니다.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class MinimapRenderer : MonoBehaviour, IPointerClickHandler
    {
        public static RenderTexture SharedRenderTexture { get; private set; }

        [Header("의존성")]
        public MinimapCamera        minimapCam;
        public CameraModeController modeController;

        [Header("UI 요소")]
        public RawImage rawImage;
        public RectTransform rootRect;

        // ── 게이머 센스 전용 UI 장식 필드 (런타임 동적 생성) ────────────────
        private RectTransform _foldingRoot;   // 실제 접히고 펴지는 전체 컨테이너
        private RectTransform _bezelRing;     // 메인 카메라 각도와 연동되는 나침반 링
        private RectTransform _sweepLine;     // 빙글빙글 회전하는 스캐너 라인
        private RectTransform _toggleButton;  // 접고 펴기 버튼
        private UnityEngine.UI.Text _toggleBtnText;
        private RectTransform _exitTopViewButton; // 탑뷰 전용 종료 버튼 (닫을 수 없는 버그 해결)

        private bool _isCollapsed = false;
        private Vector2 _targetAnchoredPos;
        private Vector2 _velocity = Vector2.zero;
        private float _smoothTime = 0.18f;

        private Vector2 _originalMargin;
        private Vector2 _originalSize;

        VisualizationConfig _config;

        void Awake()
        {
            if (rawImage == null) rawImage = GetComponent<RawImage>();
            if (rootRect == null) rootRect = GetComponent<RectTransform>();
        }

        void Start()
        {
            _config = GameServices.Config;
            
            _originalSize = _config != null ? _config.minimapSize : new Vector2(220, 220);
            _originalMargin = _config != null ? _config.minimapMargin : new Vector2(20, 20);

            // 게이머 주스 UI 구성 요소 런타임 빌드 (프리팹 수정 불필요) - RenderTexture 확보 전에 실행하여 참조 우회 확보
            BuildGamerJuiceUI();

            EnsureRenderTexture();
            ApplyLayout(SimEvents.CameraMode.ThirdPerson);
        }

        void OnEnable()  => SimEvents.CameraModeChanged += ApplyLayout;
        void OnDisable() => SimEvents.CameraModeChanged -= ApplyLayout;

        void OnDestroy()
        {
            if (minimapCam != null && minimapCam.Cam != null)
                minimapCam.Cam.targetTexture = null;
            if (rawImage != null)
                rawImage.texture = null;
            if (SharedRenderTexture != null)
            {
                SharedRenderTexture.Release();
                SharedRenderTexture = null;
            }
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            // 클릭 시 폅치기(Toggle) 처리 혹은 버튼 자체 클릭으로만 접고싶다면 여기서는 무시 가능하지만,
            // 배경 빈공간 클릭 시에만 풀스크린 토뷰로 가도록 마우스 레이캐스트 타겟팅을 걸어둠.
            if (modeController == null) return;
            modeController.ToggleTopView();
        }

        void Update()
        {
            if (minimapCam != null && modeController != null)
                minimapCam.HandleTopViewInput(modeController.CurrentMode);

            // 1. 컴퍼스 베젤 회전 (메인 카메라 요각과 동기화)
            var cam = Camera.main;
            if (_bezelRing != null && cam != null)
            {
                _bezelRing.localRotation = Quaternion.Euler(0, 0, cam.transform.eulerAngles.y);
            }

            // 2. 레이더 스위핑 회전 (빙글빙글 돕니다)
            if (_sweepLine != null)
            {
                _sweepLine.Rotate(Vector3.forward, -210f * Time.deltaTime);
            }

            // 3. 미니맵 슬라이딩 접힘/열림 LERP
            if (_foldingRoot != null && modeController != null && modeController.CurrentMode != SimEvents.CameraMode.FullscreenTopView)
            {
                _foldingRoot.anchoredPosition = Vector2.SmoothDamp(
                    _foldingRoot.anchoredPosition, 
                    _targetAnchoredPos, 
                    ref _velocity, 
                    _smoothTime
                );
            }
        }

        void EnsureRenderTexture()
        {
            if (SharedRenderTexture != null) return;
            Vector2 size = _config != null ? _config.minimapSize : new Vector2(220, 220);
            SharedRenderTexture = new RenderTexture(
                Mathf.RoundToInt(size.x * 2),
                Mathf.RoundToInt(size.y * 2),
                16);
            SharedRenderTexture.name = "MinimapRT";
            if (minimapCam != null) minimapCam.Cam.targetTexture = SharedRenderTexture;
            if (rawImage != null)   rawImage.texture = SharedRenderTexture;
        }

        void ApplyLayout(SimEvents.CameraMode mode)
        {
            if (rootRect == null) return;

            if (mode == SimEvents.CameraMode.FullscreenTopView)
            {
                if (rawImage != null) rawImage.enabled = false;
                if (_foldingRoot != null) _foldingRoot.gameObject.SetActive(false);
                if (_toggleButton != null) _toggleButton.gameObject.SetActive(false);
                if (_exitTopViewButton != null) _exitTopViewButton.gameObject.SetActive(true); // 탑뷰 탈출 버튼 활성화
            }
            else
            {
                // 기본 레이아웃 적용
                rootRect.anchorMin = new Vector2(1, 1);
                rootRect.anchorMax = new Vector2(1, 1);
                rootRect.pivot     = new Vector2(1, 1);
                rootRect.sizeDelta        = _originalSize;
                rootRect.anchoredPosition = new Vector2(-_originalMargin.x, -_originalMargin.y);
                
                if (rawImage != null) rawImage.enabled = true;
                if (_foldingRoot != null) _foldingRoot.gameObject.SetActive(true);
                if (_toggleButton != null) _toggleButton.gameObject.SetActive(true);
                if (_exitTopViewButton != null) _exitTopViewButton.gameObject.SetActive(false); // 탑뷰 탈출 버튼 비활성화

                // 현재 접힘 상태에 따른 타겟 포지션 재설정
                UpdateCollapseTarget();
                if (_foldingRoot != null) _foldingRoot.anchoredPosition = _targetAnchoredPos;
            }
        }

        private void UpdateCollapseTarget()
        {
            if (_isCollapsed)
            {
                // 화면 밖 우측으로 완전히 슬라이드 (가로 크기 + 마진 여유만큼 밀어냄)
                _targetAnchoredPos = new Vector2(_originalSize.x + 30f, 0f);
            }
            else
            {
                // 원래 자리 (0, 0)
                _targetAnchoredPos = Vector2.zero;
            }
        }

        public void ToggleCollapse()
        {
            _isCollapsed = !_isCollapsed;
            UpdateCollapseTarget();
            if (_toggleBtnText != null)
            {
                _toggleBtnText.text = _isCollapsed ? "◀ RADAR" : "▶ CLOSE";
                _toggleBtnText.color = _isCollapsed ? new Color(0f, 0.9f, 1f) : new Color(1f, 0.3f, 0.3f);
            }
        }

        private void BuildGamerJuiceUI()
        {
            // 기존 rawImage 컴포넌트 비활성화 (순환 부모-자식 루프 차단)
            if (rawImage != null)
            {
                rawImage.enabled = false;
            }

            // ─── A. 레이아웃 재배치 (접기 대상을 위한 리팩토링) ───
            // 기존 rootRect는 캔버스 앵커 고정용으로 두고, 실제 LERP 이동을 담당할 독립 컨테이너를 하위에 둡니다.
            GameObject foldingGo = new GameObject("MinimapFoldingContainer", typeof(RectTransform));
            _foldingRoot = foldingGo.GetComponent<RectTransform>();
            _foldingRoot.SetParent(rootRect, false);
            _foldingRoot.anchorMin = Vector2.zero;
            _foldingRoot.anchorMax = Vector2.one;
            _foldingRoot.pivot = Vector2.one; // (1,1) 우상단 기준
            _foldingRoot.sizeDelta = Vector2.zero;
            _foldingRoot.anchoredPosition = Vector2.zero;

            // ─── B. 원형 마스크(Mask) 적용 (게이머 마스크!) ───
            // 원형 텍스처를 런타임에 동적으로 그리고 Mask와 Image를 _foldingRoot에 세팅합니다.
            var maskImage = foldingGo.AddComponent<UnityEngine.UI.Image>();
            maskImage.sprite = CreateCircleSprite();
            foldingGo.AddComponent<UnityEngine.UI.Mask>().showMaskGraphic = true;

            // ─── B-2. 새로운 RawImage 자식 생성 (순환 참조 회피의 핵심!) ───
            GameObject displayGo = new GameObject("MinimapDisplay", typeof(RectTransform));
            var displayRect = displayGo.GetComponent<RectTransform>();
            displayRect.SetParent(_foldingRoot, false);
            displayRect.anchorMin = Vector2.zero;
            displayRect.anchorMax = Vector2.one;
            displayRect.sizeDelta = Vector2.zero;
            displayRect.anchoredPosition = Vector2.zero;

            var newRawImg = displayGo.AddComponent<UnityEngine.UI.RawImage>();
            rawImage = newRawImg; // 참조를 새 자식 RawImage로 우회하여 RenderTexture가 원형 마스크 속에 렌더링되도록 함!

            // ─── C. 레이더 스위퍼 라인 (Sweep Scan Line) ───
            GameObject sweepGo = new GameObject("RadarSweepLine", typeof(RectTransform));
            _sweepLine = sweepGo.GetComponent<RectTransform>();
            _sweepLine.SetParent(_foldingRoot, false);
            _sweepLine.anchorMin = new Vector2(0.5f, 0.5f);
            _sweepLine.anchorMax = new Vector2(0.5f, 0.5f);
            _sweepLine.pivot = new Vector2(0.5f, 0f); // 중심을 축으로 회전하게 피벗 세팅
            _sweepLine.sizeDelta = new Vector2(4f, _originalSize.y * 0.5f);
            _sweepLine.anchoredPosition = Vector2.zero;

            var sweepImg = sweepGo.AddComponent<UnityEngine.UI.Image>();
            // 그라데이션 녹/청 발광 연출
            sweepImg.color = new Color(0f, 0.85f, 1f, 0.45f);
            sweepImg.raycastTarget = false;

            // ─── D. 컴퍼스 베젤 링 (Compass Bezel Ring) ───
            GameObject bezelGo = new GameObject("RadarBezelCompass", typeof(RectTransform));
            _bezelRing = bezelGo.GetComponent<RectTransform>();
            _bezelRing.SetParent(_foldingRoot, false);
            _bezelRing.anchorMin = Vector2.zero;
            _bezelRing.anchorMax = Vector2.one;
            _bezelRing.sizeDelta = Vector2.zero;
            _bezelRing.anchoredPosition = Vector2.zero;

            // 동적으로 N, E, S, W 텍스트 자식 추가
            string[] directions = { "N", "E", "S", "W" };
            Vector2[] anchors = {
                new Vector2(0.5f, 0.93f), // North
                new Vector2(0.93f, 0.5f), // East
                new Vector2(0.5f, 0.07f), // South
                new Vector2(0.07f, 0.5f)  // West
            };

            for (int i = 0; i < 4; i++)
            {
                GameObject tGo = new GameObject("Compass_" + directions[i], typeof(RectTransform));
                var tr = tGo.GetComponent<RectTransform>();
                tr.SetParent(_bezelRing, false);
                tr.anchorMin = anchors[i];
                tr.anchorMax = anchors[i];
                tr.sizeDelta = new Vector2(25, 25);
                tr.anchoredPosition = Vector2.zero;

                var txt = tGo.AddComponent<UnityEngine.UI.Text>();
                txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                txt.text = directions[i];
                txt.alignment = TextAnchor.MiddleCenter;
                txt.fontSize = 13;
                txt.fontStyle = FontStyle.Bold;
                txt.color = directions[i] == "N" ? new Color(1f, 0.2f, 0.1f, 0.9f) : new Color(0f, 0.9f, 1f, 0.85f);
                txt.raycastTarget = false;
            }

            // ─── E. 원형 반투명 테두리 쉴드 (Bezel frame) ───
            GameObject frameGo = new GameObject("RadarOuterBezelFrame", typeof(RectTransform));
            var frameRect = frameGo.GetComponent<RectTransform>();
            frameRect.SetParent(_foldingRoot, false);
            frameRect.anchorMin = Vector2.zero;
            frameRect.anchorMax = Vector2.one;
            frameRect.sizeDelta = Vector2.zero;
            frameRect.anchoredPosition = Vector2.zero;

            var frameImg = frameGo.AddComponent<UnityEngine.UI.Image>();
            frameImg.sprite = CreateRingSprite(); // 바깥 테두리 링
            frameImg.color = new Color(0f, 0.85f, 1f, 0.8f);
            frameImg.raycastTarget = false;

            // ─── F. 접고 펴기 버튼 (Minimap Collapse Button) ───
            // rawImage와는 다른 별도 독립적인 RectTransform에 생성하여 접혔을 때도 고정 유지됨.
            GameObject btnGo = new GameObject("MinimapCollapseButton", typeof(RectTransform));
            _toggleButton = btnGo.GetComponent<RectTransform>();
            _toggleButton.SetParent(rootRect, false);
            _toggleButton.anchorMin = new Vector2(1, 1);
            _toggleButton.anchorMax = new Vector2(1, 1);
            _toggleButton.pivot = new Vector2(1, 0.5f); // 오른쪽 기준, 미니맵 하단 왼쪽 즈음에 걸쳐지도록
            _toggleButton.sizeDelta = new Vector2(85, 26);
            // 미니맵 박스 바로 아래 왼쪽에 착 붙음
            _toggleButton.anchoredPosition = new Vector2(-_originalSize.x - 5f, -_originalSize.y * 0.5f);

            var btnImg = btnGo.AddComponent<UnityEngine.UI.Image>();
            btnImg.color = new Color(0.08f, 0.1f, 0.15f, 0.92f);

            // 테두리 선
            var outline = btnGo.AddComponent<UnityEngine.UI.Outline>();
            outline.effectColor = new Color(0f, 0.85f, 1f, 0.5f);
            outline.effectDistance = new Vector2(1, 1);

            var btn = btnGo.AddComponent<UnityEngine.UI.Button>();
            btn.onClick.AddListener(ToggleCollapse);

            GameObject btnTxtGo = new GameObject("Text", typeof(RectTransform));
            var btnTxtRect = btnTxtGo.GetComponent<RectTransform>();
            btnTxtRect.SetParent(_toggleButton, false);
            btnTxtRect.anchorMin = Vector2.zero;
            btnTxtRect.anchorMax = Vector2.one;
            btnTxtRect.sizeDelta = Vector2.zero;
            btnTxtRect.anchoredPosition = Vector2.zero;

            _toggleBtnText = btnTxtGo.AddComponent<UnityEngine.UI.Text>();
            _toggleBtnText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _toggleBtnText.text = "▶ CLOSE";
            _toggleBtnText.alignment = TextAnchor.MiddleCenter;
            _toggleBtnText.fontSize = 11;
            _toggleBtnText.fontStyle = FontStyle.Bold;
            _toggleBtnText.color = new Color(1f, 0.3f, 0.3f);
            
            // 텍스트 샤프닝 적용!
            OHTSim.UI.TextSharpener.SharpenText(_toggleBtnText);

            // ─── G. 탑뷰 종료 버튼 (Minimap Exit Top View Button) ───
            // 미니맵이 탑다운 풀스크린 모드가 되었을 때, 화면 우상단에 "원터치 종료"가 가능한 ❌ EXIT 버튼을 생성합니다.
            GameObject exitGo = new GameObject("MinimapExitTopViewButton", typeof(RectTransform));
            _exitTopViewButton = exitGo.GetComponent<RectTransform>();
            _exitTopViewButton.SetParent(rootRect, false);
            _exitTopViewButton.anchorMin = new Vector2(1, 1);
            _exitTopViewButton.anchorMax = new Vector2(1, 1);
            _exitTopViewButton.pivot = new Vector2(1, 1);
            _exitTopViewButton.sizeDelta = new Vector2(140, 32);
            _exitTopViewButton.anchoredPosition = new Vector2(0f, 0f); // 미니맵 오른쪽 끝 정렬

            var exitImg = exitGo.AddComponent<UnityEngine.UI.Image>();
            exitImg.color = new Color(0.12f, 0.04f, 0.06f, 0.95f); // 딥 레드 테마

            var exitOutline = exitGo.AddComponent<UnityEngine.UI.Outline>();
            exitOutline.effectColor = new Color(1f, 0.2f, 0.1f, 0.7f); // 강렬한 오렌지/레드 발광선
            exitOutline.effectDistance = new Vector2(1.5f, 1.5f);

            var exitBtn = exitGo.AddComponent<UnityEngine.UI.Button>();
            exitBtn.onClick.AddListener(() =>
            {
                if (modeController != null)
                {
                    modeController.SetMode(SimEvents.CameraMode.ThirdPerson);
                }
            });

            GameObject exitTxtGo = new GameObject("Text", typeof(RectTransform));
            var exitTxtRect = exitTxtGo.GetComponent<RectTransform>();
            exitTxtRect.SetParent(_exitTopViewButton, false);
            exitTxtRect.anchorMin = Vector2.zero;
            exitTxtRect.anchorMax = Vector2.one;
            exitTxtRect.sizeDelta = Vector2.zero;
            exitTxtRect.anchoredPosition = Vector2.zero;

            var exitTxt = exitTxtGo.AddComponent<UnityEngine.UI.Text>();
            exitTxt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            exitTxt.text = "❌ EXIT TOP VIEW";
            exitTxt.alignment = TextAnchor.MiddleCenter;
            exitTxt.fontSize = 11;
            exitTxt.fontStyle = FontStyle.Bold;
            exitTxt.color = new Color(1f, 0.3f, 0.3f); // 형광 레드 텍스트

            // 텍스트 샤프닝 적용!
            OHTSim.UI.TextSharpener.SharpenText(exitTxt);

            _exitTopViewButton.gameObject.SetActive(false); // 기본 상태(ThirdPerson)에서는 비활성
        }

        private Sprite CreateCircleSprite()
        {
            // 128x128 픽셀 크기의 완벽한 원형 알파 마스크 생성
            int size = 128;
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            float radius = size * 0.5f;
            float rSqr = radius * radius;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x - radius + 0.5f;
                    float dy = y - radius + 0.5f;
                    float dSqr = dx * dx + dy * dy;

                    if (dSqr <= rSqr)
                        tex.SetPixel(x, y, Color.white);
                    else
                        tex.SetPixel(x, y, Color.clear);
                }
            }
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f));
        }

        private Sprite CreateRingSprite()
        {
            // 128x128 픽셀 크기의 얇은 테두리 링 생성
            int size = 128;
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            float radius = size * 0.5f;
            float rMaxSqr = radius * radius;
            float rMinSqr = (radius - 4f) * (radius - 4f); // 4픽셀 두께

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x - radius + 0.5f;
                    float dy = y - radius + 0.5f;
                    float dSqr = dx * dx + dy * dy;

                    if (dSqr <= rMaxSqr && dSqr >= rMinSqr)
                        tex.SetPixel(x, y, Color.white);
                    else
                        tex.SetPixel(x, y, Color.clear);
                }
            }
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f));
        }
    }
}

