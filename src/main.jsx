import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { WalletConnectProvider } from '@/lib/web3/WalletConnectProvider'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <WalletConnectProvider>
    <App />
  </WalletConnectProvider>
  // </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



