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
            if (root == null || root.Name != "OHTMap")
                throw new Exception("올바른 OHTMap XML 파일이 아닙니다.");

            data.version = root.GetAttribute("version");

            // 노드 파싱
            var nodeList = root.SelectNodes("Nodes/Node");
            if (nodeList != null)
            {
                foreach (XmlNode xn in nodeList)
                {
                    var node = new MapNode
                    {
                        id     = xn.Attributes?["id"]?.Value ?? "",
                        x      = ParseFloat(xn.Attributes?["x"]?.Value),
                        y      = ParseFloat(xn.Attributes?["y"]?.Value),
                        type   = ParseNodeType(xn.Attributes?["type"]?.Value),
                    };
                    data.nodes.Add(node);
                }
            }

            // 엣지 파싱
            var edgeList = root.SelectNodes("Edges/Edge");
            if (edgeList != null)
            {
                foreach (XmlNode xe in edgeList)
                {
                    var edge = new MapEdge
                    {
                        id     = xe.Attributes?["id"]?.Value ?? "",
                        fromId = xe.Attributes?["from"]?.Value ?? "",
                        toId   = xe.Attributes?["to"]?.Value ?? "",
                        weight = ParseFloat(xe.Attributes?["weight"]?.Value, 1f),
                    };
                    data.edges.Add(edge);
                }
            }

            return data;
        }

        static float ParseFloat(string v, float def = 0f)
            => float.TryParse(v, System.Globalization.NumberStyles.Float,
               System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : def;

        static NodeType ParseNodeType(string v)
            => Enum.TryParse<NodeType>(v, out var t) ? t : NodeType.Normal;
    }
}
