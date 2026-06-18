using OHTSim.Core.Graph;

namespace OHTSim.Core.Intersection
{
    public interface IIntersectionManager
    {
        bool TryReserve(RailNode node, string ohtId, float currentTime);
        void Release(RailNode node, string ohtId);
        bool IsReservedBy(RailNode node, string ohtId);
    }
}
