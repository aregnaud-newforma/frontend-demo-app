import { RouterProvider } from "react-router/dom";
import { router } from "./routes";

/**
 * The app is the router now. The <main> shell and the heading moved out: the
 * shell into the layout route (../layout/RootLayout), the heading into each page, so
 * the document outline says which route you are on.
 *
 * `RouterProvider` comes from `react-router/dom` rather than `react-router`:
 * same component, except that one wires in react-dom's `flushSync`, which is
 * what makes view transitions and scroll restoration land in the right frame.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
