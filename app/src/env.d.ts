/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the ViolaHub API. Unset => offline mode (simulated AI). */
  readonly VITE_API_BASE?: string;
  /** Dev bearer token for the API (prod uses a real IdP login). */
  readonly VITE_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
