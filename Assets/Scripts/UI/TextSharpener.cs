using UnityEngine;
using UnityEngine.UI;

namespace OHTSim.UI
{
    /// <summary>
    /// 레거시 UI Text 컴포넌트의 뭉개짐(Blurriness) 현상을 해결하는 고해상도 샤프닝 유틸리티.
    /// 폰트 크기(fontSize)를 3배로 키워 고해상도로 렌더링한 후, 
    /// RectTransform의 로컬 스케일을 1/3로 축소하여 완벽하게 선명하고 또렷한 텍스트를 표현합니다 (High-DPI 기법).
    /// </summary>
    public class TextSharpener : MonoBehaviour
    {
        public const float SHARPEN_FACTOR = 3f;

        void Start()
        {
            SharpenAllTextsInCanvas();
        }

        public void SharpenAllTextsInCanvas()
        {
            var texts = GetComponentsInChildren<Text>(true);
            foreach (var txt in texts)
            {
                SharpenText(txt);
            }
        }

        public static void SharpenText(Text txt)
        {
            if (txt == null) return;
            
            // 이미 샤프닝이 적용된 텍스트는 중복 적용 방지
            if (txt.gameObject.GetComponent<SharpenMark>() != null) return;
            txt.gameObject.AddComponent<SharpenMark>();

            // 텍스처 필터링 개선 (Bilinear)
            if (txt.font != null && txt.font.material != null && txt.font.material.mainTexture != null)
            {
                txt.font.material.mainTexture.filterMode = FilterMode.Bilinear;
            }

            // 고품질 렌더링을 위해 크기 증가 및 스케일 감소 적용
            int originalFontSize = txt.fontSize;
            if (originalFontSize <= 0) originalFontSize = 14; // Fallback

            txt.fontSize = Mathf.RoundToInt(originalFontSize * SHARPEN_FACTOR);

            float scaleFactor = 1f / SHARPEN_FACTOR;
            txt.transform.localScale = new Vector3(
                txt.transform.localScale.x * scaleFactor,
                txt.transform.localScale.y * scaleFactor,
                txt.transform.localScale.z
            );

            // 텍스트가 박스 경계에 의해 잘리거나 숨겨지는 현상 원천 예방
            txt.horizontalOverflow = HorizontalWrapMode.Overflow;
            txt.verticalOverflow = VerticalWrapMode.Overflow;
        }
    }

    /// <summary>이미 샤프닝이 완료되었음을 나타내는 마커 컴포넌트</summary>
    internal class SharpenMark : MonoBehaviour { }
}
