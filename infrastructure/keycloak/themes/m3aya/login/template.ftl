<#-- Based on Keycloak 25.0.6 base template.ftl (Apache-2.0). Native login.ftl and security scripts are inherited. -->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign isArabic = (locale.currentLanguageTag!'fr')?starts_with('ar')>
<!DOCTYPE html>
<html dir="${isArabic?string('rtl','ltr')}" class="${properties.kcHtmlClass!}"<#if realm.internationalizationEnabled> lang="${locale.currentLanguageTag}"</#if>>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0B203B" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.svg" />
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/node_modules/rfc4648/lib/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        import { checkCookiesAndSetTimer } from "${url.resourcesPath}/js/authChecker.js";

        checkCookiesAndSetTimer(
          "${url.ssoLoginInOtherTabsUrl?no_esc}"
        );
    </script>
</head>

<body class="${properties.kcBodyClass!}">
<a class="skip-link" href="#kc-content">${msg("m3ayaSkip")}</a>
<header class="brand-topbar">
 <a href="${properties.m3ayaWebUrl}" class="home-brand" aria-label="M3aya Santé | معايا"><img src="${url.resourcesPath}/img/logo-light.svg" alt="M3aya Santé | معايا" width="68" height="66" /></a>
 <nav aria-label="${msg('languages')}" class="language-nav">
 <#if realm.internationalizationEnabled && locale.supported?size gt 1>
 <#list locale.supported as l><#assign arabicLink = l.url?contains('kc_locale=ar')>
 <a href="${l.url}" lang="${arabicLink?string('ar','fr')}" <#if arabicLink == isArabic>aria-current="true"</#if>>${arabicLink?string('العربية','Français')}</a>
 </#list>
 </#if>
 </nav>
 <a class="back-link" href="${properties.m3ayaWebUrl}"><span aria-hidden="true">↗</span> ${msg("m3ayaHome")}</a>
</header>
<div class="auth-layout">
<aside class="brand-story" aria-labelledby="brand-story-title">
 <span class="story-eyebrow"><span aria-hidden="true"></span> ${msg("m3ayaEyebrow")}</span>
 <h2 id="brand-story-title">${msg("m3ayaStoryTitle")}<br /><em>${msg("m3ayaStoryAccent")}</em></h2>
 <p class="story-intro">${msg("m3ayaStoryText")}</p>
 <div class="journey-preview" aria-label="${msg('m3ayaJourneyLabel')}">
  <div class="preview-header"><span>${msg("m3ayaJourneyLabel")}</span><span class="preview-badge">${msg("m3ayaTogether")}</span></div>
  <ol><li><span aria-hidden="true">✓</span><div><strong>${msg("m3ayaStep1")}</strong><small>${msg("m3ayaStep1Text")}</small></div></li><li><span aria-hidden="true">✓</span><div><strong>${msg("m3ayaStep2")}</strong><small>${msg("m3ayaStep2Text")}</small></div></li><li><span aria-hidden="true">3</span><div><strong>${msg("m3ayaStep3")}</strong><small>${msg("m3ayaStep3Text")}</small></div></li></ol>
  <p class="preview-caption">${msg("m3ayaIllustration")}</p>
 </div>
 <div class="story-footer"><span aria-hidden="true">✧</span><p>${msg("m3ayaSignature")}<br /><span lang="ar">معايا، خطوة بخطوة.</span></p></div>
</aside>
<main class="auth-main">
<div class="${properties.kcLoginClass!}">
    <div id="kc-header" class="${properties.kcHeaderClass!}">
        <div id="kc-header-wrapper"
             class="${properties.kcHeaderWrapperClass!}">${msg("m3ayaAccess")}</div>
    </div>
    <div class="${properties.kcFormCardClass!}">
        <header class="${properties.kcFormHeaderClass!}">
        <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="subtitle"><span class="required">*</span> ${msg("requiredFields")}</span>
                    </div>
                    <div class="col-md-10">
                        <h1 id="kc-page-title"><#nested "header"></h1>
                    </div>
                </div>
            <#else>
                <h1 id="kc-page-title"><#nested "header"></h1>
            </#if>
        <#else>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="subtitle"><span class="required">*</span> ${msg("requiredFields")}</span>
                    </div>
                    <div class="col-md-10">
                        <#nested "show-username">
                        <div id="kc-username" class="${properties.kcFormGroupClass!}">
                            <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                            <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                                <div class="kc-login-tooltip">
                                    <i class="${properties.kcResetFlowIcon!}"></i>
                                    <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            <#else>
                <#nested "show-username">
                <div id="kc-username" class="${properties.kcFormGroupClass!}">
                    <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                    <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                        <div class="kc-login-tooltip">
                            <i class="${properties.kcResetFlowIcon!}"></i>
                            <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                        </div>
                    </a>
                </div>
            </#if>
        </#if>
        <p class="form-intro">${msg("m3ayaFormIntro")}</p>
      </header>
      <div id="kc-content" tabindex="-1">
        <div id="kc-content-wrapper">

          <#-- App-initiated actions should not see warning messages about the need to complete the action -->
          <#-- during login.                                                                               -->
          <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
              <div role="alert" class="alert-${message.type} ${properties.kcAlertClass!} pf-m-<#if message.type = 'error'>danger<#else>${message.type}</#if>">
                  <div class="pf-c-alert__icon">
                      <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                      <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                      <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                      <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                  </div>
                      <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
              </div>
          </#if>

          <#nested "form">

          <#if auth?has_content && auth.showTryAnotherWayLink()>
              <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                  <div class="${properties.kcFormGroupClass!}">
                      <input type="hidden" name="tryAnotherWay" value="on"/>
                      <a href="#" id="try-another-way"
                         onclick="document.forms['kc-select-try-another-way-form'].submit();return false;">${msg("doTryAnotherWay")}</a>
                  </div>
              </form>
          </#if>

          <#nested "socialProviders">

          <#if displayInfo>
              <div id="kc-info" class="${properties.kcSignUpClass!}">
                  <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                      <#nested "info">
                  </div>
              </div>
          </#if>
        </div>
      </div>

    </div>
    <div class="access-help"><p>${msg("m3ayaHelp")} <a href="mailto:yassine.aqejjaj@gmail.com">${msg("m3ayaContact")}</a></p><p class="demo-notice">${msg("m3ayaDemo")}</p></div>
  </div>
</main>
</div>
<footer class="auth-footer"><span>© M3aya Santé | معايا</span><span>${msg("m3ayaFooter")}</span></footer>
</body>
</html>
</#macro>
