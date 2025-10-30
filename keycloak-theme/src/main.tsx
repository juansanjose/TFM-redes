import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { KcPage } from "./kc.gen";
import { getKcContextMock } from "./login/mocks/getKcContextMock";
import "./login/styles.css";

const rootElement = document.getElementById("root");

const previewFallback = null;

const previewKcContext = getKcContextMock({ pageId: "login.ftl" });

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Suspense fallback={previewFallback}>
        <KcPage kcContext={window.kcContext ?? previewKcContext} fallback={previewFallback} />
      </Suspense>
    </React.StrictMode>
  );
}
