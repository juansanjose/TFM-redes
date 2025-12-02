import { useEffect } from "react";
import { clsx } from "keycloakify/tools/clsx";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import { getKcClsx } from "keycloakify/login/lib/kcClsx";
import { useSetClassName } from "keycloakify/tools/useSetClassName";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { KcContext } from "./KcContext";
import type { I18n } from "./i18n";

export default function Template(props: TemplateProps<KcContext, I18n>) {
  const {
    kcContext,
    i18n,
    doUseDefaultCss,
    classes,
    documentTitle,
    bodyClassName,
    headerNode,
    displayInfo = false,
    infoNode = null,
    displayMessage = true,
    displayRequiredFields = false,
    socialProvidersNode = null,
    children
  } = props;

  const { realm, auth, url, message, isAppInitiatedAction } = kcContext;
  const { msg, msgStr, currentLanguage, enabledLanguages } = i18n;

  const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });

  useEffect(() => {
    document.title = documentTitle ?? msgStr("loginTitle", realm.displayName);
  }, [documentTitle, msgStr, realm.displayName]);

  useSetClassName({
    qualifiedName: "html",
    className: kcClsx("kcHtmlClass")
  });

  useSetClassName({
    qualifiedName: "body",
    className: clsx("tfm-minimal-body", bodyClassName ?? kcClsx("kcBodyClass"))
  });

  const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });

  if (!isReadyToRender) {
    return null;
  }

  const renderHeader = () => {
    if (auth !== undefined && auth.showUsername && !auth.showResetCredentials) {
      return (
        <div id="kc-username" className={kcClsx("kcFormGroupClass")}>
          <label id="kc-attempted-username">{auth.attemptedUsername}</label>
          <a id="reset-login" href={url.loginRestartFlowUrl} aria-label={msgStr("restartLoginTooltip")}>
            <div className="kc-login-tooltip">
              <i className={kcClsx("kcResetFlowIcon")} />
              <span className="kc-tooltip-text">{msg("restartLoginTooltip")}</span>
            </div>
          </a>
        </div>
      );
    }

    const node = <h1 id="kc-page-title">{headerNode}</h1>;

    if (!displayRequiredFields) {
      return node;
    }

    return (
      <div className={kcClsx("kcContentWrapperClass")}>
        <div className={clsx(kcClsx("kcLabelWrapperClass"), "subtitle")}>
          <span className="subtitle">
            <span className="required">*</span>
            {msg("requiredFields")}
          </span>
        </div>
        <div className="col-md-10">{node}</div>
      </div>
    );
  };

  return (
    <div className="tfm-minimal-shell">
      <main className="tfm-minimal-card">
        <header className={clsx("tfm-minimal-header", kcClsx("kcFormHeaderClass"))}>{renderHeader()}</header>
        <div id="kc-content" className={kcClsx("kcContentClass")}>
          <div id="kc-content-wrapper" className={kcClsx("kcContentWrapperClass")}>
            {displayMessage &&
              message !== undefined &&
              (message.type !== "warning" || !isAppInitiatedAction) && (
                <div
                  className={clsx(
                    "tfm-minimal-alert",
                    `alert-${message.type}`,
                    kcClsx("kcAlertClass"),
                    `pf-m-${message?.type === "error" ? "danger" : message.type}`
                  )}
                >
                  <span
                    className={kcClsx("kcAlertTitleClass")}
                    dangerouslySetInnerHTML={{
                      __html: kcSanitize(message.summary)
                    }}
                  />
                </div>
              )}

            {children}

            {auth !== undefined && auth.showTryAnotherWayLink && (
              <form id="kc-select-try-another-way-form" action={url.loginAction} method="post">
                <div className={kcClsx("kcFormGroupClass")}>
                  <input type="hidden" name="tryAnotherWay" value="on" />
                  <button
                    type="button"
                    className="tfm-minimal-link"
                    onClick={() => {
                      document.forms["kc-select-try-another-way-form" as never].requestSubmit();
                    }}
                  >
                    {msg("doTryAnotherWay")}
                  </button>
                </div>
              </form>
            )}

            {socialProvidersNode && <div className="tfm-minimal-social">{socialProvidersNode}</div>}

            {displayInfo && infoNode}
          </div>
        </div>
      </main>
      {enabledLanguages.length > 1 && (
        <div className="tfm-minimal-locale">
          <div className={kcClsx("kcLocaleWrapperClass")}>
            <button
              id="kc-current-locale-link"
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls="language-switch1"
            >
              {currentLanguage.label}
            </button>
            <ul
              role="menu"
              id="language-switch1"
              className={kcClsx("kcLocaleListClass")}
              aria-labelledby="kc-current-locale-link"
            >
              {enabledLanguages.map(({ languageTag, label, href }, i) => (
                <li key={languageTag} className={kcClsx("kcLocaleListItemClass")} role="none">
                  <a role="menuitem" id={`language-${i + 1}`} className={kcClsx("kcLocaleItemClass")} href={href}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
