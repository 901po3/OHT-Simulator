using System.Collections;
using System.IO;
using UnityEngine;

namespace OHTSim.Core
{
    // StreamingAssets/Maps/*.xml 로드 → 파싱 → MapBuilder 호출
    // SRP: 파일 I/O + 오케스트레이션만 담당, 파싱은 MapXmlParser, 렌더링은 MapBuilder
    [RequireComponent(typeof(MapBuilder))]
    public class MapLoaderService : MonoBehaviour
    {
        MapBuilder _builder;

        public OHTMapData CurrentMap { get; private set; }
        public bool IsLoaded => CurrentMap != null;

        void Awake() => _builder = GetComponent<MapBuilder>();

        // 파일명(확장자 없이 또는 포함) 으로 로드.
        // 성공 시 true. 파싱/포맷 오류는 예외를 밖으로 전파하지 않고 false로 반환하여
        // 잘못된 맵 파일 하나가 앱 전체 흐름을 멈추지 않도록 한다.
        public bool LoadMap(string fileName)
        {
            string path = MapPath(fileName);
            if (!File.Exists(path))
            {
                Debug.LogError($"[MapLoaderService] 파일 없음: {path}");
                return false;
            }

            try
            {
                string xml = File.ReadAllText(path, System.Text.Encoding.UTF8);
                var parsed = MapXmlParser.Parse(xml);
                parsed.BuildAdjacency();  // PathfindingBridge / AgentController용 인접 리스트
                CurrentMap = parsed;       // 성공한 경우에만 교체 (실패 시 이전 상태 보존)
                if (_builder != null) _builder.Build(CurrentMap);
                Debug.Log($"[MapLoaderService] 로드 완료: {fileName} — 노드 {CurrentMap.nodes.Count}개, 엣지 {CurrentMap.edges.Count}개");
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[MapLoaderService] 맵 로드 실패: {fileName} — {e.Message}");
                return false;
            }
        }

        public void UnloadMap()
        {
            CurrentMap = null;
            if (_builder != null) _builder.Clear();
        }

        // StreamingAssets/Maps/ 내 .xml 파일 목록
        public static string[] GetAvailableMapNames()
        {
            string dir = MapsDirectory();
            if (!Directory.Exists(dir)) return System.Array.Empty<string>();

            string[] files = Directory.GetFiles(dir, "*.xml");
            string[] names = new string[files.Length];
            for (int i = 0; i < files.Length; i++)
                names[i] = Path.GetFileNameWithoutExtension(files[i]);
            return names;
        }

        public static string MapsDirectory()
            => Path.Combine(Application.streamingAssetsPath, "Maps");

        static string MapPath(string fileName)
        {
            if (Path.HasExtension(fileName)) return Path.Combine(MapsDirectory(), fileName);
            return Path.Combine(MapsDirectory(), fileName + ".xml");
        }
    }
}
