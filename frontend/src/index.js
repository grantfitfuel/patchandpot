import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "@/sentry";  // must run before React renders — silent no-op without DSN
import "@/index.css";
import App from "@/App";
import { I18nProvider } from "@/i18n";
import { Sentry } from "@/sentry";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={null}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <App />
          </I18nProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);

// Register PWA service worker (production only; CRA dev server breaks SW)
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
