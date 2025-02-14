import frameSdk, { Context } from '@farcaster/frame-sdk'
import { useEffect, useState } from 'preact/compat'
import { Toaster } from 'react-hot-toast'

const colorFilters: Record<string, string> = {
  none: '',
  red: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(0deg) ',
  green: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(100deg) ',
  blue: 'grayscale(1) sepia(1) saturate(5000%) hue-rotate(200deg) ',
}

function AppWithContext({ context }: { context: Context.FrameContext }) {
  // Track which color filter we have applied
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
