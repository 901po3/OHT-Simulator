using OHTSim.Core.Graph;

namespace OHTSim.Simulation
{
    /// <summary>
    /// 데모용 맵: 6×4 격자, 단방향 순환(Serpentine) 레일
    ///
    /// 열 인덱스 0~5, 행 인덱스 0~3
    /// 짝수 행: 좌→우 / 홀수 행: 우→좌
    /// 열 우측 끝: 위→아래 / 열 좌측 끝: 아래→위 (루프 연결)
    ///
    /// Source  : 좌측 열(col=0)의 홀수 행
    /// Dest    : 우측 열(col=5)의 짝수 행
    /// Intersection: 중앙 col=2,3의 모든 행
    /// </summary>
    public static class MapBuilder
    {
        private const int Cols = 6;
        private const int Rows = 4;
        private const float Spacing = 3f; // Unity 단위(미터)

        public static RailGraph BuildDefaultMap()
        {
            var graph = new RailGraph();

            // 노드 생성
            for (int row = 0; row < Rows; row++)
            {
                for (int col = 0; col < Cols; col++)
                {
                    string   id   = NodeId(col, row);
                    float    x    = col * Spacing;
                    float    y    = row * Spacing;
                    NodeType type = ClassifyNode(col, row);
                    graph.AddNode(id, x, y, type);
                }
            }

            // 수평 엣지 (Serpentine)
            for (int row = 0; row < Rows; row++)
            {
                bool leftToRight = (row % 2 == 0);
                if (leftToRight)
                {
                    for (int col = 0; col < Cols - 1; col++)
                        graph.AddEdge(NodeId(col, row), NodeId(col + 1, row));
                }
                else
                {
                    for (int col = Cols - 1; col > 0; col--)
                        graph.AddEdge(NodeId(col, row), NodeId(col - 1, row));
                }
            }

            // 수직 루프 연결 (좌측 열: 아래→위, 우측 열: 위→아래)
            for (int row = 0; row < Rows - 1; row++)
            {
                // 우측 끝: 짝수 행의 끝에서 다음 행으로 내려감
                if (row % 2 == 0)
                    graph.AddEdge(NodeId(Cols - 1, row), NodeId(Cols - 1, row + 1));
                else
                    graph.AddEdge(NodeId(0, row), NodeId(0, row + 1));
            }

            return graph;
        }

        private static NodeType ClassifyNode(int col, int row)
        {
            if (col == 0 && row % 2 == 1) return NodeType.Source;
            if (col == Cols - 1 && row % 2 == 0) return NodeType.Destination;
            if (col == 2 || col == 3) return NodeType.Intersection;
            return NodeType.Normal;
        }

        private static string NodeId(int col, int row) => $"N{col}_{row}";
    }
}
