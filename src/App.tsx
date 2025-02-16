import { ByteArray, toBytes, toHex } from 'viem'
import { Rnd } from 'react-rnd'
import { ed25519 } from '@noble/curves/ed25519'
import { useAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'preact/compat'
import QRCode from 'react-qr-code'
import frameSdk, { Context } from '@farcaster/frame-sdk'
import signerAtom from 'signerAtom'
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

  // Sticker state; the numbers represent the position and size relative to the displayed image container.
  const [sticker, setSticker] = useState({
    visible: false,
    x: 20,
    y: 20,
    width: 100,
    height: 100,
  })

  // We use a ref on the container that holds the displayed image and the sticker overlay.
  const containerRef = useRef<HTMLDivElement>(null)

  // This effect re-renders the final image whenever the base image URL, color filter, or sticker state changes.
  useEffect(() => {
    async function renderFinalImage() {
      try {
        console.log('Applying filter...')
        if (!context?.user.pfpUrl) throw new Error('No PFP URL found')
        // Load the base image.
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = context.user.pfpUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = (err) => reject(err)
        })

        // Create a square canvas that matches the crop used by object-fit: cover.
        let sx = 0,
          sy = 0,
          sSize = 0
        if (img.naturalWidth >= img.naturalHeight) {
          // Landscape or square: crop horizontally.
          sSize = img.naturalHeight
          sx = (img.naturalWidth - sSize) / 2
          sy = 0
        } else {
          // Portrait: crop vertically.
          sSize = img.naturalWidth
          sx = 0
          sy = (img.naturalHeight - sSize) / 2
        }

        const canvas = document.createElement('canvas')
        canvas.width = sSize
        canvas.height = sSize
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Could not get 2D context')

        // Draw the cropped portion of the image onto the canvas.
        // This mimics object-fit: cover on a square container.
        ctx.filter = colorFilters[color]
        ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, sSize, sSize)

        // If a sticker has been added, draw it onto the canvas.
        if (sticker.visible && containerRef.current) {
          const stickerImg = new Image()
          stickerImg.crossOrigin = 'anonymous'
          stickerImg.src = 'sticker.png'
          await new Promise<void>((resolve, reject) => {
            stickerImg.onload = () => resolve()
            stickerImg.onerror = (err) => reject(err)
          })
          // Get the displayed container dimensions.
          const rect = containerRef.current.getBoundingClientRect()
          // Compute the scaling factor from displayed container to the canvas.
          const factor = sSize / rect.width
          const stickerX = sticker.x * factor
          const stickerY = sticker.y * factor
          const stickerWidth = sticker.width * factor
          const stickerHeight = sticker.height * factor
          ctx.drawImage(
            stickerImg,
            stickerX,
            stickerY,
            stickerWidth,
            stickerHeight
          )
        }

        // Set the final data URL.
        const dataUrl = canvas.toDataURL('image/png')
        setRenderedSrc(dataUrl)
      } catch (err) {
        console.error(err)
        toast.error(
          `Error rendering image: ${err instanceof Error ? err.message : `${err}`}`
        )
      }
    }
    void renderFinalImage()
  }, [color, context?.user.pfpUrl, sticker])

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
      const imageUrl = `https://images.colorino.site/${json.hash}.png`
      return frameSdk.actions.openUrl(imageUrl)
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error(
        `Error uploading image: ${error instanceof Error ? error.message : `${error}`}`
      )
    } finally {
      toast.dismiss(toastId)
      setLoading(false)
    }
  }

  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null)
  const [loadingSigner, setLoadingSigner] = useState<boolean>(false)
  const [signerAtomValue, setSignerAtomValue] = useAtom(signerAtom)

  const setPfp = useCallback(async () => {
    let toastId = toast.loading('Setting new profile picture...')
    setLoadingSigner(true)
    let signerPrivateKey: ByteArray | null = null
    try {
      if (!signerAtomValue) {
        // Step 1: Generate a new keypair.
        const privateKey = ed25519.utils.randomPrivateKey()
        const publicKeyBytes = ed25519.getPublicKey(privateKey)
        // Convert publicKeyBytes (Uint8Array) to a hex string without Buffer.
        const key = toHex(publicKeyBytes)
        const privateKeyString = toHex(privateKey)

        // Step 2: Obtain the signature from the signer server.
        const deadline = Math.floor(Date.now() / 1000) + 60 * 60
        toast.dismiss(toastId)
        toastId = toast.loading('Obtaining signature from signer server...')
        const sigRes = await fetch(
          `https://signer.colorino.site/signature?key=${key}&deadline=${deadline}`
        )
        if (!sigRes.ok) {
          throw new Error('Failed to obtain signature from signer server')
        }
        const { signature } = await sigRes.json()

        // Step 3: Create a signed key request via the Warpcast API.
        const warpcastApi = 'https://api.warpcast.com'
        // Use the fid from context.
        const fid = 990688
        toast.dismiss(toastId)
        toastId = toast.loading('Creating signed key request via Warpcast...')
        console.log(key, fid, signature, deadline)
        const warpcastRes = await fetch(
          `${warpcastApi}/v2/signed-key-requests`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key,
              requestFid: fid,
              signature,
              deadline,
              redirectUrl:
                'https://warpcast.com/?launchFrameDomain=colorino.site',
            }),
          }
        )
        if (!warpcastRes.ok) {
          throw new Error(`Warpcast API error: ${warpcastRes.statusText}`)
        }
        const warpcastJson = await warpcastRes.json()
        const { token, deeplinkUrl } = warpcastJson.result.signedKeyRequest
        console.log('deeplinkUrl:', deeplinkUrl)
        // Step 4: Display the deeplink URL as a QR code.
        // (Assumes you have a state setter, e.g., setDeepLinkUrl, and a QR component.)
        setSignerAtomValue(privateKeyString)
        setDeepLinkUrl(deeplinkUrl)
        toast.dismiss(toastId)
        toastId = toast.loading('Scan the QR code below')
        // Step 5: Poll for the signed key request status until it is completed.
        const poll = async (token: string) => {
          while (true) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            console.log('Polling signed key request...')
            const pollRes = await fetch(
              `${warpcastApi}/v2/signed-key-request?token=${encodeURIComponent(
                token
              )}`
            )
            if (!pollRes.ok) {
              throw new Error(`Polling error: ${pollRes.statusText}`)
            }
            const pollJson = await pollRes.json()
            const signedKeyRequest = pollJson.result.signedKeyRequest
            if (signedKeyRequest.state === 'completed') {
              return signedKeyRequest
            }
          }
        }
        await poll(token)
        setSignerAtomValue(privateKeyString)
        signerPrivateKey = privateKey
        setDeepLinkUrl(null)
      } else {
        signerPrivateKey = toBytes(signerAtomValue)
      }
      // Step 6: upload the pfp to the server
      toast.dismiss(toastId)
      toastId = toast.loading('Uploading new pfp...')
      const response = await fetch('https://images.colorino.site/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: renderedSrc }),
      })
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }
      const json = await response.json()
      const imageUrl = `https://images.colorino.site/${json.hash}.png`
      // Step 7: set the pfp
      toast.dismiss(toastId)
      toastId = toast.loading('Setting the new pfp...')
      if (!signerPrivateKey) {
        throw new Error('No signer key found')
      }
      const changePfpResponse = await fetch(
        'https://signer.colorino.site/change-pfp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privateKey: toHex(signerPrivateKey),
            pfp: imageUrl,
            fid: context.user.fid,
          }),
        }
      )
      if (!changePfpResponse.ok) {
        throw new Error(`Changing pfp failed: ${changePfpResponse.statusText}`)
      }
      // Step 8: done
      toast.dismiss(toastId)
      toast.success('Profile picture set successfully!')
    } catch (error) {
      setSignerAtomValue(null)
      console.error('Error setting profile picture:', error)
      toast.error(
        `Error setting profile picture: ${
          error instanceof Error ? error.message : error
        }`
      )
    } finally {
      toast.dismiss(toastId)
      setLoadingSigner(false)
    }
  }, [context.user.fid, renderedSrc, setSignerAtomValue, signerAtomValue])

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
        {!sticker.visible ? (
          <button
            className="btn btn-sm"
            onClick={() =>
              setSticker({
                visible: true,
                x: 20,
                y: 20,
                width: 100,
                height: 100,
              })
            }
          >
            PUNK
          </button>
        ) : (
          <button
            className="btn btn-sm"
            onClick={() => setSticker((prev) => ({ ...prev, visible: false }))}
          >
            DE-PUNK
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative inline-block overflow-hidden"
        style={{ marginTop: '1rem' }}
      >
        <img
          className="aspect-square w-full object-cover"
          src={renderedSrc}
          alt="Filtered PFP"
        />
        {sticker.visible && (
          <Rnd
            size={{ width: sticker.width, height: sticker.height }}
            position={{ x: sticker.x, y: sticker.y }}
            style={{ border: '2px dashed #000' }} // This adds a visible dashed border
            resizeHandleStyles={{
              top: { background: '#fff', border: '1px solid #000' },
              right: { background: '#fff', border: '1px solid #000' },
              bottom: { background: '#fff', border: '1px solid #000' },
              left: { background: '#fff', border: '1px solid #000' },
              topLeft: { background: '#fff', border: '1px solid #000' },
              topRight: { background: '#fff', border: '1px solid #000' },
              bottomLeft: { background: '#fff', border: '1px solid #000' },
              bottomRight: { background: '#fff', border: '1px solid #000' },
            }}
            onDragStop={(e: any, d: { x: any; y: any }) => {
              setSticker((prev) => ({ ...prev, x: d.x, y: d.y }))
            }}
            onResizeStop={(
              e: any,
              direction: any,
              ref: { offsetWidth: any; offsetHeight: any },
              delta: any,
              position: { x: any; y: any }
            ) => {
              setSticker({
                x: position.x,
                y: position.y,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
                visible: true,
              })
            }}
          >
            <img
              src="sticker.png"
              alt="sticker"
              style={{
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          </Rnd>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          className="btn btn-primary"
          onClick={setPfp}
          disabled={loadingSigner}
        >
          Set as my PFP automatically
        </button>
        {deepLinkUrl && loadingSigner && (
          <div className="flex w-full flex-col items-center justify-center">
            <p>
              Please, scan this QR code with a mobile device with Warpcast
              installed:
            </p>
            <QRCode value={deepLinkUrl} />
            <p>
              Or{' '}
              <a
                onClick={() => frameSdk.actions.openUrl(deepLinkUrl)}
                className="cursor-pointer"
              >
                open this URL
              </a>{' '}
              if you're on mobile (<b>and reopen the frame after you're done</b>
              ).
            </p>
          </div>
        )}
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
