/**
 * RAEN Auth Modal — v3
 * Requires api.js to be loaded first on the page.
 *
 * Features:
 *  - Sign In (email + password, eye toggle, Google Sign-In)
 *  - Create Account (confirm password + ✓/✗ match indicator, OTP phone verification, Google Sign-In)
 *  - Forgot Password (email → phone OTP → magic link sent to email)
 *  - window.__postLoginCallback hook used by checkout.html for no-reload post-login
 */
(function () {
  'use strict';

  // ─── Load Google Identity Services ──────────────────────────────────────
  (function loadGSI() {
    if (document.getElementById('raen-gsi-script')) return;
    const s = document.createElement('script');
    s.id = 'raen-gsi-script'; s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  })();

  // ─── Design tokens ────────────────────────────────────────────────────────
  const F  = "'Work Sans',Helvetica,Arial,sans-serif";
  const FH = "'Newsreader',Georgia,serif";

  const INPUT_BASE = `width:100%;padding:13px 0;border:none;border-bottom:1px solid #d4d4d4;
    font-family:${F};font-size:14px;color:#1a1a1a;background:transparent;
    outline:none;box-sizing:border-box;transition:border-color 0.25s;`;

  const LABEL_BASE = `font-family:${F};font-size:10px;letter-spacing:0.18em;
    text-transform:uppercase;color:#666;display:block;margin-bottom:8px;`;

  const BTN_PRIMARY = `width:100%;padding:16px;background:#1a1a1a;color:#fff;border:none;
    cursor:pointer;font-family:${F};font-size:11px;letter-spacing:0.24em;
    text-transform:uppercase;transition:opacity 0.2s;`;

  const KICKER = `font-family:${F};font-size:10px;letter-spacing:0.32em;
    text-transform:uppercase;color:#aaa;margin:0 0 8px;`;

  const HEADING = `font-family:${FH};font-size:32px;font-weight:300;margin:0 0 32px;
    color:#1a1a1a;letter-spacing:0.01em;line-height:1.1;`;

  const GOOGLE_BTN_STYLE = `width:100%;padding:13px 16px;background:#fff;
    border:1px solid #dadce0;cursor:pointer;font-family:${F};font-size:13px;
    letter-spacing:0.01em;color:#3c4043;display:flex;align-items:center;
    justify-content:center;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);
    transition:box-shadow 0.2s,background 0.2s;margin-bottom:22px;`;

  const GOOGLE_G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    width="18" height="18" style="flex-shrink:0;" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>`;

  const OR_DIV = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
    <div style="flex:1;height:1px;background:#ebebeb;"></div>
    <span style="font-family:${F};font-size:10px;letter-spacing:0.14em;color:#ccc;text-transform:uppercase;">or</span>
    <div style="flex:1;height:1px;background:#ebebeb;"></div>
  </div>`;

  // Eye icons (feather-style)
  const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;

  const EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`;

  // Eye toggle button style (absolute, inside position:relative wrapper)
  const EYE_BTN = `type="button" style="position:absolute;right:0;bottom:13px;background:none;border:none;
    cursor:pointer;color:#aaa;padding:0;display:flex;align-items:center;
    transition:color 0.2s;" aria-label="Toggle password visibility"
    onmouseover="this.style.color='#1a1a1a'" onmouseout="this.style.color='#aaa'"`;

  // ─── Modal HTML ───────────────────────────────────────────────────────────
  const MODAL_HTML = `
<div id="raen-auth-modal" role="dialog" aria-modal="true" aria-label="RAEN Account"
     style="display:none;position:fixed;inset:0;background:rgba(8,8,8,0.74);z-index:9999;
            align-items:flex-start;justify-content:center;backdrop-filter:blur(6px);
            padding:48px 20px;overflow-y:auto;box-sizing:border-box;">

  <div style="background:#fff;width:100%;max-width:448px;position:relative;
              box-shadow:0 32px 80px rgba(0,0,0,0.20);margin:auto;flex-shrink:0;">

    <!-- Close -->
    <button id="raen-modal-close" onclick="closeAuthModal()" aria-label="Close"
            style="position:absolute;top:20px;right:22px;background:none;border:none;
                   font-size:24px;cursor:pointer;color:#aaa;line-height:1;z-index:2;
                   transition:color 0.2s;"
            onmouseover="this.style.color='#1a1a1a'" onmouseout="this.style.color='#aaa'">&#215;</button>

    <!-- ══════════ VIEW 1: Sign In ══════════ -->
    <div id="raen-view-login" style="padding:56px 48px 48px;">
      <p style="${KICKER}">Welcome back</p>
      <h2 style="${HEADING}">Sign In</h2>

      <button onclick="raenGoogleSignIn()" style="${GOOGLE_BTN_STYLE}"
              onmouseover="this.style.boxShadow='0 3px 10px rgba(0,0,0,0.14)';this.style.background='#fafafa';"
              onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';this.style.background='#fff';">
        ${GOOGLE_G}<span>Continue with Google</span>
      </button>

      ${OR_DIV}

      <form id="raen-login-form" novalidate>
        <div style="margin-bottom:22px;">
          <label style="${LABEL_BASE}">Email address</label>
          <input type="email" id="raen-login-email" required autocomplete="email"
                 style="${INPUT_BASE}"
                 onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
        </div>

        <div style="margin-bottom:6px;">
          <label style="${LABEL_BASE}">Password</label>
          <div style="position:relative;">
            <input type="password" id="raen-login-password" required autocomplete="current-password"
                   style="${INPUT_BASE}"
                   onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
            <button ${EYE_BTN} onclick="raenTogglePwd('raen-login-password',this)">${EYE_OPEN}</button>
          </div>
        </div>

        <div style="text-align:right;margin-bottom:4px;">
          <a href="#" onclick="raenSwitchToForgot();return false;"
             style="font-family:${F};font-size:11px;color:#888;text-decoration:none;
                    border-bottom:1px solid #ddd;letter-spacing:0.04em;transition:color 0.2s;"
             onmouseover="this.style.color='#1a1a1a'" onmouseout="this.style.color='#888'">
            Forgot password?
          </a>
        </div>

        <p id="raen-login-error"
           style="font-family:${F};font-size:12px;color:#ba1a1a;margin:10px 0 0;display:none;"></p>

        <button type="submit" style="${BTN_PRIMARY}margin-top:24px;"
                onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
          Sign In
        </button>
      </form>

      <p style="font-family:${F};font-size:12px;color:#999;text-align:center;margin-top:24px;">
        New to RAEN?&nbsp;
        <a href="#" onclick="raenSwitchToRegister();return false;"
           style="color:#1a1a1a;border-bottom:1px solid #1a1a1a;text-decoration:none;letter-spacing:0.04em;">
          Create an account
        </a>
      </p>
    </div>

    <!-- ══════════ VIEW 2: Create Account ══════════ -->
    <div id="raen-view-register" style="display:none;padding:56px 48px 48px;">
      <p style="${KICKER}">Join the circle</p>
      <h2 style="${HEADING}">Create Account</h2>

      <button onclick="raenGoogleSignIn()" style="${GOOGLE_BTN_STYLE}"
              onmouseover="this.style.boxShadow='0 3px 10px rgba(0,0,0,0.14)';this.style.background='#fafafa';"
              onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';this.style.background='#fff';">
        ${GOOGLE_G}<span>Continue with Google</span>
      </button>

      ${OR_DIV}

      <form id="raen-register-form" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
          <div>
            <label style="${LABEL_BASE}">First name</label>
            <input type="text" id="raen-reg-first" required autocomplete="given-name"
                   style="${INPUT_BASE}"
                   onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
          </div>
          <div>
            <label style="${LABEL_BASE}">Last name</label>
            <input type="text" id="raen-reg-last" required autocomplete="family-name"
                   style="${INPUT_BASE}"
                   onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
          </div>
        </div>

        <div style="margin-bottom:22px;">
          <label style="${LABEL_BASE}">Email address</label>
          <input type="email" id="raen-reg-email" required autocomplete="email"
                 style="${INPUT_BASE}"
                 onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
        </div>

        <div style="margin-bottom:22px;">
          <label style="${LABEL_BASE}">Phone number</label>
          <input type="tel" id="raen-reg-phone" required autocomplete="tel"
                 placeholder="+44 7700 000000"
                 style="${INPUT_BASE}"
                 onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
          <span style="font-family:${F};font-size:10px;color:#bbb;margin-top:5px;
                       display:block;letter-spacing:0.06em;">Used to verify your account</span>
        </div>

        <div style="margin-bottom:22px;">
          <label style="${LABEL_BASE}">Password</label>
          <div style="position:relative;">
            <input type="password" id="raen-reg-password" required minlength="8"
                   autocomplete="new-password"
                   style="${INPUT_BASE}"
                   onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"
                   oninput="raenCheckPasswordMatch()"/>
            <button ${EYE_BTN} onclick="raenTogglePwd('raen-reg-password',this)">${EYE_OPEN}</button>
          </div>
          <span style="font-family:${F};font-size:10px;color:#bbb;margin-top:5px;
                       display:block;letter-spacing:0.06em;">Minimum 8 characters</span>
        </div>

        <div style="margin-bottom:28px;">
          <label style="${LABEL_BASE}">Confirm password</label>
          <div style="position:relative;">
            <input type="password" id="raen-reg-confirm" required
                   autocomplete="new-password"
                   style="${INPUT_BASE}"
                   onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"
                   oninput="raenCheckPasswordMatch()"/>
            <button ${EYE_BTN} onclick="raenTogglePwd('raen-reg-confirm',this)">${EYE_OPEN}</button>
          </div>
          <div id="raen-pwd-match" style="display:none;margin-top:7px;"></div>
        </div>

        <!-- OTP channel -->
        <div style="margin-bottom:28px;">
          <label style="${LABEL_BASE}margin-bottom:12px;">Send verification via</label>
          <div style="display:flex;border:1px solid #e0e0e0;">
            <label id="raen-ch-sms-label"
                   style="flex:1;text-align:center;padding:11px 4px;cursor:pointer;
                          font-family:${F};font-size:10px;letter-spacing:0.18em;
                          text-transform:uppercase;background:#1a1a1a;color:#fff;transition:all 0.2s;">
              <input type="radio" name="raen-otp-channel" value="sms" id="raen-ch-sms"
                     checked style="display:none;" onchange="raenUpdateChannelUI()"/>SMS
            </label>
            <label id="raen-ch-wa-label"
                   style="flex:1;text-align:center;padding:8px 4px;cursor:not-allowed;
                          font-family:${F};font-size:10px;letter-spacing:0.18em;
                          text-transform:uppercase;background:#fff;color:#c0c0c0;
                          transition:all 0.2s;border-left:1px solid #e0e0e0;"
                   onclick="raenWaComingSoon();return false;">
              WhatsApp
              <span style="display:block;font-size:7px;letter-spacing:0.12em;
                           color:#b8960c;margin-top:2px;">COMING SOON</span>
            </label>
          </div>
          <p id="raen-wa-soon-note"
             style="font-family:${F};font-size:11px;color:#b8960c;margin:8px 0 0;
                    display:none;text-align:center;letter-spacing:0.06em;">
            WhatsApp verification will be available soon.
          </p>
        </div>

        <p id="raen-register-error"
           style="font-family:${F};font-size:12px;color:#ba1a1a;margin:0 0 14px;display:none;"></p>

        <button type="submit" style="${BTN_PRIMARY}"
                onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
          Send Verification Code
        </button>
      </form>

      <p style="font-family:${F};font-size:12px;color:#999;text-align:center;margin-top:24px;">
        Already a member?&nbsp;
        <a href="#" onclick="raenSwitchToLogin();return false;"
           style="color:#1a1a1a;border-bottom:1px solid #1a1a1a;text-decoration:none;letter-spacing:0.04em;">
          Sign in
        </a>
      </p>
    </div>

    <!-- ══════════ VIEW 3: OTP — Registration verify ══════════ -->
    <div id="raen-view-otp" style="display:none;padding:56px 48px 48px;">
      <button onclick="raenSwitchToRegister()"
              style="background:none;border:none;cursor:pointer;padding:0;margin-bottom:28px;
                     font-family:${F};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;
                     color:#aaa;display:flex;align-items:center;gap:6px;transition:color 0.2s;"
              onmouseover="this.style.color='#1a1a1a'" onmouseout="this.style.color='#aaa'">
        &#8592;&nbsp;Back
      </button>
      <p style="${KICKER}">Verification</p>
      <h2 style="${HEADING}">Enter Code</h2>
      <p id="raen-otp-subtitle" style="font-family:${F};font-size:13px;color:#888;margin:0 0 32px;line-height:1.7;"></p>
      <div id="raen-otp-boxes" style="display:flex;gap:8px;margin-bottom:24px;"></div>
      <input type="hidden" id="raen-otp-value"/>
      <p id="raen-otp-error" style="font-family:${F};font-size:12px;color:#ba1a1a;margin:0 0 14px;display:none;"></p>
      <button id="raen-otp-verify-btn" onclick="raenSubmitOtp()"
              style="${BTN_PRIMARY}margin-bottom:18px;"
              onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
        Verify &amp; Create Account
      </button>
      <div style="text-align:center;">
        <button id="raen-resend-btn" onclick="raenResendOtp()"
                style="background:none;border:none;cursor:pointer;font-family:${F};
                       font-size:12px;color:#999;text-decoration:underline;padding:0;">Resend code</button>
        <span id="raen-resend-timer" style="font-family:${F};font-size:12px;color:#ccc;display:none;">
          Resend in <span id="raen-resend-secs">60</span>s
        </span>
      </div>
    </div>

    <!-- ══════════ VIEW 4: Forgot Password — Email entry ══════════ -->
    <div id="raen-view-forgot-email" style="display:none;padding:56px 48px 48px;">
      <button onclick="raenSwitchToLogin()"
              style="background:none;border:none;cursor:pointer;padding:0;margin-bottom:28px;
                     font-family:${F};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;
                     color:#aaa;display:flex;align-items:center;gap:6px;transition:color 0.2s;"
              onmouseover="this.style.color='#1a1a1a'" onmouseout="this.style.color='#aaa'">
        &#8592;&nbsp;Back to Sign In
      </button>
      <p style="${KICKER}">Account recovery</p>
      <h2 style="${HEADING}">Forgot Password</h2>
      <p style="font-family:${F};font-size:13px;color:#888;margin:0 0 28px;line-height:1.7;">
        Enter your email address. We will send a verification code to your registered phone number.
      </p>
      <div style="margin-bottom:28px;">
        <label style="${LABEL_BASE}">Email address</label>
        <input type="email" id="raen-forgot-email" required autocomplete="email"
               style="${INPUT_BASE}"
               onfocus="this.style.borderColor='#1a1a1a'" onblur="this.style.borderColor='#d4d4d4'"/>
      </div>
      <p id="raen-forgot-email-error"
         style="font-family:${F};font-size:12px;color:#ba1a1a;margin:0 0 14px;display:none;"></p>
      <button id="raen-forgot-send-btn" onclick="raenForgotPasswordSend()"
              style="${BTN_PRIMARY}"
              onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
        Send Recovery Code
      </button>
    </div>

    <!-- ══════════ VIEW 5: Forgot Password — OTP verify ══════════ -->
    <div id="raen-view-forgot-otp" style="display:none;padding:56px 48px 48px;">
      <button onclick="raenShowView('forgot-email')"
              style="background:none;border:none;cursor:pointer;padding:0;margin-bottom:28px;
                     font-family:${F};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;
                     color:#aaa;display:flex;align-items:center;gap:6px;transition:color 0.2s;"
              onmouseover="this.style.color='#1a1a1a'" onmouseout="this.style.color='#aaa'"
              id="raen-forgot-back-btn">
        &#8592;&nbsp;Back
      </button>

      <!-- OTP form (hidden after success) -->
      <div id="raen-forgot-otp-form">
        <p style="${KICKER}">Account recovery</p>
        <h2 style="${HEADING}">Enter Code</h2>
        <p id="raen-forgot-otp-subtitle" style="font-family:${F};font-size:13px;color:#888;margin:0 0 32px;line-height:1.7;"></p>
        <div id="raen-forgot-otp-boxes" style="display:flex;gap:8px;margin-bottom:24px;"></div>
        <input type="hidden" id="raen-forgot-otp-value"/>
        <p id="raen-forgot-otp-error" style="font-family:${F};font-size:12px;color:#ba1a1a;margin:0 0 14px;display:none;"></p>
        <button id="raen-forgot-verify-btn" onclick="raenForgotPasswordVerify()"
                style="${BTN_PRIMARY}margin-bottom:18px;"
                onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
          Verify &amp; Send Reset Link
        </button>
        <div style="text-align:center;">
          <button id="raen-forgot-resend-btn" onclick="raenForgotResend()"
                  style="background:none;border:none;cursor:pointer;font-family:${F};
                         font-size:12px;color:#999;text-decoration:underline;padding:0;">Resend code</button>
          <span id="raen-forgot-resend-timer" style="font-family:${F};font-size:12px;color:#ccc;display:none;">
            Resend in <span id="raen-forgot-resend-secs">60</span>s
          </span>
        </div>
      </div>

      <!-- Success state (shown after OTP verified) -->
      <div id="raen-forgot-success" style="display:none;text-align:center;padding:20px 0 8px;">
        <div style="width:52px;height:52px;border-radius:50%;background:#f0faf0;border:1px solid #c3e6c3;
                    display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2e7d32"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3 style="font-family:${FH};font-size:22px;font-weight:300;color:#1a1a1a;margin:0 0 12px;">Check Your Email</h3>
        <p id="raen-forgot-success-msg" style="font-family:${F};font-size:13px;color:#777;line-height:1.7;margin:0 0 28px;"></p>
        <button onclick="raenSwitchToLogin()"
                style="${BTN_PRIMARY}max-width:240px;margin:0 auto;"
                onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
          Return to Sign In
        </button>
      </div>
    </div>

  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

  // ─── OTP box builder ──────────────────────────────────────────────────────
  function buildOtpBoxes(containerEl, onSync) {
    containerEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'numeric'; inp.maxLength = 1;
      inp.style.cssText = `width:44px;height:56px;border:1px solid #d4d4d4;text-align:center;
        font-family:${F};font-size:22px;color:#1a1a1a;background:#fff;
        outline:none;transition:border-color 0.2s;box-sizing:border-box;flex-shrink:0;`;
      inp.addEventListener('focus', function () { this.style.borderColor = '#1a1a1a'; });
      inp.addEventListener('blur',  function () { this.style.borderColor = '#d4d4d4'; });
      inp.addEventListener('input', function (e) {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val.slice(-1);
        onSync();
        if (val && i < 5) {
          const next = containerEl.querySelectorAll('input')[i + 1];
          if (next) next.focus();
        }
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          const prev = containerEl.querySelectorAll('input')[i - 1];
          if (prev) { prev.value = ''; prev.focus(); onSync(); }
        }
      });
      inp.addEventListener('paste', function (e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        const boxes = containerEl.querySelectorAll('input');
        text.slice(0, 6).split('').forEach((ch, idx) => { if (boxes[idx]) boxes[idx].value = ch; });
        onSync();
        const last = Math.min(text.length, 5);
        if (boxes[last]) boxes[last].focus();
      });
      containerEl.appendChild(inp);
    }
  }

  function syncOtp(boxId, hiddenId) {
    const boxes = document.querySelectorAll('#' + boxId + ' input');
    document.getElementById(hiddenId).value = Array.from(boxes).map(b => b.value).join('');
  }

  // ─── State ────────────────────────────────────────────────────────────────
  let _pendingRegData = null;
  let _forgotEmail    = null;
  let _resendTimer    = null;
  let _forgotTimer    = null;

  // ─── Public API ───────────────────────────────────────────────────────────
  window.openAuthModal = function (startView) {
    document.getElementById('raen-auth-modal').style.display = 'flex';
    raenShowView(startView === 'register' ? 'register' : 'login');
  };

  window.closeAuthModal = function () {
    document.getElementById('raen-auth-modal').style.display = 'none';
    raenClearErrors();
  };

  // ─── View management ─────────────────────────────────────────────────────
  const ALL_VIEWS = ['login', 'register', 'otp', 'forgot-email', 'forgot-otp'];

  window.raenShowView = function (name) {
    ALL_VIEWS.forEach(v => {
      const el = document.getElementById('raen-view-' + v);
      if (el) el.style.display = v === name ? '' : 'none';
    });
    const overlay = document.getElementById('raen-auth-modal');
    if (overlay) overlay.scrollTop = 0;
  };

  window.raenSwitchToLogin    = function () { raenShowView('login');    raenClearErrors(); };
  window.raenSwitchToRegister = function () { raenShowView('register'); raenClearErrors(); };
  window.raenSwitchToForgot   = function () { raenShowView('forgot-email'); raenClearErrors(); };

  function raenClearErrors() {
    ['raen-login-error', 'raen-register-error', 'raen-otp-error',
     'raen-forgot-email-error', 'raen-forgot-otp-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
  }

  function raenShowError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function raenSetBtnLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled      = loading;
    btn.style.opacity = loading ? '0.55' : '1';
    btn.style.cursor  = loading ? 'not-allowed' : 'pointer';
    if (label) btn.textContent = label;
  }

  // ─── Eye toggle ───────────────────────────────────────────────────────────
  window.raenTogglePwd = function (inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type      = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden ? EYE_CLOSED : EYE_OPEN;
    btn.style.color = isHidden ? '#666' : '#aaa';
  };

  // ─── Password match indicator ─────────────────────────────────────────────
  window.raenCheckPasswordMatch = function () {
    const pwd     = document.getElementById('raen-reg-password').value;
    const confirm = document.getElementById('raen-reg-confirm').value;
    const el      = document.getElementById('raen-pwd-match');
    if (!el) return;
    if (!confirm) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    if (pwd === confirm) {
      el.innerHTML = `<span style="font-family:${F};font-size:11px;color:#2e7d32;
          display:flex;align-items:center;gap:5px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2e7d32"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>Passwords match</span>`;
    } else {
      el.innerHTML = `<span style="font-family:${F};font-size:11px;color:#ba1a1a;
          display:flex;align-items:center;gap:5px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>Passwords don&apos;t match</span>`;
    }
  };

  // ─── Channel toggle ───────────────────────────────────────────────────────
  window.raenUpdateChannelUI = function () {
    // WhatsApp is disabled — SMS is always active, no UI toggle needed
  };

  window.raenWaComingSoon = function () {
    const note = document.getElementById('raen-wa-soon-note');
    if (!note) return;
    note.style.display = 'block';
    clearTimeout(window._raenWaTimer);
    window._raenWaTimer = setTimeout(function () { note.style.display = 'none'; }, 2500);
  };

  // ─── Post-login handler ───────────────────────────────────────────────────
  function raenHandleSuccessfulAuth(token) {
    setAuthToken(token);
    closeAuthModal();
    if (typeof window.__postLoginCallback === 'function') {
      const cb = window.__postLoginCallback;
      delete window.__postLoginCallback;
      cb();
    } else {
      window.location.reload();
    }
  }

  // ─── Google Sign-In ───────────────────────────────────────────────────────
  async function handleGoogleCredential(response) {
    try {
      const result = await apiPost('/auth/google', { credential: response.credential });
      raenHandleSuccessfulAuth(result.token);
    } catch (err) {
      raenShowError('raen-login-error',    err.message || 'Google sign-in failed. Please try again.');
      raenShowError('raen-register-error', err.message || 'Google sign-in failed. Please try again.');
    }
  }

  function raenInitGSI() {
    const clientId = (window.__RAEN_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId || clientId.includes('PLACEHOLDER')) return;
    if (!window.google || !window.google.accounts) return;
    google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential, auto_select: false });
  }

  window.raenGoogleSignIn = function () {
    const clientId = (window.__RAEN_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId || clientId.includes('PLACEHOLDER')) {
      showToast('Google Sign-In is coming soon. Please use email & password for now.', 'info');
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      showToast('Google is loading — please try again in a moment.', 'info');
      return;
    }
    google.accounts.id.prompt(function (n) {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        showToast('Please use email & password, or try Google in a separate tab.', 'info');
      }
    });
  };

  let _gsiPoll = 0;
  const _gsiPollId = setInterval(function () {
    if (++_gsiPoll > 60) { clearInterval(_gsiPollId); return; }
    if (window.google && window.google.accounts) { clearInterval(_gsiPollId); raenInitGSI(); }
  }, 500);

  // ─── Login form ───────────────────────────────────────────────────────────
  document.getElementById('raen-login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    raenClearErrors();
    const btn = this.querySelector('button[type="submit"]');
    raenSetBtnLoading(btn, true, 'Signing in…');
    try {
      const result = await apiPost('/auth/login', {
        email:    document.getElementById('raen-login-email').value.trim(),
        password: document.getElementById('raen-login-password').value
      });
      raenHandleSuccessfulAuth(result.token);
    } catch (err) {
      raenShowError('raen-login-error', 'Incorrect email or password. Please try again.');
      raenSetBtnLoading(btn, false, 'Sign In');
    }
  });

  // ─── Register form — step 1: validate + send OTP ─────────────────────────
  document.getElementById('raen-register-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    raenClearErrors();

    const firstName = document.getElementById('raen-reg-first').value.trim();
    const lastName  = document.getElementById('raen-reg-last').value.trim();
    const email     = document.getElementById('raen-reg-email').value.trim();
    const phone     = document.getElementById('raen-reg-phone').value.trim();
    const password  = document.getElementById('raen-reg-password').value;
    const confirm   = document.getElementById('raen-reg-confirm').value;
    const channel   = document.querySelector('input[name="raen-otp-channel"]:checked').value;

    if (!firstName || !lastName || !email || !phone || !password || !confirm) {
      return raenShowError('raen-register-error', 'Please fill in all fields.');
    }
    if (password.length < 8) {
      return raenShowError('raen-register-error', 'Password must be at least 8 characters.');
    }
    if (password !== confirm) {
      return raenShowError('raen-register-error', 'Passwords do not match. Please check and try again.');
    }

    const btn = this.querySelector('button[type="submit"]');
    raenSetBtnLoading(btn, true, 'Sending code…');

    try {
      await apiPost('/auth/send-otp', { phone, channel });
      _pendingRegData = { firstName, lastName, email, phone, password, channel };

      const container = document.getElementById('raen-otp-boxes');
      buildOtpBoxes(container, () => syncOtp('raen-otp-boxes', 'raen-otp-value'));

      const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
      const maskedPhone  = phone.length > 4 ? phone.slice(0, -4).replace(/\d/g, '·') + phone.slice(-4) : phone;
      document.getElementById('raen-otp-subtitle').textContent =
        `A 6-digit code was sent to ${maskedPhone} via ${channelLabel}.`;

      raenShowView('otp');
      raenStartTimer('raen-resend-btn', 'raen-resend-timer', 'raen-resend-secs',
                     function cb() { _resendTimer = null; });
      _resendTimer = true; // flag that timer is running

      const firstBox = document.querySelector('#raen-otp-boxes input');
      if (firstBox) firstBox.focus();
    } catch (err) {
      raenShowError('raen-register-error', err.message || 'Could not send verification code. Please try again.');
      raenSetBtnLoading(btn, false, 'Send Verification Code');
    }
  });

  // ─── OTP — step 2: verify + create account ───────────────────────────────
  window.raenSubmitOtp = async function () {
    raenClearErrors();
    if (!_pendingRegData) return raenShowError('raen-otp-error', 'Session expired. Please start again.');
    const otp = document.getElementById('raen-otp-value').value;
    if (otp.length < 6) return raenShowError('raen-otp-error', 'Please enter the complete 6-digit code.');
    const btn = document.getElementById('raen-otp-verify-btn');
    raenSetBtnLoading(btn, true, 'Verifying…');
    try {
      const result = await apiPost('/auth/register-otp', { ..._pendingRegData, otp });
      _pendingRegData = null;
      raenHandleSuccessfulAuth(result.token);
    } catch (err) {
      raenShowError('raen-otp-error', err.message || 'Verification failed. Please check the code and try again.');
      raenSetBtnLoading(btn, false, 'Verify & Create Account');
    }
  };

  // ─── Registration OTP resend ──────────────────────────────────────────────
  window.raenResendOtp = async function () {
    if (!_pendingRegData) return;
    const btn = document.getElementById('raen-resend-btn');
    btn.disabled = true;
    try {
      await apiPost('/auth/send-otp', { phone: _pendingRegData.phone, channel: _pendingRegData.channel });
      raenStartTimer('raen-resend-btn', 'raen-resend-timer', 'raen-resend-secs', function () {});
      document.querySelectorAll('#raen-otp-boxes input').forEach(b => b.value = '');
      document.getElementById('raen-otp-value').value = '';
      const first = document.querySelector('#raen-otp-boxes input');
      if (first) first.focus();
    } catch (err) {
      raenShowError('raen-otp-error', err.message || 'Could not resend. Please try again.');
      btn.disabled = false;
    }
  };

  // ─── Shared countdown timer ───────────────────────────────────────────────
  const _timerIds = {};
  function raenStartTimer(btnId, timerId, secsId, onDone) {
    clearInterval(_timerIds[btnId]);
    let secs = 60;
    document.getElementById(btnId).style.display   = 'none';
    document.getElementById(timerId).style.display = 'inline';
    document.getElementById(secsId).textContent    = secs;
    _timerIds[btnId] = setInterval(function () {
      secs -= 1;
      document.getElementById(secsId).textContent = secs;
      if (secs <= 0) {
        clearInterval(_timerIds[btnId]);
        document.getElementById(btnId).style.display   = 'inline';
        document.getElementById(timerId).style.display = 'none';
        document.getElementById(btnId).disabled        = false;
        onDone();
      }
    }, 1000);
  }

  // ─── Forgot Password — step 1: send OTP ─────────────────────────────────
  window.raenForgotPasswordSend = async function () {
    raenClearErrors();
    const email = document.getElementById('raen-forgot-email').value.trim();
    if (!email) return raenShowError('raen-forgot-email-error', 'Please enter your email address.');
    const btn = document.getElementById('raen-forgot-send-btn');
    raenSetBtnLoading(btn, true, 'Sending code…');
    try {
      const result = await apiPost('/auth/forgot-password', { email });
      _forgotEmail = email;

      // Build OTP boxes for forgot flow
      const container = document.getElementById('raen-forgot-otp-boxes');
      buildOtpBoxes(container, () => syncOtp('raen-forgot-otp-boxes', 'raen-forgot-otp-value'));

      const maskedPhone = (result && result.maskedPhone) ? result.maskedPhone : 'your registered phone';
      document.getElementById('raen-forgot-otp-subtitle').textContent =
        `A 6-digit code was sent to ${maskedPhone}. Enter it below to continue.`;

      // Show OTP form, hide success (in case of re-entry)
      document.getElementById('raen-forgot-otp-form').style.display = '';
      document.getElementById('raen-forgot-success').style.display  = 'none';
      document.getElementById('raen-forgot-back-btn').style.display = 'flex';

      raenShowView('forgot-otp');
      raenStartTimer('raen-forgot-resend-btn', 'raen-forgot-resend-timer', 'raen-forgot-resend-secs', function () {});
      const firstBox = document.querySelector('#raen-forgot-otp-boxes input');
      if (firstBox) firstBox.focus();
    } catch (err) {
      raenShowError('raen-forgot-email-error', err.message || 'Could not send recovery code. Please try again.');
      raenSetBtnLoading(btn, false, 'Send Recovery Code');
    }
  };

  // ─── Forgot Password — step 2: verify OTP → magic link sent ─────────────
  window.raenForgotPasswordVerify = async function () {
    raenClearErrors();
    if (!_forgotEmail) return raenShowError('raen-forgot-otp-error', 'Session expired. Please start again.');
    const otp = document.getElementById('raen-forgot-otp-value').value;
    if (otp.length < 6) return raenShowError('raen-forgot-otp-error', 'Please enter the complete 6-digit code.');
    const btn = document.getElementById('raen-forgot-verify-btn');
    raenSetBtnLoading(btn, true, 'Verifying…');
    try {
      const result = await apiPost('/auth/forgot-password-verify', { email: _forgotEmail, otp });
      // Show success state
      const maskedEmail = (result && result.maskedEmail) ? result.maskedEmail : _forgotEmail;
      document.getElementById('raen-forgot-success-msg').innerHTML =
        `A password reset link has been sent to <strong>${maskedEmail}</strong>.<br>
         Please check your inbox — the link is valid for 1 hour.<br><br>
         <span style="font-size:11px;color:#bbb;">In development, the link is logged in the server console.</span>`;
      document.getElementById('raen-forgot-otp-form').style.display = 'none';
      document.getElementById('raen-forgot-back-btn').style.display = 'none';
      document.getElementById('raen-forgot-success').style.display  = '';
      _forgotEmail = null;
    } catch (err) {
      raenShowError('raen-forgot-otp-error', err.message || 'Verification failed. Please check the code and try again.');
      raenSetBtnLoading(btn, false, 'Verify & Send Reset Link');
    }
  };

  // ─── Forgot Password OTP resend ───────────────────────────────────────────
  window.raenForgotResend = async function () {
    if (!_forgotEmail) return;
    const btn = document.getElementById('raen-forgot-resend-btn');
    btn.disabled = true;
    try {
      await apiPost('/auth/forgot-password', { email: _forgotEmail });
      raenStartTimer('raen-forgot-resend-btn', 'raen-forgot-resend-timer', 'raen-forgot-resend-secs', function () {});
      document.querySelectorAll('#raen-forgot-otp-boxes input').forEach(b => b.value = '');
      document.getElementById('raen-forgot-otp-value').value = '';
      const first = document.querySelector('#raen-forgot-otp-boxes input');
      if (first) first.focus();
    } catch (err) {
      raenShowError('raen-forgot-otp-error', err.message || 'Could not resend. Please try again.');
      btn.disabled = false;
    }
  };

  // ─── Nav update on DOMContentLoaded ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    const authBtn = document.getElementById('auth-nav-btn');
    if (!authBtn) return;
    if (isLoggedIn()) {
      authBtn.textContent = 'MY ACCOUNT';
      authBtn.href        = 'account.html';
      authBtn.onclick     = null;
      authBtn.removeAttribute('onclick');
    }
  });

  // ─── Close on overlay click or Escape ────────────────────────────────────
  document.getElementById('raen-auth-modal').addEventListener('click', function (e) {
    if (e.target === this) closeAuthModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAuthModal();
  });

})();
