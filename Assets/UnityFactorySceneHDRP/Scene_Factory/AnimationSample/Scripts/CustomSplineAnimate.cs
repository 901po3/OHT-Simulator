using System.Collections;
using UnityEngine;
using Unity.Mathematics;

namespace UnityFactorySceneHDRP
{
	[ExecuteAlways]
	public class CustomSplineAnimate : MonoBehaviour
	{
		[System.Serializable]
		private struct StopPoint
		{
			public float time;
			public float duration;
			public Animation robotArmAnimation;
		}



		[SerializeField] private float _duration;
		[SerializeField] private float _startOffset;
		[SerializeField] private StopPoint[] _stopPoints;

		[Header("Preview")]
		[SerializeField, Range(0, 1)] private float _previewTime;


		private Transform _transform;
		private float _time = 0;





		private void Awake()
		{
			if(Application.isPlaying)
			{
				_transform = transform;
				_time += _startOffset;
			}
		}



		private void Start()
		{
		}



		private IEnumerator Animate()
		{
			yield return null;
		}



		private void SetPositionAndRotation(float time)
		{
		}





		#if UNITY_EDITOR
		private void Update()
		{
		}
		#endif
	}
}