import { useState } from "react";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useIsPasswordRevealed } from "keycloakify/tools/useIsPasswordRevealed";
import { clsx } from "keycloakify/tools/clsx";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { JSX } from "keycloakify/tools/JSX";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import {
  EyeFill,
  EyeSlashFill,
  Facebook,
  Github,
  Gitlab,
  Google,
  Instagram,
  Linkedin,
  Microsoft,
  Paypal,
  StackOverflow,
  TwitterX
} from "react-bootstrap-icons";
import { AUTH_CLASSNAMES } from "../classNames";

const authClasses = AUTH_CLASSNAMES;

type LoginProps = PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>;

export default function Login(props: LoginProps) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;

  const {
    social,
    realm,
    url,
    usernameHidden,
    login,
    auth,
    registrationDisabled,
    messagesPerField
  } = kcContext;

  const { msg, msgStr, advancedMsgStr } = i18n;
  const [isLoginButtonDisabled, setIsLoginButtonDisabled] = useState(false);

  const usernamePasswordHasError = messagesPerField.existsError("username", "password");
  const socialProviders = social?.providers ?? [];
  const hasSocialProviders = socialProviders.length > 0;
  const providersLoadFailed = social !== undefined && social.providers === undefined;
  const loadFailedMessage = advancedMsgStr("identity-provider-login-load-failed");
  const emptyProvidersMessage = advancedMsgStr("identity-provider-login-empty");
  const resolvedLoadFailedMessage =
    loadFailedMessage !== "identity-provider-login-load-failed"
      ? loadFailedMessage
      : "We couldn't load external identity providers. Please refresh the page or reach out to an administrator.";
  const resolvedEmptyProvidersMessage =
    emptyProvidersMessage !== "identity-provider-login-empty"
      ? emptyProvidersMessage
      : "No external identity providers are currently available for this realm.";

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={!usernamePasswordHasError}
      headerNode={msg("loginAccountTitle")}
      displayInfo={false}
      socialProvidersNode={
        social !== undefined && (
          <div id="kc-social-providers" className={authClasses.socialProviders}>
            {providersLoadFailed && (
              <div className={clsx(authClasses.socialProvidersStatus, authClasses.socialProvidersError)} role="alert">
                {resolvedLoadFailedMessage}
              </div>
            )}
            {!providersLoadFailed && !hasSocialProviders && (
              <div className={authClasses.socialProvidersStatus} role="status">
                {resolvedEmptyProvidersMessage}
              </div>
            )}
            {hasSocialProviders && (
              <ul
                className={clsx(authClasses.socialAccountList, {
                  [authClasses.grid]: socialProviders.length > 3
                })}
              >
                {socialProviders.map((provider) => (
                  <li key={provider.alias}>
                    <a id={`social-${provider.alias}`} type="button" href={provider.loginUrl}>
                      <span className={authClasses.socialIcon}>
                        {SocialAliasToIconMapper[provider.alias as keyof typeof SocialAliasToIconMapper]}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: kcSanitize(provider.displayName)
                        }}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
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
                <div className={authClasses.formGroup}>
                  <label className={authClasses.label} htmlFor="username">
                    {!realm.loginWithEmailAllowed
                      ? msg("username")
                      : !realm.registrationEmailAsUsername
                      ? msg("usernameOrEmail")
                      : msg("email")}
                  </label>
                  <input
                    id="username"
                    name="username"
                    defaultValue={login.username ?? ""}
                    type="text"
                    autoFocus
                    autoComplete="username"
                    aria-invalid={usernamePasswordHasError}
                    className={clsx(authClasses.input, usernamePasswordHasError && authClasses.inputInvalid)}
                  />
                  {usernamePasswordHasError && (
                    <div className={authClasses.feedback} role="alert">
                      <span
                        id="input-error"
                        aria-live="polite"
                        dangerouslySetInnerHTML={{
                          __html: kcSanitize(messagesPerField.getFirstError("username", "password"))
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className={authClasses.formGroup}>
                <label className={authClasses.label} htmlFor="password">
                  {msg("password")}
                </label>
                <PasswordWrapper i18n={i18n} passwordInputId="password">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={usernamePasswordHasError}
                    className={clsx(authClasses.input, usernamePasswordHasError && authClasses.inputInvalid)}
                  />
                </PasswordWrapper>
                {usernameHidden && usernamePasswordHasError && (
                  <div className={authClasses.feedback} role="alert">
                    <span
                      id="input-error"
                      aria-live="polite"
                      dangerouslySetInnerHTML={{
                        __html: kcSanitize(messagesPerField.getFirstError("username", "password"))
                      }}
                    />
                  </div>
                )}
              </div>

              {(realm.rememberMe && !usernameHidden) || realm.resetPasswordAllowed ? (
                <div className={authClasses.settings}>
                  {realm.rememberMe && !usernameHidden && (
                    <label className={authClasses.checkboxLabel} htmlFor="rememberMe">
                      <input
                        id="rememberMe"
                        name="rememberMe"
                        type="checkbox"
                        defaultChecked={login.rememberMe === "true"}
                      />
                      {msg("rememberMe")}
                    </label>
                  )}
                  {realm.resetPasswordAllowed && (
                    <div className={authClasses.forgotPassword}>
                      <a href={url.loginResetCredentialsUrl}>{msg("doForgotPassword")}</a>
                    </div>
                  )}
                </div>
              ) : null}

              <div id="kc-form-buttons">
                <input
                  type="hidden"
                  id="id-hidden-input"
                  name="credentialId"
                  value={auth?.selectedCredential ?? ""}
                />
                <button
                  className={authClasses.submitButton}
                  disabled={isLoginButtonDisabled}
                  name="login"
                  id="kc-login"
                  type="submit"
                >
                  {msgStr("doLogIn")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      {realm.registrationAllowed && !registrationDisabled && url.registrationUrl && (
        <div className={authClasses.backLink}>
          <a id="kc-registration-link" href={url.registrationUrl}>
            {msg("doRegister")}
          </a>
        </div>
      )}
    </Template>
  );
}

function PasswordWrapper(props: { i18n: I18n; passwordInputId: string; children: JSX.Element }) {
  const { i18n, passwordInputId, children } = props;

  const { msgStr } = i18n;
  const { isPasswordRevealed, toggleIsPasswordRevealed } = useIsPasswordRevealed({
    passwordInputId
  });

  return (
    <div className={authClasses.inputGroup}>
      {children}
      <button
        type="button"
        className={authClasses.passwordToggle}
        aria-label={msgStr(isPasswordRevealed ? "hidePassword" : "showPassword")}
        aria-controls={passwordInputId}
        onClick={toggleIsPasswordRevealed}
      >
        {isPasswordRevealed ? <EyeSlashFill /> : <EyeFill />}
      </button>
    </div>
  );
}

const SocialAliasToIconMapper = {
  microsoft: <Microsoft />,
  google: <Google />,
  facebook: <Facebook />,
  instagram: <Instagram />,
  twitter: <TwitterX />,
  linkedin: <Linkedin />,
  stackoverflow: <StackOverflow />,
  github: <Github />,
  bitbucket: "",
  gitlab: <Gitlab />,
  paypal: <Paypal />,
  openshift: ""
} as const;
