import "./global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./query-client";
import { initSentry } from "./sentry";
import { AppErrorBoundary } from "@layout/AppErrorBoundary";
import App from "./App";

// Before the first render, so an error thrown while mounting is still reported.
initSentry();

// One client for the life of the app. The tests build their own, per test.
const queryClient = createQueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
