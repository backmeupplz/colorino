import { atomWithStorage } from 'jotai/utils'

const signerAtom = atomWithStorage<`0x${string}` | null>('signer', null)

export default signerAtom
