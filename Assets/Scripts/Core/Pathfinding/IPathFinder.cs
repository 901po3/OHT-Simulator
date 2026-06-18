using System.Collections.Generic;
using OHTSim.Core.Graph;

namespace OHTSim.Core.Pathfinding
{
    public interface IPathFinder
    {
        // 시작 노드를 포함한 경로를 반환. 경로 없으면 빈 리스트.
        List<RailNode> FindPath(RailNode from, RailNode to);
    }
}
