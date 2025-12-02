import { useLayoutEffect, useState } from "react";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { clsx } from "keycloakify/tools/clsx";
import type { JSX } from "keycloakify/tools/JSX";
import { getKcClsx } from "keycloakify/login/lib/kcClsx";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { UserProfileFormFieldsProps } from "keycloakify/login/UserProfileFormFieldsProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { LazyOrNot } from "keycloakify/tools/LazyOrNot";
import { AUTH_CLASSNAMES } from "../classNames";
import {
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

const authClasses = AUTH_CLASSNAMES;

type RegisterProps = PageProps<Extract<KcContext, { pageId: "register.ftl" | "register-user-profile.ftl" }>, I18n> & {
  UserProfileFormFields: LazyOrNot<(props: UserProfileFormFieldsProps) => JSX.Element>;
  doMakeUserConfirmPassword: boolean;
};

export default function Register(props: RegisterProps) {
  const {
    kcContext,
    i18n,
    Template,
    doUseDefaultCss,
    classes,
    UserProfileFormFields,
    doMakeUserConfirmPassword
  } = props;

  const { url, social, messagesPerField } = kcContext;

  const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });
  const { msg, msgStr, advancedMsgStr } = i18n;

  const [isFormSubmittable, setIsFormSubmittable] = useState(false);
  const [areTermsAccepted, setAreTermsAccepted] = useState(false);

  useLayoutEffect(() => {
    (window as any)["onSubmitRecaptcha"] = () => {
      const form = document.getElementById("kc-register-form") as HTMLFormElement | null;
      form?.requestSubmit();
    };
    return () => {
      delete (window as any)["onSubmitRecaptcha"];
    };
  }, []);

  const alreadyHaveAccountText = advancedMsgStr("alreadyHaveAccount");
  const recaptchaRequired =
    "recaptchaRequired" in kcContext ? kcContext.recaptchaRequired === true : false;
  const recaptchaVisible =
    "recaptchaVisible" in kcContext ? kcContext.recaptchaVisible === true : false;
  const recaptchaSiteKey =
    "recaptchaSiteKey" in kcContext ? kcContext.recaptchaSiteKey : undefined;
  const recaptchaAction =
    "recaptchaAction" in kcContext ? kcContext.recaptchaAction : undefined;
  const termsAcceptanceRequired =
    "termsAcceptanceRequired" in kcContext ? kcContext.termsAcceptanceRequired === true : false;
  const registrationAction =
    "registrationAction" in url ? url.registrationAction : url.loginAction;

  interface SocialProvider {
    alias: string;
    displayName: string;
    loginUrl: string;
  }

  const socialProviders: SocialProvider[] = social?.providers ?? [];
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
      headerNode={msg("registerTitle")}
      displayMessage={messagesPerField.exists("global")}
      displayRequiredFields={false}
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
                        {SocialAliasToIconMapper[provider.alias as keyof typeof SocialAliasToIconMapper] ?? (
                          <DefaultSocialIcon />
                        )}
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
      <form id="kc-register-form" action={registrationAction} method="post">
        <UserProfileFormFields
          kcContext={kcContext}
          i18n={i18n}
          kcClsx={kcClsx}
          onIsFormSubmittableValueChange={setIsFormSubmittable}
          doMakeUserConfirmPassword={doMakeUserConfirmPassword}
        />

        {termsAcceptanceRequired && (
          <TermsAcceptance
            kcClsx={kcClsx}
            i18n={i18n}
            messagesPerField={messagesPerField}
            areTermsAccepted={areTermsAccepted}
            onAreTermsAcceptedValueChange={setAreTermsAccepted}
          />
        )}

        {recaptchaRequired && (recaptchaVisible || recaptchaAction === undefined) && (
          <div className={authClasses.recaptcha}>
            <div className="g-recaptcha" data-size="compact" data-sitekey={recaptchaSiteKey} data-action={recaptchaAction} />
          </div>
        )}

        <div className={authClasses.actions}>
          {recaptchaRequired && !recaptchaVisible && recaptchaAction !== undefined ? (
            <button
              className={clsx(authClasses.submitButton, "g-recaptcha")}
              data-sitekey={recaptchaSiteKey}
              data-callback="onSubmitRecaptcha"
              data-action={recaptchaAction}
              type="submit"
              disabled={!isFormSubmittable || (termsAcceptanceRequired && !areTermsAccepted)}
            >
              {msgStr("doRegister")}
            </button>
          ) : (
            <button
              className={authClasses.submitButton}
              type="submit"
              disabled={!isFormSubmittable || (termsAcceptanceRequired && !areTermsAccepted)}
            >
              {msgStr("doRegister")}
            </button>
          )}
          <div className={authClasses.backLink}>
            <a href={url.loginUrl}>
              {alreadyHaveAccountText !== "alreadyHaveAccount"
                ? alreadyHaveAccountText
                : msg("backToLogin")}
            </a>
          </div>
        </div>
      </form>
    </Template>
  );
}

type KcClsxFn = ReturnType<typeof getKcClsx>["kcClsx"];

function TermsAcceptance(props: {
  kcClsx: KcClsxFn;
  i18n: I18n;
  messagesPerField: KcContext["messagesPerField"];
  areTermsAccepted: boolean;
  onAreTermsAcceptedValueChange: (value: boolean) => void;
}) {
  const { kcClsx, i18n, messagesPerField, areTermsAccepted, onAreTermsAcceptedValueChange } = props;
  const { msg } = i18n;

  return (
    <div className={authClasses.terms}>
      <div>{msg("termsTitle")}</div>
      <div id="kc-registration-terms-text">{msg("termsText")}</div>
      <label htmlFor="termsAccepted">
        <input
          type="checkbox"
          id="termsAccepted"
          name="termsAccepted"
          className={kcClsx("kcCheckboxInputClass")}
          checked={areTermsAccepted}
          onChange={(event) => onAreTermsAcceptedValueChange(event.target.checked)}
          aria-invalid={messagesPerField.existsError("termsAccepted")}
        />
        {msg("acceptTerms")}
      </label>
      {messagesPerField.existsError("termsAccepted") && (
        <span
          className={authClasses.termsError}
          id="input-error-terms-accepted"
          aria-live="polite"
          dangerouslySetInnerHTML={{
            __html: kcSanitize(messagesPerField.get("termsAccepted"))
          }}
        />
      )}
    </div>
  );
}

function DefaultSocialIcon() {
  return (
    <span className="kc-social-icon-fallback" aria-hidden="true">
      *
    </span>
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
  bitbucket: undefined,
  gitlab: <Gitlab />,
  paypal: <Paypal />
} satisfies Record<string, JSX.Element | string | undefined>;

/*
  The KcContext type is expected to have the following shape for the "register.ftl" pageId:
  {
    pageId: "register.ftl";
    profile: UserProfile;
    social?: {
        displayInfo?: boolean;
        providers?: { alias: string; displayName: string; loginUrl: string; }[];
    };
  } & Common
*/
