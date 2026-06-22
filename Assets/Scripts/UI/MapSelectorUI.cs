using System;
using UnityEngine;
using UnityEngine.UI;
using OHTSim.Core;
using OHTSim.Simulation;

namespace OHTSim.UI
{
    // 플레이 모드 진입 시 전체화면 맵 선택 패널
    // 맵 파일이 없거나 선택 후 → SimulationController에 위임
    public class MapSelectorUI : MonoBehaviour
    {
        [Header("UI 연결")]
        public GameObject  panelRoot;       // 전체화면 오버레이 패널
        public Transform   fileListContent; // ScrollView > Viewport > Content
        public Button      buttonPrefab;    // 파일 버튼 프리팹
        public Text        emptyLabel;      // 파일 없을 때 안내 텍스트

        [Header("서비스 연결")]
        public MapLoaderService  loaderService;
        public SimulationController simController;

        string[] _mapNames;

        void Start()
        {
            ShowSelector();
        }

        public void ShowSelector()
        {
            panelRoot.SetActive(true);

            // 기존 버튼 제거
            foreach (Transform child in fileListContent)
                Destroy(child.gameObject);

            _mapNames = MapLoaderService.GetAvailableMapNames();

            if (_mapNames.Length == 0)
            {
                emptyLabel.gameObject.SetActive(true);
                emptyLabel.text = "Maps/ 폴더에 .xml 파일이 없습니다.\n웹 에디터에서 맵을 내보낸 후 StreamingAssets/Maps/ 폴더에 넣어주세요.";
                return;
            }

            emptyLabel.gameObject.SetActive(false);
            if (emptyLabel != null) TextSharpener.SharpenText(emptyLabel);

            foreach (string name in _mapNames)
            {
                string captured = name;
                Button btn = Instantiate(buttonPrefab, fileListContent);
                var txt = btn.GetComponentInChildren<Text>();
                txt.text = captured;
                TextSharpener.SharpenText(txt);
                btn.onClick.AddListener(() => SelectMap(captured));
            }
        }

        void SelectMap(string mapName)
        {
            // 먼저 로드를 시도하고, 성공했을 때에만 패널을 닫고 시뮬레이션 흐름으로 넘어간다.
            bool ok = loaderService.LoadMap(mapName);
            if (!ok)
            {
                // 로드 실패: 선택 패널을 유지하고 사용자에게 안내 — 앱이 멈추지 않도록.
                panelRoot.SetActive(true);
                if (emptyLabel != null)
                {
                    emptyLabel.gameObject.SetActive(true);
                    emptyLabel.text = $"'{mapName}' 맵을 불러오지 못했습니다.\n파일 형식이 올바른지 확인한 뒤 다른 맵을 선택해주세요.";
                    TextSharpener.SharpenText(emptyLabel);
                }
                return;
            }

            panelRoot.SetActive(false);
            simController.OnMapLoaded();
        }
    }
}
