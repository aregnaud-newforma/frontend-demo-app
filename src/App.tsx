import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes";

/**
 * The app is the router now. The <main> shell and the heading moved out: the
 * shell into the root route (../layout/RootLayout), the heading into each page, so
 * the document outline says which route you are on.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
