using System.Collections.Generic;
using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 로봇 인스턴스 풀. 런타임 add/remove 시 GameObject를 파괴/생성하지 않고 활성화/비활성화로 토글.
    /// 메모리 할당 최소화 + 60fps 유지를 위해 필수.
    /// </summary>
    public class RobotPool
    {
        readonly GameObject _prefab;
        readonly Transform  _parent;
        readonly Stack<RobotAgent3D> _inactive = new();

        public RobotPool(GameObject prefab, Transform parent)
        {
            _prefab = prefab;
            _parent = parent;
        }

        public RobotAgent3D Rent()
        {
            if (_inactive.Count > 0)
            {
                var r = _inactive.Pop();
                r.gameObject.SetActive(true);
                return r;
            }
            var go = _prefab != null
                ? Object.Instantiate(_prefab, _parent)
                : GameObject.CreatePrimitive(PrimitiveType.Capsule);
            if (_prefab == null) go.transform.SetParent(_parent, false);

            var agent = go.GetComponent<RobotAgent3D>() ?? go.AddComponent<RobotAgent3D>();
            return agent;
        }

        public void Return(RobotAgent3D agent)
        {
            if (agent == null) return;
            agent.gameObject.SetActive(false);
            _inactive.Push(agent);
        }

        public int InactiveCount => _inactive.Count;
    }
}
