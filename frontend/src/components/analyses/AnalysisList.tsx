import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DeleteConfirmDialog } from '@/components/analyses/DeleteConfirmDialog'
import { useDeleteAnalysis } from '@/hooks/useAnalyses'
import type { AnalysisSummary } from '@/types/analysis'

/** 저장 목록 테이블 — 썸네일·매치명·팀·태그·일자·수정일시·삭제 (2단계 §11.3, 썸네일·태그는 TO-DO 7번). */
export function AnalysisList({ analyses }: { analyses: AnalysisSummary[] }) {
  const deleteMutation = useDeleteAnalysis()
  const [pending, setPending] = useState<AnalysisSummary | null>(null)

  if (analyses.length === 0) {
    return <p className="text-muted-foreground">저장된 분석이 없습니다.</p>
  }

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium" />
            <th className="py-2 pr-4 font-medium">매치명</th>
            <th className="py-2 pr-4 font-medium">홈팀</th>
            <th className="py-2 pr-4 font-medium">원정팀</th>
            <th className="py-2 pr-4 font-medium">태그</th>
            <th className="py-2 pr-4 font-medium">일자</th>
            <th className="py-2 pr-4 font-medium">수정일시</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {analyses.map((a) => (
            <tr key={a.id} className="border-b border-border">
              <td className="py-2 pr-4">
                <Link to={`/analyses/${a.id}`}>
                  {a.thumbnail ? (
                    <img
                      src={a.thumbnail}
                      alt=""
                      className="h-12 w-auto rounded border border-border object-cover"
                    />
                  ) : (
                    <div className="h-12 w-8 rounded border border-dashed border-border" />
                  )}
                </Link>
              </td>
              <td className="py-2 pr-4">
                <Link to={`/analyses/${a.id}`} className="font-medium text-primary hover:underline">
                  {a.matchName}
                </Link>
              </td>
              <td className="py-2 pr-4">{a.homeTeam}</td>
              <td className="py-2 pr-4">{a.awayTeam}</td>
              <td className="py-2 pr-4">
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-2 pr-4">{a.matchDate}</td>
              <td className="py-2 pr-4 text-muted-foreground">{a.updatedAt}</td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => setPending(a)}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DeleteConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        matchName={pending?.matchName}
        onConfirm={() => {
          if (pending) deleteMutation.mutate(pending.id)
          setPending(null)
        }}
      />
    </>
  )
}
