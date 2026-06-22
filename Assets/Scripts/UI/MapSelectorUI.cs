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

            foreach (string name in _mapNames)
            {
                string captured = name;
                Button btn = Instantiate(buttonPrefab, fileListContent);
                btn.GetComponentInChildren<Text>().text = captured;
                btn.onClick.AddListener(() => SelectMap(captured));
            }
        }

        void SelectMap(string mapName)
        {
            panelRoot.SetActive(false);
            loaderService.LoadMap(mapName);
            simController.OnMapLoaded();
        }
    }
}
