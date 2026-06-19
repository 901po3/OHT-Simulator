using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace OHTSim.Visualization
{
    public class CameraController : MonoBehaviour
    {
        [Header("Zoom Settings")]
        [SerializeField] private float zoomSpeed = 0.1f;
        [SerializeField] private float minOrthoSize = 3f;
        [SerializeField] private float maxOrthoSize = 25f;
        [SerializeField] private float minFov = 15f;
        [SerializeField] private float maxFov = 90f;

        [Header("Pan Settings")]
        [SerializeField] private float panSpeed = 0.05f;

        private Camera _camera;

        private void Awake()
        {
            _camera = GetComponent<Camera>();
        }

        private void Update()
        {
            HandleZoom();
            HandlePan();
        }

        private void HandleZoom()
        {
#if ENABLE_INPUT_SYSTEM
            var mouse = Mouse.current;
            if (mouse != null)
            {
                float scroll = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(scroll) > 0.01f)
                {
                    if (_camera != null)
                    {
                        float normScroll = scroll * 0.01f;
                        if (_camera.orthographic)
                        {
                            _camera.orthographicSize = Mathf.Clamp(_camera.orthographicSize - normScroll * zoomSpeed * 10f, minOrthoSize, maxOrthoSize);
                        }
                        else
                        {
                            _camera.fieldOfView = Mathf.Clamp(_camera.fieldOfView - normScroll * zoomSpeed * 15f, minFov, maxFov);
                        }
                    }
                }
            }
#endif
        }

        private void HandlePan()
        {
#if ENABLE_INPUT_SYSTEM
            var mouse = Mouse.current;
            if (mouse != null && mouse.rightButton.isPressed)
            {
                Vector2 delta = mouse.delta.ReadValue();
                if (delta.sqrMagnitude > 0.01f)
                {
                    float scale = 1f;
                    if (_camera != null)
                    {
                        scale = _camera.orthographic ? (_camera.orthographicSize / 12f) : 1f;
                    }

                    Vector3 move = new Vector3(-delta.x * panSpeed * 0.1f * scale, 0f, -delta.y * panSpeed * 0.1f * scale);
                    transform.Translate(move, Space.World);
                }
            }
#endif
        }
    }
}