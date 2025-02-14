import frameSdk, { Context } from '@farcaster/frame-sdk'
import { useEffect, useState } from 'preact/compat'
import toast, { Toaster } from 'react-hot-toast'

const colorFilters: Record<string, string> = {
  original: 'none',
  red: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(0deg)',
  green: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(100deg)',
  blue: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(200deg)',
}

const castUrl = 'https://warpcast.com/warpcastadmin.eth'

function AppWithContext({ context }: { context?: Context.FrameContext }) {
  const [color, setColor] = useState<string>('original')
  const [renderedSrc, setRenderedSrc] = useState<string>(
    context?.user.pfpUrl || ''
  )

  const [filterAvailable, setFilterAvailable] = useState<boolean>(true)

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
        if (!('filter' in ctx)) {
          setFilterAvailable(false)
          return
        }
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
    if (filterAvailable) {
      applyFilter()
    }
  }, [color, context?.user.pfpUrl])

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
      <div className="flex gap-2 flex-wrap">
        {Object.keys(colorFilters).map((colorOption) => (
          <button
            key={colorOption}
            className={`btn-sm btn capitalize ${color === colorOption ? 'btn-primary' : ''}`}
            onClick={() => setColor(colorOption)}
          >
            {colorOption}
          </button>
        ))}
      </div>

      {/* Render the tinted image (now baked in, so "Save As" will save the filter) */}
      {filterAvailable ? (
        <img
          className="w-full aspect-square object-cover"
          src={renderedSrc}
          alt="Filtered PFP"
        />
      ) : (
        <img
          className="w-full aspect-square object-cover"
          src={context.user.pfpUrl}
          style={{ filter: colorFilters[color] }}
        />
      )}
      {filterAvailable ? (
        <p>Now long tap or right click and save the image!</p>
      ) : (
        <p>
          Your browser doesn't support real image filters, so the best you can
          do is to screenshot and crop, good luck!
        </p>
      )}
      <div className="flex flex-col gap-2">
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
            const encodedUrl = encodeURIComponent(castUrl)
            const warpcastUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedUrl}`
            return frameSdk.actions.openUrl(warpcastUrl)
          }}
        >
          Share the frame
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
