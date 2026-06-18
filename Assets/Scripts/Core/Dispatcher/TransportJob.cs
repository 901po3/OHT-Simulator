using OHTSim.Core.Graph;

namespace OHTSim.Core.Dispatcher
{
    public class TransportJob
    {
        public string   Id              { get; }
        public RailNode SourceNode      { get; }
        public RailNode DestinationNode { get; }

        public TransportJob(string id, RailNode source, RailNode destination)
        {
            Id              = id;
            SourceNode      = source;
            DestinationNode = destination;
        }

        public override string ToString() => $"Job({Id}: {SourceNode.Id}→{DestinationNode.Id})";
    }
}
