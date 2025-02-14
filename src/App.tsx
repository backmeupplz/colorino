import frameSdk, { Context } from '@farcaster/frame-sdk'
import { useEffect, useState } from 'preact/compat'
import toast, { Toaster } from 'react-hot-toast'

const colorFilters: Record<string, string> = {
  none: 'none',
  red: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(0deg)',
  green: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(100deg)',
  blue: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(200deg)',
}

function AppWithContext({ context }: { context: Context.FrameContext }) {
  const [color, setColor] = useState<string>('none')

  if (!context.user.fid) {
    return (
      <div>
        Oops! Seems like you aren't using this website in a Farcaster frame!
        Well, <a href="https://warpcast.com/warpcastadmin.eth">go here</a> and
        use it in a frame.
      </div>
    )
  }

  if (!context.user.pfpUrl) {
    return (
      <div>
        Oops! Seems like you don't have a profile picture set in your Farcaster
        account. Well, go set it and try the frame again.
      </div>
    )
  }

  // This function creates a hidden canvas, draws the filtered image,
  // then triggers a download of that canvas content.
  const handleDownload = async () => {
    try {
      if (!context.user.pfpUrl) {
        throw new Error('Profile picture URL not found')
      }
      const image = new Image()
      image.crossOrigin = 'anonymous' // important for CORS
      image.src = context.user.pfpUrl

      // Wait until the image is loaded/decoded
      await image.decode()

      // Create an offscreen canvas, same size as the image
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const ctx = canvas.getContext('2d')

      // Apply the same filter on the canvas that you used for CSS
      if (ctx) {
        ctx.filter = colorFilters[color] || 'none'
        ctx.drawImage(image, 0, 0)
      }

      // Convert canvas to dataURL and trigger a download
      const link = document.createElement('a')
      link.download = 'filtered-image.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      toast.error(`Error downloading image: ${err}`)
      console.error('Error downloading image:', err)
    }
  }

  return (
    <div className="container prose mx-auto max-w-prose p-10">
      <h1>Colorino</h1>
      <h3>Color your Farcaster PFP!</h3>

      {/* Color filter buttons */}
      <div className="flex gap-2 mb-4">
        <button className="btn btn-red" onClick={() => setColor('red')}>
          Red
        </button>
        <button className="btn btn-green" onClick={() => setColor('green')}>
          Green
        </button>
        <button className="btn btn-blue" onClick={() => setColor('blue')}>
          Blue
        </button>
        <button className="btn" onClick={() => setColor('none')}>
          Reset
        </button>
      </div>

      {/* Render the tinted image */}
      <img
        className="w-full aspect-square object-cover"
        src={context.user.pfpUrl}
        style={{ filter: colorFilters[color] }}
      />

      {/* Download button */}
      <div className="mt-4">
        <button className="btn" onClick={handleDownload}>
          Download Filtered Image
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [context, setContext] = useState<Context.FrameContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getContext() {
      try {
        const fetchedContext = await frameSdk.context
        setContext(fetchedContext)
      } catch (error) {
        setError(error instanceof Error ? error.message : `${error}`)
      } finally {
        frameSdk.actions.ready({})
      }
    }
    getContext()
  }, [])

  return (
    <div className="container prose mx-auto max-w-prose p-10">
      <Toaster />
      {error === null ? (
        context === null ? (
          <div>Loading frame context...</div>
        ) : (
          <AppWithContext context={context} />
        )
      ) : (
        <div>{error}</div>
      )}
    </div>
  )
}
