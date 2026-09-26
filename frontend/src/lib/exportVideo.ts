import { encodeGif, type CapturedFrame } from '@/lib/exportGif'

// GIF 대신 동영상으로 내보내기(2026-09-26, "GIF 말고 움직이는걸 보여줄 수
// 있는 형식이 또 뭐가있지?" → "바꿔줘") — 같은 팔레트 256색 제한도 없고
// 파일 용량도 GIF보다 훨씬 작다. ffmpeg.wasm 같은 인코더는 번들에
// 수십MB를 더해 쓰지 않고, 브라우저 내장 MediaRecorder + canvas.captureStream()
// 조합만 쓴다 — 프레임을 만드는 쪽(exportGif.ts의 buildGifFrameSpecs/
// buildPhaseDataGifFrames, 두 Runner의 오프스크린 toCanvas 캡처 루프)은
// 전혀 안 바꾼다. 이 파일은 이미 캡처된 CapturedFrame[]을 받아 인코딩
// 방식만 GIF에서 동영상으로 바꾸는 마지막 단계만 담당한다.
const CANDIDATE_MIME_TYPES: { mimeType: string; extension: 'mp4' | 'webm' }[] = [
  // Safari(iOS 포함)는 MediaRecorder가 mp4를 직접 만들어내고 webm은 아예
  // 지원하지 않는다 — 반대로 Chrome/Firefox/Android는 mp4를 못 만들고
  // webm만 된다. 하드코딩하지 않고 isTypeSupported로 순서대로 물어본다.
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

function pickSupportedMimeType(): { mimeType: string; extension: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate
  }
  return null
}

/** 이 브라우저에서 동영상 내보내기가 가능한지 — 불가능하면 encodeAnimation이
 * 조용히 GIF로 대체한다(구형 브라우저·MediaRecorder 미지원 환경 대비). */
export function isVideoExportSupported(): boolean {
  if (typeof document === 'undefined') return false
  const testCanvas = document.createElement('canvas')
  if (typeof testCanvas.captureStream !== 'function') return false
  return pickSupportedMimeType() !== null
}

// 목표 재생 길이(2026-09-26 리뷰 — "video does not loop") — 동영상은 GIF와
// 달리 재생 후 자동으로 반복되지 않는다(카톡·사진 앱 등에서 한 번 재생하고
// 멈춤). 원래 요청("계속 왔다갔다 하면 좋겠어")대로 왕복이 반복되는 느낌을
// 주려면 프레임 시퀀스 자체를 여러 번 이어붙여 녹화해야 한다 — 한 바퀴가
// 몇 초든 총 재생 길이가 이 근처(약 6초)가 되도록 반복 횟수를 역산한다.
const TARGET_DURATION_MS = 6000
const MAX_REPEATS = 8

function repeatFrames(frames: CapturedFrame[]): CapturedFrame[] {
  const singlePassMs = frames.reduce((sum, f) => sum + f.delayMs, 0)
  if (singlePassMs <= 0) return frames
  const repeats = Math.min(MAX_REPEATS, Math.max(1, Math.round(TARGET_DURATION_MS / singlePassMs)))
  const result: CapturedFrame[] = []
  for (let i = 0; i < repeats; i++) result.push(...frames)
  return result
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(ms, 1)))
}

export interface EncodedAnimation {
  blob: Blob
  extension: 'mp4' | 'webm' | 'gif'
}

/**
 * 캡처된 프레임들을 실시간으로 하나의 캔버스에 순서대로 그리면서
 * MediaRecorder로 녹화한다 — GIF 인코딩(encodeGif)과 달리 이 부분만큼은
 * 벽시계 시간에 매인다(녹화라는 API 자체의 제약). 그 대신 프레임을
 * 언제·어떻게 만들지는(exportGif.ts) 그대로 결정론적으로 유지된다.
 */
async function encodeVideo(frames: CapturedFrame[]): Promise<EncodedAnimation> {
  const supported = pickSupportedMimeType()
  if (!supported) throw new Error('이 브라우저는 동영상 내보내기를 지원하지 않습니다.')
  if (frames.length === 0) throw new Error('내보낼 프레임이 없습니다.')

  const repeated = repeatFrames(frames)
  const { width, height } = repeated[0].canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 컨텍스트를 만들 수 없습니다.')

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType: supported.mimeType })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (e) => reject(e)
    recorder.onstop = () => resolve(new Blob(chunks, { type: supported.mimeType }))
  })

  recorder.start()
  for (const frame of repeated) {
    ctx.drawImage(frame.canvas, 0, 0, width, height)
    await sleep(frame.delayMs)
  }
  recorder.stop()

  const blob = await stopped
  return { blob, extension: supported.extension }
}

/**
 * 동영상 내보내기가 가능하면 동영상(mp4/webm)으로, 아니면(구형 브라우저 등)
 * 기존 GIF 경로로 조용히 대체한다 — 두 Runner(GifExportRunner,
 * ShareGifExportRunner)가 이 함수 하나만 호출하면 된다.
 */
export async function encodeAnimation(frames: CapturedFrame[]): Promise<EncodedAnimation> {
  if (isVideoExportSupported()) {
    try {
      return await encodeVideo(frames)
    } catch (err) {
      console.error('동영상 인코딩 실패, GIF로 대체합니다', err)
    }
  }
  return { blob: encodeGif(frames), extension: 'gif' }
}
