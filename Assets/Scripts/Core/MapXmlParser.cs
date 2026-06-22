using System;
using System.Xml;
using UnityEngine;

namespace OHTSim.Core
{
    // 웹 에디터 xmlSerializer.ts 출력 포맷 파서
    // <OHTMap> → OHTMapData
    public static class MapXmlParser
    {
        public static OHTMapData Parse(string xmlText)
        {
            var data = new OHTMapData();
            var doc  = new XmlDocument();
            doc.LoadXml(xmlText);

            var root = doc.DocumentElement;
            // 두 가지 내보내기 포맷 지원: <OHTMap>(구버전) / <OHTSimulation>(신버전)
            if (root == null || (root.Name != "OHTMap" && root.Name != "OHTSimulation"))
                throw new Exception($"올바른 OHTMap XML 파일이 아닙니다. (루트 엘리먼트: {root?.Name ?? "없음"})");

            data.version = GetAttr(root, "version", "Version");

            // 노드 파싱 — 속성 표기 차이(소문자 id/x/y/type ↔ 파스칼 Id/X/Y/Type) 모두 흡수
            var nodeList = root.SelectNodes("Nodes/Node");
            if (nodeList != null)
            {
                foreach (XmlNode xn in nodeList)
                {
                    var node = new MapNode
                    {
                        id     = GetAttr(xn, "id", "Id"),
                        x      = ParseFloat(GetAttr(xn, "x", "X")),
                        y      = ParseFloat(GetAttr(xn, "y", "Y")),
                        type   = ParseNodeType(GetAttr(xn, "type", "Type")),
                    };
                    data.nodes.Add(node);
                }
            }

            // 엣지 파싱 — weight(구버전) / Cost(신버전) 모두 대응
            var edgeList = root.SelectNodes("Edges/Edge");
            if (edgeList != null)
            {
                foreach (XmlNode xe in edgeList)
                {
                    var edge = new MapEdge
                    {
                        id     = GetAttr(xe, "id", "Id"),
                        fromId = GetAttr(xe, "from", "From"),
                        toId   = GetAttr(xe, "to", "To"),
                        weight = ParseFloat(GetAttr(xe, "weight", "Weight", "cost", "Cost"), 1f),
                    };
                    data.edges.Add(edge);
                }
            }

            return data;
        }

        // 여러 후보 속성명 중 처음 존재하는 값을 반환 — 포맷별 대소문자 차이를 흡수한다.
        static string GetAttr(XmlNode node, params string[] names)
        {
            var attrs = node?.Attributes;
            if (attrs == null) return "";
            foreach (var name in names)
            {
                var a = attrs[name];
                if (a != null) return a.Value;
            }
            return "";
        }

        static float ParseFloat(string v, float def = 0f)
            => float.TryParse(v, System.Globalization.NumberStyles.Float,
               System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : def;

        static NodeType ParseNodeType(string v)
            => Enum.TryParse<NodeType>(v, out var t) ? t : NodeType.Normal;
    }
}
