import { useEffect, useState } from 'preact/compat'
import frameSdk, { Context } from '@farcaster/frame-sdk'
import toast, { Toaster } from 'react-hot-toast'

const colorFilters: Record<string, string> = {
  original: 'none',
  red: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(0deg)',
  green: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(100deg)',
  blue: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(200deg)',
}

const castUrl = 'https://warpcast.com/warpcastadmin.eth/0x696df624'

function AppWithContext({ context }: { context?: Context.FrameContext }) {
  const [color, setColor] = useState<string>('original')
  const [renderedSrc, setRenderedSrc] = useState<string>(
    context?.user.pfpUrl || ''
  )

  if (!context?.user?.fid) {
    return (
      <div>
        Oops! Seems like you aren't using this website in a Farcaster frame!
        Well, <a href={castUrl}>go here</a> and use it in a frame.
      </div>
    )
  }

  useEffect(() => {
    async function applyFilter() {
      try {
        console.log('Applying filter...')
        if (!context?.user.pfpUrl) throw new Error('No PFP URL found')
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = context.user.pfpUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = (err) => reject(err)
        })
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Could not get 2D context')
        ctx.filter = colorFilters[color]
        console.log('Setting filter', ctx.filter)
        ctx.drawImage(img, 0, 0, img.width, img.height)
        const dataUrl = canvas.toDataURL('image/png')
        setRenderedSrc(dataUrl)
        console.log('Filter applied!')
      } catch (err) {
        console.error(err)
        toast.error(
          `Error applying color filter: ${err instanceof Error ? err.message : `${err}`}`
        )
      }
    }
    void applyFilter()
  }, [color, context.user.pfpUrl])

  const [loading, setLoading] = useState<boolean>(false)

  const downloadFilteredImage = async () => {
    const toastId = toast.loading('Uploading tinted image...')
    setLoading(true)
    try {
      const response = await fetch('https://images.colorino.site/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: renderedSrc }),
      })
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }
      const json = await response.json()
      const imageUrl = `https://images.colorino.site/${json.hash}.avif`
      return frameSdk.actions.openUrl(imageUrl)
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error(
        `Error uploading image{ ${error instanceof Error ? error.message : `${error}`}`
      )
    } finally {
      toast.dismiss(toastId)
      setLoading(false)
    }
  }

  if (!context.user.pfpUrl) {
    return (
      <div>
        Oops! Seems like you don't have a profile picture set in your Farcaster
        account. Well, go set it and try the frame again.
      </div>
    )
  }

  return (
    <div className="container prose mx-auto max-w-prose p-5">
      <h1>Colorino</h1>
      <h3>Color your Farcaster PFP!</h3>
      {/* Color filter buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(colorFilters).map((colorOption) => (
          <button
            key={colorOption}
            className={`btn btn-sm capitalize ${color === colorOption ? 'btn-primary' : ''}`}
            onClick={() => setColor(colorOption)}
          >
            {colorOption}
          </button>
        ))}
      </div>
      {/* Render the tinted image (now baked in, so "Save As" will save the filter) */}
      <img
        className="aspect-square w-full object-cover"
        src={renderedSrc}
        alt="Filtered PFP"
      />

      <div className="flex flex-col gap-2">
        <button
          className="btn"
          onClick={downloadFilteredImage}
          disabled={loading}
        >
          Download Tinted Image
        </button>
        <button className="btn" onClick={() => frameSdk.actions.close()}>
          Close Frame
        </button>
        <button
          className="btn"
          onClick={() =>
            frameSdk.actions.viewProfile({
              fid: 1356,
            })
          }
        >
          Follow @warpcastadmin.eth
        </button>
        <button
          className="btn"
          onClick={() => {
            const encodedText = encodeURIComponent(
              'I am colored now, wanna get colored too?'
            )
            const encodedUrl = encodeURIComponent('https://colorino.site')
            const warpcastUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedUrl}`
            return frameSdk.actions.openUrl(warpcastUrl)
          }}
        >
          Share the frame
        </button>
        <button
          className="btn"
          onClick={() =>
            window.open('https://github.com/backmeupplz/colorino', '_blank')
          }
        >
          Submit a PR!
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
        return frameSdk.actions.ready({})
      }
    }
    void getContext()
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
