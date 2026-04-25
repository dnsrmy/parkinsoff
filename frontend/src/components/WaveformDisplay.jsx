import { useRef, useEffect } from 'react'

export function WaveformDisplay({ stream, isRecording, height = 80, barColor = '#7C6AF7', backgroundColor = '#F8FAFC' }) {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    if (!stream || !isRecording) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = barColor
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }
    draw()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      audioCtx.close()
    }
  }, [stream, isRecording, barColor, backgroundColor])

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={height}
      style={{
        width: '100%',
        height: height,
        borderRadius: 10,
        background: backgroundColor,
        display: 'block',
      }}
    />
  )
}
