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

        // 파일명(확장자 없이 또는 포함) 으로 로드
        public void LoadMap(string fileName)
        {
            string path = MapPath(fileName);
            if (!File.Exists(path))
            {
                Debug.LogError($"[MapLoaderService] 파일 없음: {path}");
                return;
            }

            string xml = File.ReadAllText(path, System.Text.Encoding.UTF8);
            CurrentMap = MapXmlParser.Parse(xml);
            _builder.Build(CurrentMap);
            Debug.Log($"[MapLoaderService] 로드 완료: {fileName} — 노드 {CurrentMap.nodes.Count}개, 엣지 {CurrentMap.edges.Count}개");
        }

        public void UnloadMap()
        {
            CurrentMap = null;
            _builder.Clear();
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
