import { Link, type LinkProps } from 'react-router-dom'

import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 지금 에디터에 저장 안 한 변경이 있을 때, 그걸 갈아엎는 목적지로 가는
 * 링크를 누르면 한 번 확인한다(개선 로드맵 §5.1 — "어떤 상단 메뉴를 눌러도
 * 미저장 변경이 조용히 사라지지 않는다"). 전엔 로고 클릭에만 이 확인이
 * 있어서, 저장 목록에서 다른 분석을 클릭하면 편집 중이던 게 조용히
 * 사라졌다(App.tsx의 handleLogoClick과 같은 패턴을 재사용 가능한 형태로
 * 뽑아냈다).
 *
 * `/community`·`/versus`·`/share/:id`처럼 에디터 스토어를 건드리지 않는
 * 링크에는 쓰지 않는다 — 스토어를 갈아엎는 목적지(다른 저장된 분석을
 * 불러오는 `/analyses/:id`)로 가는 링크에만 적용한다.
 */
export function GuardedLink({ to, onClick, ...rest }: LinkProps) {
  const isDirty = useAnalysisStore((s) => s.isDirty)

  return (
    <Link
      to={to}
      onClick={(e) => {
        if (isDirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 이동하면 사라집니다. 계속할까요?')) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...rest}
    />
  )
}
