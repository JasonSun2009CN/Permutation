/// <reference types="vite/client" />

import type { PermutationApi } from '@permutation/shared'

declare global {
  interface Window {
    permutation: PermutationApi
  }
}

export {}
