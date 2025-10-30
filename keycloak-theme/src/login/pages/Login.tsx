import { useState } from "react";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useIsPasswordRevealed } from "keycloakify/tools/useIsPasswordRevealed";
import type { JSX } from "keycloakify/tools/JSX";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

type LoginPageContext = Extract<KcContext, { pageId: "login.ftl" }>;

type LoginProps = PageProps<LoginPageContext, I18n>;

export default function Login(props: LoginProps) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { msg, msgStr } = i18n;

  const {
    social,
    realm,
    url,
    usernameHidden = false,
    login,
    auth,
    registrationDisabled,
    messagesPerField
  } = kcContext;

  const [isLoginButtonDisabled, setIsLoginButtonDisabled] = useState(false);

  const hasFieldError = messagesPerField?.existsError("username", "password") ?? false;
  const firstFieldError = hasFieldError
    ? messagesPerField?.getFirstError("username", "password")
    : undefined;

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={!hasFieldError}
      headerNode={msg("loginAccountTitle")}
      displayInfo={realm.password && realm.registrationAllowed && !registrationDisabled}
      infoNode={
        realm.password &&
        realm.registrationAllowed &&
        !registrationDisabled && (
          <div id="kc-registration">
            <span>
              {msg("noAccount")}{" "}
              <a href={url.registrationUrl}>{msg("doRegister")}</a>
            </span>
          </div>
        )
      }
      socialProvidersNode={
        realm.password &&
        social?.providers !== undefined &&
        social.providers.length > 0 && (
          <div id="kc-social-providers">
            <hr />
            <h2>{msg("identity-provider-login-label")}</h2>
            <ul className="kc-social-links">
              {social.providers.map((provider) => (
                <li key={provider.alias}>
                  <a id={`social-${provider.alias}`} href={provider.loginUrl}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: kcSanitize(provider.displayName)
                      }}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    >
      <div id="kc-form">
        <div id="kc-form-wrapper">
          {realm.password && (
            <form
              id="kc-form-login"
              onSubmit={() => {
                setIsLoginButtonDisabled(true);
                return true;
              }}
              action={url.loginAction}
              method="post"
            >
              {!usernameHidden && (
                <div className="kc-form-group">
                  <label htmlFor="username" className={hasFieldError ? "error-label" : undefined}>
                    {!realm.loginWithEmailAllowed
                      ? msg("username")
                      : !realm.registrationEmailAsUsername
                      ? msg("usernameOrEmail")
                      : msg("email")}
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    defaultValue={login.username ?? ""}
                    autoFocus={!usernameHidden}
                    autoComplete="username"
                    aria-invalid={hasFieldError}
                    className={hasFieldError ? "error-field" : undefined}
                  />
                </div>
              )}
              <PasswordField
                i18n={i18n}
                hasError={hasFieldError}
                showError={usernameHidden && hasFieldError}
                errorMessage={firstFieldError}
              />

              <div className="kc-form-options">
                {realm.rememberMe && !usernameHidden && (
                  <label className="checkbox">
                    <input
                      id="rememberMe"
                      name="rememberMe"
                      type="checkbox"
                      defaultChecked={login.rememberMe !== undefined && login.rememberMe === "true"}
                    />
                    {msg("rememberMe")}
                  </label>
                )}
                {realm.resetPasswordAllowed && (
                  <a id="forgot-password" href={url.loginResetCredentialsUrl}>
                    {msg("doForgotPassword")}
                  </a>
                )}
              </div>

              <div id="kc-form-buttons">
                <input
                  type="hidden"
                  id="id-hidden-input"
                  name="credentialId"
                  value={auth?.selectedCredential ?? ""}
                />
                <button type="submit" id="kc-login" disabled={isLoginButtonDisabled}>
                  {msgStr("doLogIn")}
                </button>
              </div>

              {hasFieldError && firstFieldError && (
                <div className="kc-alert-error" role="alert">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: kcSanitize(firstFieldError)
                    }}
                  />
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </Template>
  );
}

function PasswordField(props: {
  i18n: I18n;
  hasError: boolean;
  showError: boolean;
  errorMessage?: string;
}) {
  const { i18n, hasError, showError, errorMessage } = props;
  const { msg, msgStr } = i18n;

  const passwordInputId = "password";
  const { isPasswordRevealed, toggleIsPasswordRevealed } = useIsPasswordRevealed({
    passwordInputId
  });

  return (
    <div className="kc-form-group">
      <label htmlFor={passwordInputId} className={hasError ? "error-label" : undefined}>
        {msg("password")}
      </label>
      <div className="kc-password-wrapper">
        <input
          id={passwordInputId}
          name="password"
          type={isPasswordRevealed ? "text" : "password"}
          autoComplete="current-password"
          aria-invalid={hasError}
          className={hasError ? "error-field" : undefined}
        />
        <button
          type="button"
          className="kc-password-toggle"
          onClick={toggleIsPasswordRevealed}
          aria-label={msgStr(isPasswordRevealed ? "hidePassword" : "showPassword")}
        >
          {isPasswordRevealed ? msg("hidePassword") : msg("showPassword")}
        </button>
      </div>
      {showError && errorMessage && (
        <div className="kc-field-error" role="alert">
          <span
            dangerouslySetInnerHTML={{
              __html: kcSanitize(errorMessage)
            }}
          />
        </div>
      )}
    </div>
  );
}
